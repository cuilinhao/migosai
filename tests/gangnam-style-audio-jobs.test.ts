import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { memoryVideoBucket } from './window-peeper-r2-fixture';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob, generationResponse } from '../lib/server/jobs';
import { serveUserMedia } from '../lib/server/moderation-media';
import { sha256 } from '../lib/server/security';
import type { Env } from '../lib/server/env';

const source = 'https://tempfile.aiquickdraw.com/gangnam-silent.mp4';
const output = 'https://v3.fal.media/gangnam-with-audio.mp4';
const audioEndpoint = 'https://queue.fal.run/fal-ai/ffmpeg-api/merge-audio-video';
const audioRoot = 'https://queue.fal.run/fal-ai/ffmpeg-api/requests/audio_task';
const audioHandle = JSON.stringify({ version: 1, requestId: 'audio_task', statusUrl: `${audioRoot}/status`, resultUrl: audioRoot });
const bytes = new Uint8Array(readFileSync(new URL('./fixtures/window-peeper-audio/video-with-audio.mp4', import.meta.url)));
afterEach(() => vi.restoreAllMocks());
async function setup(stage = 'new', soundtrack = true) {
  const d = database(), media = memoryVideoBucket(), token = 'a'.repeat(43);
  d.sqlite.prepare("UPDATE users SET credits=1000 WHERE id='u'").run();
  d.sqlite.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'u',unixepoch()+60)").run(await sha256(token));
  const env: Env = { ...jobEnv(d.db), MEDIA: media.bucket, KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com', FAL_KEY: 'fal-key', FAL_MEDIA_HOSTS: 'v3.fal.media' };
  const job = await reserveGeneration(d.db, 'u', 'gangnam-audio-once', 'video', {
    template: 'gangnam-style', workflow: 'reference-edit-v1', ...(soundtrack ? { soundtrack: 'gangnam-style-v1' } : {}),
    provider: 'kie', model: 'seedance-2-5', duration: 15, generateAudio: false, prompt: 'Edit @Video1 with the uploaded cast.',
    mode: 'friends', photos: ['users/u/uploads/middle', 'users/u/uploads/right', 'users/u/uploads/left'], aspect: '16:9', resolution: '480p', consent: true,
  }, 150);
  const state = { version: 1, kind: 'gangnam-style-audio', sourceUrl: source, ...(stage === 'audio_polling' || stage === 'audio_storing' ? { handle: audioHandle } : {}), ...(stage === 'audio_storing' ? { outputUrl: output } : {}) };
  if (stage !== 'new') d.sqlite.prepare("UPDATE generations SET stage=?,status='processing',provider_id='gangnam_task',assets=? WHERE id=?").run(stage, stage.startsWith('audio') || stage === 'submitting_audio' ? JSON.stringify(state) : null, job.id);
  const row = () => d.sqlite.prepare('SELECT * FROM generations WHERE id=?').get(job.id) as any;
  const tick = async () => { d.sqlite.prepare('UPDATE generations SET next_poll=0 WHERE id=?').run(job.id); await advanceJob(env, job.id); };
  const download = (key: string) => serveUserMedia(new Request(`https://example.test/api/media/${key}`, { headers: { cookie: `migos_session=${token}` } }), env, key);
  return { ...d, env, media, state, id: job.id, row, tick, download };
}
function providerResult(url = source) { return Response.json({ code: 200, data: { taskId: 'gangnam_task', model: 'bytedance/seedance-2-5', state: 'success', resultJson: JSON.stringify({ resultUrls: [url] }) } }); }
function assessment(blocked: boolean) {
  return { id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'succeeded', error: null,
    result: { type: 'json', data: { flagged: blocked, ...(blocked ? { reason: 'content_policy_blocked', output: null } : { output: {
      nsfw_detected: false, scope: 'sampled_frames', sampling_complete: true, checked_frames: 1, flagged_frame_count: 0, report_schema_version: 5,
      output_layout: 'named-files-v1', timestamp_source: 'frame_index_div_fps_estimate', frames: [{ frame_number: 1, timestamp_seconds: 0, nsfw_detected: false, nsfw: [] }],
    } }) } },
  };
}
describe('Gangnam Style fixed soundtrack jobs', () => {
  it.each([false, true])('submits each provider once and reviews only the private merged output, blocked=%s', async blocked => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (target, init) => {
      const url = String(target);
      if (url.endsWith('/jobs/createTask')) { expect(JSON.parse(String(init?.body)).input.generate_audio).toBe(false); return Response.json({ code: 200, data: { taskId: 'gangnam_task' } }); }
      if (url.includes('/jobs/recordInfo?')) return providerResult();
      if (url === audioEndpoint) {
        expect(d.row().stage).toBe('submitting_audio');
        expect(JSON.parse(String(init?.body))).toEqual({ video_url: source, audio_url: 'https://example.test/gangnam-style/soundtrack.m4a', start_offset: 0 });
        return Response.json({ request_id: 'audio_task', status_url: `${audioRoot}/status`, response_url: audioRoot });
      }
      if (url === `${audioRoot}/status`) return Response.json({ request_id: 'audio_task', status: 'COMPLETED' });
      if (url === audioRoot) return Response.json({ video: { url: output, content_type: 'video/mp4' } });
      if (url === output) return new Response(bytes, { headers: { 'content-type': 'video/mp4' } });
      if (url === 'https://api.seeapi.com/v1/inferences') return Response.json({ id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'queued', result: null, error: null }, { status: 202 });
      if (url === 'https://api.seeapi.com/v1/inferences/task_safety') return Response.json(assessment(blocked));
      throw new Error('Unexpected request: ' + url);
    });
    await Promise.all([d.tick(), d.tick()]); await d.tick();
    expect(d.row()).toMatchObject({ stage: 'audio_ready', result_keys: null, moderation_key: null, provider_id: 'gangnam_task' });
    expect(JSON.parse(d.row().assets)).toEqual({ version: 1, kind: 'gangnam-style-audio', sourceUrl: source });
    expect(d.media.stored.size).toBe(0); expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    expect(generationResponse(d.row()).statusMessage).toBe('Adding the template soundtrack…');
    await Promise.all([d.tick(), d.tick()]); await d.tick();
    expect(d.row().stage).toBe('audio_storing'); expect(d.media.stored.size).toBe(0);
    await d.tick();
    const key = d.row().moderation_key;
    expect(d.row()).toMatchObject({ stage: 'moderation_submitting', result_keys: null, moderation_verdict: 'pending' });
    expect(d.media.stored.get(key)?.bytes).toEqual(bytes);
    await expect(d.download(key)).rejects.toMatchObject({ status: 404 });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    await d.tick(); await d.tick(); await d.tick();
    expect(d.row().status).toBe(blocked ? 'failed' : 'completed');
    if (blocked) await expect(d.download(key)).rejects.toMatchObject({ status: 404 });
    else expect((await d.download(key)).status).toBe(200);
    expect(generationResponse(d.row()).videoUrl).toBe(blocked ? undefined : `/api/media/${key}`);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/jobs/createTask'))).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([url]) => url === audioEndpoint)).toHaveLength(1);
    expect(fetcher.mock.calls.some(([url]) => url === source)).toBe(false);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(blocked ? 1 : 0);
  });
  it('keeps older unmarked reservations silent without requiring Fal', async () => {
    const d = await setup('polling', false); delete d.env.FAL_KEY; delete d.env.FAL_MEDIA_HOSTS;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(providerResult())
      .mockResolvedValueOnce(new Response(bytes, { headers: { 'content-type': 'video/mp4' } }));
    await d.tick(); expect(d.row().stage).toBe('moderation_submitting');
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual(['https://api.kie.ai/api/v1/jobs/recordInfo?taskId=gangnam_task', source]);
  });
  it.each(['uncertain', 'rejected'])('does not repeat an audio %s submission', async mode => {
    const d = await setup('audio_ready');
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { if (mode === 'uncertain') throw new TypeError('network timeout'); return Response.json({ error: 'rejected' }, { status: 422 }); });
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ stage: mode === 'uncertain' ? 'manual_review' : 'terminal', result_keys: null, provider_id: 'gangnam_task' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(mode === 'uncertain' ? 0 : 1);
  });
  it('holds a crashed audio submission without posting again', async () => {
    const d = await setup('submitting_audio'), fetcher = vi.spyOn(globalThis, 'fetch');
    await d.tick(); await d.tick(); expect(d.row().stage).toBe('manual_review'); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { sourceUrl: 'https://v3.fal.media/wrong-source.mp4' }, { sourceUrl: `${source}#fragment` },
    { kind: 'window-peeper-audio' }, { outputUrl: source }, { outputUrl: `${output}#fragment` },
  ])('holds mismatched saved audio media before any request %#', async patch => {
    const d = await setup('audio_storing');
    d.sqlite.prepare('UPDATE generations SET assets=? WHERE id=?').run(JSON.stringify({ ...d.state, ...patch }), d.id);
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await d.tick(); expect(d.row().stage).toBe('manual_review'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('retries only the saved merged download after a transient failure', async () => {
    const d = await setup('audio_storing');
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(bytes, { headers: { 'content-type': 'video/mp4' } }));
    await d.tick(); expect(d.row().stage).toBe('audio_storing');
    await d.tick(); expect(d.row().stage).toBe('moderation_submitting');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([output, output]);
  });
});
