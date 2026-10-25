import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob, generationResponse } from '../lib/server/jobs';
import { verifyMediaSignature } from '../lib/server/media';
import { readFileSync } from 'node:fs';
import { BufferSource, Input, MP4 } from 'mediabunny';
import { memoryVideoBucket } from './window-peeper-r2-fixture';
import type { Env } from '../lib/server/env';

const providerVideo = new Uint8Array(readFileSync(new URL('./fixtures/window-peeper-audio/video-with-audio.mp4', import.meta.url)));
const fixedSoundtrack = new Uint8Array(readFileSync(new URL('../public/templates/window-peeper/soundtrack.m4a', import.meta.url)));

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
  d.env.ASSETS = { fetch: async () => new Response(fixedSoundtrack, { headers: { 'content-type': 'audio/mp4' } }) } as unknown as Fetcher;
  const fetcher = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({ request_id: 'window_task', status: 'COMPLETED' }))
    .mockResolvedValueOnce(Response.json({ video: { url: 'https://v3b.fal.media/files/window.mp4', content_type: 'video/mp4' } }))
    .mockResolvedValueOnce(new Response(sourceVideo, { headers: { 'content-type': 'video/mp4', 'content-length': String(sourceVideo.byteLength) } }))
    .mockResolvedValueOnce(Response.json({ id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'queued', result: null, error: null }, { status: 202 }))
    .mockResolvedValueOnce(Response.json(assessment(flagged)));
  return { ...media, fetcher };
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
    expect(d.row()).toMatchObject({ stage: 'moderation_submitting', status: 'reviewing', moderation_verdict: 'pending', result_keys: null });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    const key = d.row().moderation_key;
    expect(media.stored.has(key)).toBe(true);
    expect(media.stored.size).toBe(1);
    const prepared = new Input({ source: new BufferSource(media.stored.get(key)!.bytes), formats: [MP4] });
    try {
      expect(await (await prepared.getPrimaryAudioTrack())!.getSampleRate()).toBe(44100);
      expect(await (await prepared.getPrimaryAudioTrack())!.getNumberOfChannels()).toBe(2);
    } finally { prepared.dispose(); }
    expect(d.row().moderation_etag).toBe(media.stored.get(key)!.etag);
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'completed', stage: 'terminal', moderation_verdict: 'passed', result_keys: JSON.stringify([key]) });
    expect(generationResponse(d.row())).toMatchObject({ template: 'window-peeper', videoUrl: `/api/media/${key}` });
    expect(media.fetcher.mock.calls.slice(0, 3).map(([url]) => url)).toEqual([`${queueRoot}/status`, queueRoot, 'https://v3b.fal.media/files/window.mp4']);
    expect(media.fetcher.mock.calls[2][1]?.headers).toBeUndefined();
    expect(d.credits()).toBe(300);
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

  it('retries a missing soundtrack using the same provider result without another paid submission', async () => {
    const d = await setup(true), media = await completedProvider(d);
    const asset = d.env.ASSETS!;
    d.env.ASSETS = { fetch: async () => new Response('missing', { status: 404 }) } as unknown as Fetcher;
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'polling', status: 'processing', provider_id: handle, result_keys: null });
    expect(media.stored.size).toBe(0);
    expect(d.credits()).toBe(300);
    d.env.ASSETS = asset;
    media.fetcher.mockReset()
      .mockResolvedValueOnce(Response.json({ request_id: 'window_task', status: 'COMPLETED' }))
      .mockResolvedValueOnce(Response.json({ video: { url: 'https://v3b.fal.media/files/window.mp4' } }))
      .mockResolvedValueOnce(new Response(providerVideo, { headers: { 'content-type': 'video/mp4' } }));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'moderation_submitting', status: 'reviewing' });
    expect(media.stored.size).toBe(1);
    expect(media.fetcher.mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(0);
    expect(d.credits()).toBe(300);
  });

  it('refunds an unsupported generated video once without publishing its original audio', async () => {
    const shortVideo = new Uint8Array(readFileSync(new URL('./fixtures/window-peeper-audio/short-avc.mp4', import.meta.url)));
    const d = await setup(true), media = await completedProvider(d, false, shortVideo);
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal', result_keys: null });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    expect(media.stored.size).toBe(0);
    expect(media.aborted).toHaveLength(1);
    expect(d.credits()).toBe(600);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
    expect(media.fetcher).toHaveBeenCalledTimes(3);
  });

  it('removes blocked output and refunds exactly once through the shared safety pipeline', async () => {
    const d = await setup(true), media = await completedProvider(d, true);
    await d.tick(); const key = d.row().moderation_key;
    await d.tick(); await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', moderation_verdict: 'blocked' });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    expect(media.stored.has(key)).toBe(false);
    expect(media.removed).toHaveLength(2);
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
