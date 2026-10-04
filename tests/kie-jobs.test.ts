import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob, generationResponse } from '../lib/server/jobs';
import { verifyMediaSignature } from '../lib/server/media';
import { sha256 } from '../lib/server/security';
import * as videoAvailability from '../lib/video-availability';

const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));
import { createGeneration } from '../lib/server/generations';

afterEach(() => vi.restoreAllMocks());
const input = { leftImage: 'users/u/uploads/left', rightImage: 'users/u/uploads/right', duration: 5, resolution: '480p', aspect: '9:16', mode: 'pet' };
async function kieJob(polling = false, settings = {}) {
  const d = database();
  const env = { ...jobEnv(d.db), APIMART_API_KEY: undefined, APIMART_MEDIA_HOSTS: undefined, KIE_API_KEY: 'kie-test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com' };
  const job = await reserveGeneration(d.db, 'u', 'kie-video', 'video', { ...input, ...settings, provider: 'kie' }, 50);
  if (polling) d.sqlite.prepare("UPDATE generations SET stage='polling',status='processing',provider_id='kie_task' WHERE id=?").run(job.id);
  const row = () => d.sqlite.prepare('SELECT * FROM generations WHERE id=?').get(job.id) as any;
  const tick = async () => { d.sqlite.prepare('UPDATE generations SET next_poll=0 WHERE id=?').run(job.id); await advanceJob(env, job.id); };
  return { ...d, env, id: job.id, row, tick };
}

describe('Kie video integration', () => {
  it('uses first-party template motion and soundtrack for new Wan requests', async () => {
    const d = await kieJob(false, { model: 'wan-3.0', scene: 'hotel-lobby', motion: 'template', soundtrack: 'template', duration: 12 });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'kie_task' } }));
    await d.tick();
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ model: 'wan/3-0-video', input: {
      reference_video_urls: ['https://example.test/templates/hotel-lobby/motion-12.mp4'],
      reference_audio_urls: ['https://example.test/templates/hotel-lobby/audio-12.wav'], duration: 12, resolution: '480P',
    } });
    expect(d.row()).toMatchObject({ stage: 'polling', provider_id: 'kie_task' });
  });

  it('signs private motion and audio references without sending upload keys to Kie', async () => {
    const referenceVideo = 'users/u/uploads/motion', referenceAudio = 'users/u/uploads/song';
    const d = await kieJob(false, { model: 'wan-3.0', scene: 'hotel-lobby', motion: 'video', soundtrack: 'song', referenceVideo, referenceAudio });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'kie_task' } }));
    await d.tick();
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(await verifyMediaSignature(d.env, referenceVideo, new URL(body.input.reference_video_urls[0]))).toBe(true);
    expect(await verifyMediaSignature(d.env, referenceAudio, new URL(body.input.reference_audio_urls[0]))).toBe(true);
    expect(body.input.reference_video_urls[0]).not.toBe(referenceVideo);
    expect(body.input.reference_audio_urls[0]).not.toBe(referenceAudio);
  });

  it('does not lock an alternate stage to the orange template video when Seedance is available', async () => {
    // Exercise Seedance routing after service recovery; outage guards have their own tests.
    vi.spyOn(videoAvailability, 'getVideoModelUnavailableReason').mockReturnValue(undefined);
    const d = await kieJob(false, { model: 'seedance-2-fast', scene: 'luxury-lobby', motion: 'template', soundtrack: 'ai' });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'kie_task' } }));
    await d.tick();
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body.model).toBe('bytedance/seedance-2-fast');
    expect(body.input.reference_video_urls).toBeUndefined();
    expect(body.input.reference_audio_urls).toBeUndefined();
    expect(body.input.prompt).toContain('grand hotel');
  });

  it('polls the persisted Wan model without re-submitting or changing providers', async () => {
    const d = await kieJob(true, { model: 'wan-3.0', scene: 'hotel-lobby', motion: 'template', soundtrack: 'template' });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'kie_task', model: 'wan/3-0-video', state: 'generating' } }));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'polling', provider_id: 'kie_task', error: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
  });
  it('reserves new video requests for Kie without requiring the legacy music credentials', async () => {
    const d = database(), token = 'x'.repeat(43);
    routeEnv.value = { ...jobEnv(d.db), APIMART_API_KEY: undefined, APIMART_MEDIA_HOSTS: undefined, KIE_API_KEY: 'kie-test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com' };
    d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
    for (const key of [input.leftImage, input.rightImage]) d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(key, 'u', 'image/jpeg');
    const request = () => new Request('https://example.test/api/generations', { method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'kie-create-once' }, body: JSON.stringify({ ...input, model: 'wan-3.0', provider: 'apimart' }) });
    const response = await createGeneration(request(), 'video');
    expect(response.status).toBe(202);
    expect(JSON.parse(String(d.sqlite.prepare('SELECT payload FROM generations').get()?.payload))).toMatchObject({ model: 'wan-3.0', provider: 'kie' });
    const retry = await createGeneration(request(), 'video');
    expect((await retry.json() as {id:string}).id).toBe((await response.json() as {id:string}).id);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(70);
  });

  for (const explicitKey of [true, false]) it(`preserves a pre-switch reservation on retry (explicit key: ${explicitKey})`, async () => {
    const d = database(), token = 'y'.repeat(43);
    vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
    routeEnv.value = { ...jobEnv(d.db), KIE_API_KEY: 'kie-test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com' };
    const legacyOptions = { leftImage: input.leftImage, rightImage: input.rightImage, aspect: '9:16', duration: 5, resolution: '480p', mode: 'pet' };
    const key = explicitKey ? 'before-the-switch' : await sha256(`video:${JSON.stringify(legacyOptions)}:30000000`);
    const previous = await reserveGeneration(d.db, 'u', key, 'video', legacyOptions, 50);
    d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
    for (const image of [input.leftImage, input.rightImage]) d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(image, 'u', 'image/jpeg');
    const response = await createGeneration(new Request('https://example.test/api/generations', { method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}`, 'Content-Type': 'application/json', ...(explicitKey ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(input) }), 'video');
    expect((await response.json() as {id:string}).id).toBe(previous.id);
    expect(d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n).toBe(1);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
    expect(JSON.parse(String(d.sqlite.prepare('SELECT payload FROM generations').get()?.payload)).provider).toBeUndefined();
  });

  it('submits the ordered signed photos once and saves the Kie task for polling when Seedance is available', async () => {
    // Retain legacy Seedance payload coverage without lifting the production incident switch.
    vi.spyOn(videoAvailability, 'getVideoModelUnavailableReason').mockReturnValue(undefined);
    const d = await kieJob();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, msg: 'success', data: { taskId: 'kie_task' } }));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'polling', status: 'processing', provider_id: 'kie_task' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.kie.ai/api/v1/jobs/createTask');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: 'bytedance/seedance-2', input: { duration: 5, resolution: '480p', aspect_ratio: '9:16', generate_audio: true, nsfw_checker: true } });
    expect(body.input.reference_image_urls).toHaveLength(2);
    for (const [i, key] of [input.leftImage, input.rightImage].entries()) expect(await verifyMediaSignature(d.env, key, new URL(body.input.reference_image_urls[i]))).toBe(true);
    expect(body.input.first_frame_url).toBeUndefined();
    expect(body.input.reference_video_urls).toBeUndefined();
    expect(body.input.reference_audio_urls).toBeUndefined();
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
  });

  for (const state of ['waiting', 'queuing', 'generating']) it(`keeps a ${state} task saved without another paid submission`, async () => {
    const d = await kieJob(true);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'kie_task', state, resultJson: null, failCode: null, failMsg: null } }));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'polling', provider_id: 'kie_task', status: 'processing' });
    expect(fetcher.mock.calls[0][0]).toBe('https://api.kie.ai/api/v1/jobs/recordInfo?taskId=kie_task');
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
  });

  it('refunds a failed Kie task once without exposing raw provider errors', async () => {
    const d = await kieJob(true);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'kie_task', state: 'fail', resultJson: null, failCode: '500', failMsg: 'private prompt https://private.test/token' } }));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal' });
    expect(d.row().error).not.toMatch(/private/);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('allows only one worker to submit a new customized job while the first POST is in flight', async () => {
    const d = await kieJob(false, { model: 'wan-3.0', scene: 'hotel-lobby', motion: 'template', soundtrack: 'template' });
    let markStarted!: () => void, finishSubmission!: () => void;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    const pending = new Promise<void>(resolve => { finishSubmission = resolve; });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      markStarted(); await pending;
      return Response.json({ code: 200, data: { taskId: 'single_wan_task' } });
    });
    const firstWorker = d.tick();
    await started;
    try {
      await d.tick();
      expect(d.row()).toMatchObject({ stage: 'submitting_generation', provider_id: null });
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { finishSubmission(); }
    await firstWorker;
    expect(d.row()).toMatchObject({ stage: 'polling', provider_id: 'single_wan_task' });
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
  });

  it('serializes concurrent policy-failure polls and returns only one refund', async () => {
    const d = await kieJob(true, { model: 'wan-3.0', scene: 'hotel-lobby', motion: 'template', soundtrack: 'template' });
    let markStarted!: () => void, finishPoll!: () => void;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    const pending = new Promise<void>(resolve => { finishPoll = resolve; });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      markStarted(); await pending;
      return Response.json({ code: 200, data: { taskId: 'kie_task', model: 'wan/3-0-video', state: 'fail', failCode: 'content_policy_blocked', failMsg: 'private content and URL' } });
    });
    const firstWorker = d.tick();
    await started;
    try {
      await d.tick();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(0);
    } finally { finishPoll(); }
    await firstWorker;
    await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal' });
    expect(generationResponse(d.row()).error).toBe('The generation service rejected this content. Please use different reference photos. Your credits have been returned.');
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
  });

  it('does not repeat a paid POST when submission times out', async () => {
    const d = await kieJob(false, { model: 'wan-3.0' });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network timeout'));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ stage: 'manual_review' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
  });

  it('retries only the saved GET after a temporary query failure', async () => {
    const d = await kieJob(true);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('network')).mockResolvedValue(Response.json({ code: 200, data: { taskId: 'kie_task', state: 'generating' } }));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ stage: 'polling', provider_id: 'kie_task' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
    expect(d.row().error).toBeNull();
  });

  it('downloads a Kie result privately and starts SeeAPI review before delivery', async () => {
    const d = await kieJob(true), stored: Uint8Array[] = [];
    d.env.MEDIA = {
      createMultipartUpload: async () => ({ uploadPart: async (partNumber: number, bytes: Uint8Array) => { stored.push(bytes.slice()); return { partNumber, etag: 'part' }; }, complete: async () => ({}), abort: async () => {} }),
      head: async () => ({ etag: 'kie-etag' }), delete: async () => {},
    } as unknown as R2Bucket;
    const url = 'https://tempfile.aiquickdraw.com/video.mp4';
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (target) => String(target).startsWith('https://api.kie.ai/')
      ? Response.json({ code: 200, data: { taskId: 'kie_task', state: 'success', resultJson: JSON.stringify({ resultUrls: [url] }) } })
      : new Response(new Uint8Array([0, 1, 2, 3]), { headers: { 'content-type': 'video/mp4', 'content-length': '4' } }));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'moderation_submitting', moderation_verdict: 'pending', result_keys: null });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    expect([...stored[0]]).toEqual([0, 1, 2, 3]);
    expect(fetcher.mock.calls[1][0]).toBe(url);
  });

  it('rejects output hosts that are allowed only for the previous provider', async () => {
    const d = await kieJob(true);
    d.env.APIMART_MEDIA_HOSTS = 'cdn.apimart.ai' as any;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'kie_task', state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://cdn.apimart.ai/video.mp4'] }) } }));
    await d.tick();
    expect(d.row().stage).toBe('polling');
    expect(d.row().moderation_key).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
