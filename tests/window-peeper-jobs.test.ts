import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob, generationResponse } from '../lib/server/jobs';
import { verifyMediaSignature } from '../lib/server/media';
import { readFileSync } from 'node:fs';
import { memoryVideoBucket } from './window-peeper-r2-fixture';
import type { Env } from '../lib/server/env';
import * as ffmpeg from '../lib/server/fal-ffmpeg';
import { ProviderError } from '../lib/server/provider';

const providerVideo = new Uint8Array(readFileSync(new URL('./fixtures/window-peeper-audio/video-with-audio.mp4', import.meta.url)));
const sourceUrl = 'https://v3b.fal.media/files/window.mp4';
const outputUrl = 'https://v3b.fal.media/files/window-with-fixed-audio.mp4';
const audioHandle = JSON.stringify({ version: 1, requestId: 'audio_task', statusUrl: 'https://queue.fal.run/fal-ai/ffmpeg-api/requests/audio_task/status', resultUrl: 'https://queue.fal.run/fal-ai/ffmpeg-api/requests/audio_task' });

afterEach(() => vi.restoreAllMocks());
const queueRoot = 'https://queue.fal.run/minimax/h3/requests/window_task';
const queued = { request_id: 'window_task', status: 'IN_QUEUE', status_url: `${queueRoot}/status`, response_url: queueRoot };
const handle = JSON.stringify({ version: 1, requestId: 'window_task', statusUrl: `${queueRoot}/status`, resultUrl: queueRoot });
async function setup(polling = false) {
  const d = database();
  d.sqlite.prepare("UPDATE users SET credits=600 WHERE id='u'").run();
  const env: Env = { ...jobEnv(d.db), FAL_KEY: 'fal-test-key', FAL_MEDIA_HOSTS: 'v3.fal.media,v3b.fal.media,fal.media' };
  const job = await reserveGeneration(d.db, 'u', 'window-peeper-once', 'video', {
    template: 'window-peeper', provider: 'fal', photo: 'users/u/uploads/portrait', consent: true,
    model: 'minimax-h3', endpoint: 'minimax/h3/reference-to-video', duration: 15, aspect: '9:16', resolution: '768p',
    referenceDuration: 8.2, referencePath: '/templates/window-peeper/motion.mp4',
  }, 300);
  if (polling) d.sqlite.prepare("UPDATE generations SET stage='polling',status='processing',provider_id=? WHERE id=?").run(handle, job.id);
  const row = () => d.sqlite.prepare('SELECT * FROM generations WHERE id=?').get(job.id) as any;
  const tick = async () => { d.sqlite.prepare('UPDATE generations SET next_poll=0 WHERE id=?').run(job.id); await advanceJob(env, job.id); };
  const credits = () => d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits;
  return { ...d, env, id: job.id, row, tick, credits };
}

function assessment(flagged = false) {
  return { id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'succeeded', error: null,
    result: { type: 'json', data: { flagged, ...(flagged ? { reason: 'content_policy_blocked', output: null } : { output: {
      nsfw_detected: false, scope: 'sampled_frames', sampling_complete: true, checked_frames: 1, flagged_frame_count: 0,
      report_schema_version: 5, output_layout: 'named-files-v1', timestamp_source: 'frame_index_div_fps_estimate',
      frames: [{ frame_number: 1, timestamp_seconds: 0, nsfw_detected: false, nsfw: [] }],
    } }) } },
  };
}

async function completedProvider(d: Awaited<ReturnType<typeof setup>>, flagged = false, sourceVideo = providerVideo) {
  const media = memoryVideoBucket();
  d.env.MEDIA = media.bucket;
  const submitAudio = vi.spyOn(ffmpeg, 'createFalWindowPeeperAudio').mockResolvedValue(audioHandle);
  const pollAudio = vi.spyOn(ffmpeg, 'getFalWindowPeeperAudio').mockResolvedValue({ status: 'completed', result: { videos: [{ url: [outputUrl] }] } });
  const fetcher = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({ request_id: 'window_task', status: 'COMPLETED' }))
    .mockResolvedValueOnce(Response.json({ video: { url: sourceUrl, content_type: 'video/mp4' } }))
    .mockResolvedValueOnce(new Response(sourceVideo, { headers: { 'content-type': 'video/mp4', 'content-length': String(sourceVideo.byteLength) } }))
    .mockResolvedValueOnce(Response.json({ id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'queued', result: null, error: null }, { status: 202 }))
    .mockResolvedValueOnce(Response.json(assessment(flagged)));
  return { ...media, fetcher, submitAudio, pollAudio };
}

async function audioState(stage: 'audio_ready' | 'submitting_audio' | 'audio_polling' | 'audio_storing') {
  const d = await setup(true);
  const state = { version: 1, kind: 'window-peeper-audio', sourceUrl, ...(stage === 'audio_polling' || stage === 'audio_storing' ? { handle: audioHandle } : {}), ...(stage === 'audio_storing' ? { outputUrl } : {}) };
  d.sqlite.prepare('UPDATE generations SET stage=?,assets=? WHERE id=?').run(stage, JSON.stringify(state), d.id);
  return { ...d, state };
}

describe('Window Peeper jobs', () => {
  it('submits the signed identity photo with quality prompt expansion and fixed window motion', async () => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(queued));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'polling', status: 'processing', provider_id: handle });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://queue.fal.run/minimax/h3/reference-to-video');
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual', headers: { 'X-Fal-No-Retry': '1' } });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ duration: 15, resolution: '768P', aspect_ratio: '9:16', enable_safety_checker: true,
      prompt_expansion_mode: 'quality', sync_mode: false, reference_video_urls: ['https://example.test/templates/window-peeper/motion.mp4'] });
    expect(body.reference_image_urls).toHaveLength(1);
    expect(await verifyMediaSignature(d.env, 'users/u/uploads/portrait', new URL(body.reference_image_urls[0]))).toBe(true);
    expect(body.prompt).toMatch(/Image 1/);
    expect(body.prompt).toMatch(/Video 1/);
    expect(body.prompt).toMatch(/night|nighttime/i);
    expect(body.prompt).toMatch(/burger/i);
    expect(body.prompt).toMatch(/curtain/i);
    expect(body.prompt).not.toMatch(/football|goalkeeper|microphone/i);
    expect(body.reference_audio_urls).toBeUndefined();
    expect(d.credits()).toBe(300);
  });

  it('exposes only a recognized video template alongside the ordinary job response', async () => {
    const d = await setup();
    expect(generationResponse(d.row())).toMatchObject({ id: d.id, template: 'window-peeper' });
    expect(generationResponse(d.row())).not.toHaveProperty('photo');
    expect(generationResponse({ ...d.row(), payload: '{' })).not.toHaveProperty('template');
    expect(generationResponse({ ...d.row(), payload: '{"template":"attacker"}' })).not.toHaveProperty('template');
    expect(generationResponse({ ...d.row(), kind: 'music' })).not.toHaveProperty('template');
  });

  it('serializes concurrent workers before the sole paid POST', async () => {
    const d = await setup();
    let started!: () => void, finish!: () => void, reachedProvider = false;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { reachedProvider = true; started(); await pending; return Response.json(queued); });
    const first = d.tick();
    // A missing scene dispatch must fail rather than leave this test waiting forever.
    await Promise.race([ready, first.then(() => { expect(reachedProvider).toBe(true); })]);
    try { await d.tick(); expect(fetcher).toHaveBeenCalledTimes(1); } finally { finish(); }
    await first;
    expect(d.row().stage).toBe('polling');
    expect(d.credits()).toBe(300);
  });

  it('stores a completed video privately and exposes it only after the existing safety review passes', async () => {
    const d = await setup(true), media = await completedProvider(d);
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'audio_ready', provider_id: handle, status: 'processing', result_keys: null });
    expect(JSON.parse(d.row().assets)).toEqual({ version: 1, kind: 'window-peeper-audio', sourceUrl });
    expect(media.submitAudio).not.toHaveBeenCalled();
    expect(media.stored.size).toBe(0);
    expect(generationResponse(d.row())).toMatchObject({ statusMessage: 'Adding the template soundtrack…' });
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'audio_polling', provider_id: handle });
    expect(JSON.parse(d.row().assets)).toMatchObject({ sourceUrl, handle: audioHandle });
    expect(media.submitAudio).toHaveBeenCalledExactlyOnceWith(d.env, sourceUrl);
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'audio_storing', provider_id: handle });
    expect(JSON.parse(d.row().assets)).toMatchObject({ sourceUrl, handle: audioHandle, outputUrl });
    expect(media.stored.size).toBe(0);
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'moderation_submitting', status: 'reviewing', moderation_verdict: 'pending', result_keys: null });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    const key = d.row().moderation_key;
    expect(media.stored.has(key)).toBe(true);
    expect(media.stored.size).toBe(1);
    expect(media.stored.get(key)!.bytes).toEqual(providerVideo); // FFmpeg bytes are stored without another remux.
    expect(d.row().moderation_etag).toBe(media.stored.get(key)!.etag);
    expect(JSON.parse(d.row().moderation_state).idempotencyKey).toBe(`migosai-video-moderation-${d.id}-${key.split('/').at(-1)}`);
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'completed', stage: 'terminal', moderation_verdict: 'passed', result_keys: JSON.stringify([key]) });
    expect(generationResponse(d.row())).toMatchObject({ template: 'window-peeper', videoUrl: `/api/media/${key}` });
    expect(media.fetcher.mock.calls.slice(0, 3).map(([url]) => url)).toEqual([`${queueRoot}/status`, queueRoot, outputUrl]);
    expect(media.fetcher.mock.calls[2][1]?.headers).toBeUndefined();
    expect(d.credits()).toBe(300);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
  });

  it('refunds definitive provider failure once and hides provider error details', async () => {
    const d = await setup(true);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ request_id: 'window_task', status: 'COMPLETED', error: 'private signed photo', error_type: 'runner_server_error' }));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal' });
    expect(d.row().error).not.toContain('private');
    expect(d.credits()).toBe(600);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('recovers an existing completed model handle into audio preparation without another model POST or debit', async () => {
    const d = await setup(true), media = await completedProvider(d);
    // A guarded operator recovery only returned the existing job to polling.
    d.sqlite.prepare("UPDATE generations SET status='reviewing',moderation_verdict='manual',moderation_key='old-candidate',moderation_etag='old-etag',moderation_state=? WHERE id=?")
      .run(JSON.stringify({ taskId: 'previous_failed_review' }), d.id);
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'audio_ready', status: 'processing', provider_id: handle, moderation_key: null, moderation_etag: null, moderation_state: null, moderation_verdict: null });
    expect(JSON.parse(d.row().assets)).toMatchObject({ sourceUrl, kind: 'window-peeper-audio' });
    expect(media.fetcher.mock.calls.map(([url]) => url)).toEqual([`${queueRoot}/status`, queueRoot]);
    expect(media.fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
    expect(media.submitAudio).not.toHaveBeenCalled();
    expect(d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n).toBe(1);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
    expect(d.credits()).toBe(300);
  });

  it('persists the in-flight audio stage before the POST and holds an uncertain submission without repeating it', async () => {
    const d = await audioState('audio_ready');
    const submit = vi.spyOn(ffmpeg, 'createFalWindowPeeperAudio').mockImplementation(async () => {
      expect(d.row().stage).toBe('submitting_audio');
      throw new ProviderError('Audio preparation could not be confirmed.', true);
    });
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ stage: 'manual_review', provider_id: handle, result_keys: null });
    expect(JSON.parse(d.row().assets)).toEqual(d.state);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
    expect(d.credits()).toBe(300);
  });

  it('does not resubmit an audio POST interrupted before its handle was persisted', async () => {
    const d = await audioState('submitting_audio');
    const submit = vi.spyOn(ffmpeg, 'createFalWindowPeeperAudio');
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ stage: 'manual_review', provider_id: handle });
    expect(submit).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(d.credits()).toBe(300);
  });

  it('serializes concurrent workers before the sole audio submission', async () => {
    const d = await audioState('audio_ready');
    let started!: () => void, finish!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const submit = vi.spyOn(ffmpeg, 'createFalWindowPeeperAudio').mockImplementation(async () => { started(); await pending; return audioHandle; });
    const first = d.tick();
    await ready;
    try { await d.tick(); expect(submit).toHaveBeenCalledTimes(1); } finally { finish(); }
    await first;
    expect(d.row()).toMatchObject({ stage: 'audio_polling', provider_id: handle });
    expect(d.credits()).toBe(300);
  });

  it('refunds an explicitly rejected audio submission once', async () => {
    const d = await audioState('audio_ready');
    const submit = vi.spyOn(ffmpeg, 'createFalWindowPeeperAudio').mockRejectedValue(new ProviderError('The audio request was rejected.'));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal', provider_id: handle, result_keys: null });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(d.credits()).toBe(600);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
  });

  it('retries an audio status read using the saved handle without another submission', async () => {
    const d = await audioState('audio_polling');
    const submit = vi.spyOn(ffmpeg, 'createFalWindowPeeperAudio');
    const poll = vi.spyOn(ffmpeg, 'getFalWindowPeeperAudio')
      .mockRejectedValueOnce(new ProviderError('Temporarily unavailable.', false, true))
      .mockResolvedValueOnce({ status: 'completed', result: { videos: [{ url: [outputUrl] }] } });
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'audio_polling', provider_id: handle });
    await d.tick();
    expect(d.row().stage).toBe('audio_storing');
    expect(poll.mock.calls).toEqual([[d.env, audioHandle], [d.env, audioHandle]]);
    expect(submit).not.toHaveBeenCalled();
    expect(d.credits()).toBe(300);
  });

  it('retries saving only the persisted FFmpeg output and never starts either queue again', async () => {
    const d = await audioState('audio_storing'), media = memoryVideoBucket();
    d.env.MEDIA = media.bucket;
    const submit = vi.spyOn(ffmpeg, 'createFalWindowPeeperAudio');
    const poll = vi.spyOn(ffmpeg, 'getFalWindowPeeperAudio');
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(new Response(providerVideo, { headers: { 'content-type': 'video/mp4' } }));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'audio_storing', provider_id: handle });
    await d.tick();
    expect(d.row().stage).toBe('moderation_submitting');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([outputUrl, outputUrl]);
    expect(media.stored.get(d.row().moderation_key)!.bytes).toEqual(providerVideo);
    expect(submit).not.toHaveBeenCalled(); expect(poll).not.toHaveBeenCalled();
    expect(d.credits()).toBe(300);
  });

  it('refunds a definitively oversized prepared output once instead of retrying the same download forever', async () => {
    const d = await audioState('audio_storing'), media = memoryVideoBucket();
    d.env.MEDIA = media.bucket;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(providerVideo, { headers: { 'content-type': 'video/mp4', 'content-length': String(65 * 1024 * 1024) } }));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal', provider_id: handle, result_keys: null });
    expect(media.stored.size).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(d.credits()).toBe(600);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
  });

  it('refunds a definitive audio task failure exactly once and hides its output', async () => {
    const d = await audioState('audio_polling');
    const poll = vi.spyOn(ffmpeg, 'getFalWindowPeeperAudio').mockResolvedValue({ status: 'failed' });
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal', result_keys: null, provider_id: handle });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    expect(poll).toHaveBeenCalledTimes(1);
    expect(d.credits()).toBe(600);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
  });

  it.each([
    { version: 2, kind: 'window-peeper-audio', sourceUrl },
    { version: 1, kind: 'other-template', sourceUrl },
    { version: 1, kind: 'window-peeper-audio', sourceUrl: 'https://untrusted.test/private' },
  ])('holds invalid saved audio state without sending a request %#', async state => {
    const d = await audioState('audio_ready');
    d.sqlite.prepare('UPDATE generations SET assets=? WHERE id=?').run(JSON.stringify(state), d.id);
    const submit = vi.spyOn(ffmpeg, 'createFalWindowPeeperAudio');
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'manual_review', result_keys: null });
    expect(submit).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
    expect(d.credits()).toBe(300);
  });

  it('does not apply audio processing to another template', async () => {
    const d = await audioState('audio_ready');
    const payload = JSON.parse(d.row().payload); payload.template = 'ozil-goal';
    d.sqlite.prepare('UPDATE generations SET payload=? WHERE id=?').run(JSON.stringify(payload), d.id);
    const submit = vi.spyOn(ffmpeg, 'createFalWindowPeeperAudio');
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await d.tick();
    expect(submit).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
    expect(d.credits()).toBe(300);
  });

  it('holds an unsafe persisted FFmpeg output before any download', async () => {
    const d = await audioState('audio_storing');
    d.sqlite.prepare('UPDATE generations SET assets=? WHERE id=?').run(JSON.stringify({ ...d.state, outputUrl: 'https://untrusted.test/video.mp4' }), d.id);
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'manual_review', result_keys: null });
    expect(fetcher).not.toHaveBeenCalled();
    expect(d.credits()).toBe(300);
  });

  it('removes blocked output and refunds exactly once through the shared safety pipeline', async () => {
    const d = await setup(true), media = await completedProvider(d, true);
    await d.tick(); await d.tick(); await d.tick(); await d.tick(); const key = d.row().moderation_key;
    await d.tick(); await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', moderation_verdict: 'blocked' });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    expect(media.stored.has(key)).toBe(false);
    expect(media.removed).toHaveLength(1);
    expect(media.removed.at(-1)).toBe(key);
    expect(d.credits()).toBe(600);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
  });

  it('holds an uncertain paid submission without sending another POST or returning credits automatically', async () => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network timeout private detail'));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ stage: 'manual_review', provider_id: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(d.row().error).not.toContain('private detail');
    expect(d.credits()).toBe(300);
  });
});
