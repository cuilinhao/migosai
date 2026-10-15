import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob, generationResponse } from '../lib/server/jobs';
import { verifyMediaSignature } from '../lib/server/media';

afterEach(() => vi.restoreAllMocks());
const queueRoot = 'https://queue.fal.run/minimax/h3/requests/fal_task';
const queued = { request_id: 'fal_task', status: 'IN_QUEUE', status_url: `${queueRoot}/status`, response_url: queueRoot };
const handle = JSON.stringify({ version: 1, requestId: 'fal_task', statusUrl: `${queueRoot}/status`, resultUrl: queueRoot });
async function setup(polling = false) {
  const d = database();
  d.sqlite.prepare("UPDATE users SET credits=600 WHERE id='u'").run();
  const env = { ...jobEnv(d.db), FAL_KEY: 'fal-test-key', FAL_MEDIA_HOSTS: 'v3.fal.media,v3b.fal.media,fal.media' };
  const job = await reserveGeneration(d.db, 'u', 'fal-ozil-test', 'video', {
    template: 'ozil-goal', provider: 'fal', photo: 'users/u/uploads/portrait', consent: true,
    model: 'minimax-h3', endpoint: 'minimax/h3/reference-to-video', duration: 15, aspect: '9:16', resolution: '768p',
    referenceDuration: 15, referencePath: '/templates/ozil-goal/motion.mp4',
  }, 300);
  if (polling) d.sqlite.prepare("UPDATE generations SET stage='polling',status='processing',provider_id=? WHERE id=?").run(handle, job.id);
  const row = () => d.sqlite.prepare('SELECT * FROM generations WHERE id=?').get(job.id) as any;
  const tick = async () => { d.sqlite.prepare('UPDATE generations SET next_poll=0 WHERE id=?').run(job.id); await advanceJob(env, job.id); };
  const credits = () => d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits;
  return { ...d, env, id: job.id, row, tick, credits };
}

describe('Ozil Fal jobs', () => {
  it('submits exactly one portrait and fixed motion and persists the validated queue handle', async () => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(queued));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'polling', status: 'processing', provider_id: handle });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://queue.fal.run/minimax/h3/reference-to-video');
    const init = fetcher.mock.calls[0][1]!;
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual', headers: { Authorization: 'Key fal-test-key', 'X-Fal-No-Retry': '1' } });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ duration: 15, resolution: '768P', aspect_ratio: '9:16', enable_safety_checker: true, prompt_expansion_mode: 'disabled', sync_mode: false,
      reference_video_urls: ['https://example.test/templates/ozil-goal/motion.mp4'] });
    expect(body.reference_image_urls).toHaveLength(1);
    expect(await verifyMediaSignature(d.env, 'users/u/uploads/portrait', new URL(body.reference_image_urls[0]))).toBe(true);
    expect(body.prompt).toContain('Image 1'); expect(body.prompt).toContain('Video 1');
    expect(body.prompt).not.toMatch(/hotel|microphone/);
    expect(body.reference_audio_urls).toBeUndefined();
    expect(body.generate_audio).toBeUndefined();
    expect(d.credits()).toBe(300);
  });

  it('polls only the saved GET during queueing and transient failures', async () => {
    const d = await setup(true);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network detail')).mockResolvedValue(Response.json({ request_id: 'fal_task', status: 'IN_PROGRESS' }));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ stage: 'polling', provider_id: handle, error: null });
    expect(fetcher.mock.calls.every(([url, init]) => url === `${queueRoot}/status` && init?.method === 'GET')).toBe(true);
    expect(d.credits()).toBe(300);
  });

  it('refunds a definitive failed queue task exactly once without exposing provider details', async () => {
    const d = await setup(true);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ request_id: 'fal_task', status: 'COMPLETED', error: 'secret signed photo', error_type: 'runner_server_error' }));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal' });
    expect(d.row().error).not.toContain('secret');
    expect(d.credits()).toBe(600);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not retry an uncertain paid submission', async () => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network timeout with secret'));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ stage: 'manual_review', provider_id: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(d.row().error).not.toContain('secret');
    expect(d.credits()).toBe(300);
  });

  it.each(['https://attacker.test/requests/fal_task/status', 'https://queue.fal.run/other/model/requests/fal_task/status', 'https://queue.fal.run/minimax/h3/requests/other/status'])('holds an untrusted queue URL %s without calling it', async status_url => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ...queued, status_url }));
    await d.tick(); await d.tick();
    expect(d.row().stage).toBe('manual_review');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(d.credits()).toBe(300);
  });

  it('downloads a Fal result only into private storage pending existing safety review', async () => {
    const d = await setup(true);
    d.env.MEDIA = { createMultipartUpload: async () => ({ uploadPart: async (partNumber: number) => ({ partNumber, etag: 'part' }), complete: async () => ({}), abort: async () => {} }),
      head: async () => ({ etag: 'fal-etag' }), delete: async () => {} } as unknown as R2Bucket;
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ request_id: 'fal_task', status: 'COMPLETED' }))
      .mockResolvedValueOnce(Response.json({ video: { url: 'https://v3b.fal.media/files/goal.mp4', content_type: 'video/mp4' } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0, 1, 2, 3]), { headers: { 'content-type': 'video/mp4', 'content-length': '4' } }));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'moderation_submitting', status: 'reviewing', moderation_verdict: 'pending', result_keys: null });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([`${queueRoot}/status`, queueRoot, 'https://v3b.fal.media/files/goal.mp4']);
    expect(fetcher.mock.calls[2][1]?.headers).toBeUndefined();
  });

  it('serializes concurrent workers before the sole paid POST', async () => {
    const d = await setup();
    let started!: () => void, finish!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { started(); await pending; return Response.json(queued); });
    const first = d.tick(); await ready;
    try { await d.tick(); expect(fetcher).toHaveBeenCalledTimes(1); } finally { finish(); }
    await first;
    expect(d.row().stage).toBe('polling');
    expect(d.credits()).toBe(300);
  });
});
