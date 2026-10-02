import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob, generationResponse, runDueJobs } from '../lib/server/jobs';
import * as media from '../lib/server/media';

afterEach(() => vi.restoreAllMocks());

async function generatedVideo() {
  const d = database();
  const job = await reserveGeneration(d.db, 'u', 'nsfw-video', 'video', { duration: 5, resolution: '480p', aspect: '9:16' }, 50);
  d.sqlite.prepare("UPDATE generations SET status='processing',stage='polling',provider_id='video_task' WHERE id=?").run(job.id);
  const env = { ...jobEnv(d.db), SEEAPI_API_KEY: 'test-seeapi', MEDIA: { head: vi.fn(async () => ({ etag: 'video-etag' })), delete: vi.fn(async () => {}) } as unknown as R2Bucket };
  return { ...d, id: job.id, env, row: () => d.sqlite.prepare('SELECT * FROM generations WHERE id=?').get(job.id) as any };
}

function assessment(flagged = false) {
  return { id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'succeeded', error: null, result: { type: 'json', data: { flagged, ...(flagged ? { reason: 'content_policy_blocked', output: null } : { output: { nsfw_detected: false, scope: 'sampled_frames', sampling_complete: true, checked_frames: 1, flagged_frame_count: 0, report_schema_version: 5, output_layout: 'named-files-v1', timestamp_source: 'frame_index_div_fps_estimate', frames: [{ frame_number: 1, timestamp_seconds: 0, nsfw_detected: false, nsfw: [] }] } }) } } };
}

async function pendingModeration(stage = 'moderation_submitting') {
  const d = await generatedVideo(), now = Math.floor(Date.now() / 1000);
  const key = `users/u/results/${d.id}/candidate`;
  const state = { version: 1, requestBody: JSON.stringify({ input: { video_url: 'https://example.test/fixed-signed-url', num_frames: 32 } }), idempotencyKey: `migosai-video-moderation-${d.id}`, expiresAt: now + 3600, deadline: now + 1800, failures: 0, ...(stage === 'moderation_polling' ? { taskId: 'task_safety' } : {}) };
  d.sqlite.prepare("UPDATE generations SET stage=?,status='reviewing',moderation_verdict='pending',moderation_key=?,moderation_etag='video-etag',moderation_state=? WHERE id=?").run(stage, key, JSON.stringify(state), d.id);
  return { ...d, key, state };
}

describe('video delivery moderation gate', () => {
  it('quarantines generated video instead of marking it completed', async () => {
    const d = await generatedVideo();
    const store = vi.spyOn(media, 'storeProviderMedia').mockImplementation(async (_env, _url, key) => key);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: { status: 'completed', cost: 0.4, result: { videos: [{ url: ['https://cdn.apimart.ai/video.mp4'] }] } } }));
    await advanceJob(d.env, d.id);
    expect(d.row()).toMatchObject({ status: 'reviewing', stage: 'moderation_submitting', moderation_verdict: 'pending', result_keys: null });
    expect(store.mock.calls[0][2]).toMatch(new RegExp(`/results/${d.id}/[a-f0-9-]{36}$`));
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    const state = JSON.parse(d.row().moderation_state);
    expect(JSON.parse(state.requestBody).input).toMatchObject({ num_frames: 32, strict_special_care: true, return_frames: 'none' });
    expect(state.idempotencyKey).toBe(`migosai-video-moderation-${d.id}`);
  });

  it('reuses the exact persisted body and key after an uncertain submission', async () => {
    const d = await pendingModeration();
    const requests: RequestInit[] = [];
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => { requests.push(init!); if (requests.length === 1) throw new TypeError('network'); return Response.json({ id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'queued', result: null, error: null }, { status: 202 }); });
    await advanceJob(d.env, d.id);
    expect(d.row()).toMatchObject({ stage: 'moderation_submitting', moderation_verdict: 'pending' });
    d.sqlite.exec('UPDATE generations SET next_poll=0');
    await advanceJob(d.env, d.id);
    expect(d.row().stage).toBe('moderation_polling');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(requests.map(r => r.body)).toEqual([d.state.requestBody, d.state.requestBody]);
    expect(requests.map(r => new Headers(r.headers).get('Idempotency-Key'))).toEqual([d.state.idempotencyKey, d.state.idempotencyKey]);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
  });

  it('publishes only the approved immutable candidate', async () => {
    const d = await pendingModeration('moderation_polling');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(assessment()));
    await advanceJob(d.env, d.id);
    expect(d.row()).toMatchObject({ status: 'completed', moderation_verdict: 'passed', result_keys: JSON.stringify([d.key]) });
    expect(generationResponse(d.row()).videoUrl).toBe(`/api/media/${d.key}`);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
  });

  it('blocks policy-restricted output and refunds only once', async () => {
    const d = await pendingModeration('moderation_polling');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(assessment(true)));
    await advanceJob(d.env, d.id);
    d.sqlite.exec('UPDATE generations SET next_poll=0');
    await advanceJob(d.env, d.id);
    expect(d.row()).toMatchObject({ status: 'failed', moderation_verdict: 'blocked' });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
    expect(d.env.MEDIA.delete).toHaveBeenCalledWith(d.key);
  });

  it('preserves Retry-After scheduling through lease release', async () => {
    const d = await pendingModeration('moderation_polling'), now = Math.floor(Date.now() / 1000);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429, headers: { 'Retry-After': '300' } }));
    await advanceJob(d.env, d.id);
    expect(d.row().next_poll).toBeGreaterThanOrEqual(now + 300);
    expect(d.row()).toMatchObject({ moderation_verdict: 'pending', stage: 'moderation_polling', lease_owner: null });
  });

  it('keeps permanent API failures quarantined for manual review without refund', async () => {
    const d = await pendingModeration('moderation_polling');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('denied', { status: 403 }));
    await advanceJob(d.env, d.id);
    expect(d.row()).toMatchObject({ stage: 'manual_review', moderation_verdict: 'manual' });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
  });

  it('stops at the deadline without creating another inference', async () => {
    const d = await pendingModeration();
    d.sqlite.prepare('UPDATE generations SET moderation_state=?').run(JSON.stringify({ ...d.state, deadline: Math.floor(Date.now() / 1000) - 1 }));
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await advanceJob(d.env, d.id);
    expect(d.row()).toMatchObject({ stage: 'manual_review', moderation_verdict: 'manual' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not release an overwritten candidate even after a clean verdict', async () => {
    const d = await pendingModeration('moderation_polling');
    vi.mocked(d.env.MEDIA.head).mockResolvedValue({ etag: 'changed' } as R2Object);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(assessment()));
    await advanceJob(d.env, d.id);
    expect(d.row()).toMatchObject({ stage: 'manual_review', moderation_verdict: 'manual' });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
  });

  it('hides historical results without a passing moderation verdict', async () => {
    const d = await generatedVideo();
    d.sqlite.prepare("UPDATE generations SET status='completed',result_keys=?").run(JSON.stringify([`users/u/results/${d.id}/0`]));
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
  });

  it('does not let a stale clean response overwrite a newer blocked refund', async () => {
    const d = await pendingModeration('moderation_polling');
    let resume!: () => void, arrived!: () => void;
    const waiting = new Promise<void>(resolve => { arrived = resolve; });
    const gate = new Promise<void>(resolve => { resume = resolve; });
    let calls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      if (++calls === 1) { arrived(); await gate; return Response.json(assessment()); }
      return Response.json(assessment(true));
    });
    const old = advanceJob(d.env, d.id);
    await waiting;
    d.sqlite.exec('UPDATE generations SET lease_until=0,next_poll=0');
    await advanceJob(d.env, d.id);
    resume(); await old;
    expect(d.row()).toMatchObject({ status: 'failed', moderation_verdict: 'blocked', result_keys: null });
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);
  });

  it('resumes a persisted block after interruption before its refund', async () => {
    const d = await pendingModeration('moderation_polling');
    d.sqlite.exec("UPDATE generations SET moderation_verdict='blocked'");
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await advanceJob(d.env, d.id);
    expect(d.row().status).toBe('failed');
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('holds incomplete sampled coverage even when the overall flag is false', async () => {
    const d = await pendingModeration('moderation_polling');
    const result = assessment(); result.result.data.output!.sampling_complete = false;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(result));
    await advanceJob(d.env, d.id);
    expect(d.row()).toMatchObject({ stage: 'manual_review', moderation_verdict: 'manual' });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
  });

  it('durably retries deletion after refund when R2 is unavailable', async () => {
    const d = await pendingModeration('moderation_polling');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(assessment(true)));
    vi.mocked(d.env.MEDIA.delete).mockRejectedValueOnce(new Error('R2 unavailable'));
    await advanceJob(d.env, d.id);
    expect(d.row()).toMatchObject({ status: 'failed', moderation_verdict: 'blocked', moderation_cleanup_pending: 1 });
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);
    await runDueJobs(d.env);
    expect(d.row().moderation_cleanup_pending).toBe(0);
    expect(d.env.MEDIA.delete).toHaveBeenCalledTimes(2);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
  });

  for (const persisted of [true, false]) it(`retries a blocked refund after a transient database failure (persisted=${persisted})`, async () => {
    const d = await pendingModeration('moderation_polling');
    d.sqlite.prepare('UPDATE generations SET moderation_state=?').run(JSON.stringify({ ...d.state, failures: 7, deadline: Math.floor(Date.now() / 1000) + 60 }));
    if (persisted) d.sqlite.exec("UPDATE generations SET moderation_verdict='blocked'");
    const batch = vi.fn().mockRejectedValueOnce(new Error('D1 temporarily unavailable')).mockImplementation((statements) => d.db.batch(statements));
    const env = { ...d.env, DB: { ...d.db, batch } as unknown as D1Database };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(assessment(true)));
    await advanceJob(env, d.id);
    expect(d.row()).toMatchObject({ stage: 'moderation_polling', moderation_verdict: 'blocked', moderation_cleanup_pending: 1 });
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
    d.sqlite.exec('UPDATE generations SET next_poll=0');
    await advanceJob(env, d.id);
    expect(d.row()).toMatchObject({ status: 'failed', moderation_verdict: 'blocked', moderation_cleanup_pending: 0 });
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);
  });
});
