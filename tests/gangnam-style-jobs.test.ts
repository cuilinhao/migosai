import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob, generationResponse } from '../lib/server/jobs';
import { verifyMediaSignature } from '../lib/server/media';

afterEach(() => vi.restoreAllMocks());
const prompt = 'Remake @Video1 as a silent handheld selfie relay with the uploaded cast.';
async function setup(selfie = false, polling = false, aspect = '16:9') {
  const d = database();
  d.sqlite.prepare("UPDATE users SET credits=1000 WHERE id='u'").run();
  const env = { ...jobEnv(d.db), KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com' };
  const job = await reserveGeneration(d.db, 'u', 'gangnam-once', 'video', {
    template: 'gangnam-style', provider: 'kie', model: 'seedance-2-5', prompt, duration: 15, mode: selfie ? 'selfie' : 'friends',
    aspect, resolution: '720p', generateAudio: false, consent: true,
    photos: selfie ? ['users/u/uploads/middle'] : ['users/u/uploads/middle', 'users/u/uploads/right', 'users/u/uploads/left'],
  }, 300);
  if (polling) d.sqlite.prepare("UPDATE generations SET stage='polling',status='processing',provider_id='gangnam_task' WHERE id=?").run(job.id);
  const row = () => d.sqlite.prepare('SELECT * FROM generations WHERE id=?').get(job.id) as any;
  const tick = async () => { d.sqlite.prepare('UPDATE generations SET next_poll=0 WHERE id=?').run(job.id); await advanceJob(env, job.id); };
  return { ...d, env, id: job.id, row, tick };
}

describe('Gangnam Style jobs share the existing video pipeline', () => {
  it.each([false, true])('submits a silent 15-second job preserving ordered private references, selfie=%s', async selfie => {
    const d = await setup(selfie);
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ code: 200, data: { taskId: 'gangnam_task' } }))
      .mockResolvedValueOnce(Response.json({ code: 200, data: { taskId: 'gangnam_task', model: 'bytedance/seedance-2-5', state: 'generating' } }));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'polling', provider_id: 'gangnam_task' });
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ model: 'bytedance/seedance-2-5', input: {
      prompt, duration: 15, resolution: '720p', aspect_ratio: '16:9', generate_audio: false, nsfw_checker: true,
    } });
    expect(body.input.reference_video_urls).toEqual(['https://example.test/gangnam-style/photo-trio-seoul-with-audio.mp4']);
    expect(body.input.reference_audio_urls).toBeUndefined();
    expect(body.input.first_frame_url).toBeUndefined();
    expect(body.input.last_frame_url).toBeUndefined();
    const keys = selfie ? ['users/u/uploads/middle'] : ['users/u/uploads/middle', 'users/u/uploads/right', 'users/u/uploads/left'];
    expect(body.input.reference_image_urls).toHaveLength(keys.length);
    for (const [index, key] of keys.entries()) expect(await verifyMediaSignature(d.env, key, new URL(body.input.reference_image_urls[index]))).toBe(true);
    await d.tick();
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'GET']);
    expect(d.row().status).toBe('processing');
  });

  it('refunds a definitive provider failure exactly once', async () => {
    const d = await setup(false, true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: {
      taskId: 'gangnam_task', model: 'bytedance/seedance-2-5', state: 'fail', failCode: 'task_failed', failMsg: 'private provider detail',
    } }));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal' });
    expect(generationResponse(d.row()).error).not.toContain('private provider');
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(1000);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
  });

  it('does not repeat an uncertain paid submission', async () => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network timeout'));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ stage: 'manual_review', provider_id: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(700);
  });

  it('serializes concurrent workers before sending one paid request', async () => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'gangnam_task' } }));
    await Promise.all([d.tick(), d.tick()]);
    expect(d.row().stage).toBe('polling');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('keeps the output private until review and handles blocked=%s', async blocked => {
    const d = await setup(false, true);
    d.env.MEDIA = {
      createMultipartUpload: async () => ({ uploadPart: async (partNumber: number) => ({ partNumber, etag: 'part' }), complete: async () => ({}), abort: async () => {} }),
      head: async () => ({ etag: 'gangnam-etag' }), delete: vi.fn(async () => {}),
    } as unknown as R2Bucket;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async target => String(target).startsWith('https://api.kie.ai/')
      ? Response.json({ code: 200, data: { taskId: 'gangnam_task', model: 'bytedance/seedance-2-5', state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://tempfile.aiquickdraw.com/car.mp4'] }) } })
      : new Response(new Uint8Array([0, 1, 2, 3]), { headers: { 'content-type': 'video/mp4', 'content-length': '4' } }));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'moderation_submitting', status: 'reviewing', moderation_verdict: 'pending', result_keys: null });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    const key = d.row().moderation_key;
    fetcher.mockResolvedValueOnce(Response.json({ id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'queued', result: null, error: null }, { status: 202 }));
    await d.tick();
    expect(d.row().stage).toBe('moderation_polling');
    fetcher.mockResolvedValueOnce(Response.json({ id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'succeeded', error: null, result: { type: 'json', data: {
      flagged: blocked, ...(blocked ? { reason: 'content_policy_blocked', output: null } : { output: { nsfw_detected: false, scope: 'sampled_frames', sampling_complete: true, checked_frames: 1, flagged_frame_count: 0, report_schema_version: 5, output_layout: 'named-files-v1', timestamp_source: 'frame_index_div_fps_estimate', frames: [{ frame_number: 1, timestamp_seconds: 0, nsfw_detected: false, nsfw: [] }] } }),
    } } }));
    await d.tick(); await d.tick();
    expect(d.row().status).toBe(blocked ? 'failed' : 'completed');
    expect(generationResponse(d.row()).videoUrl).toBe(blocked ? undefined : `/api/media/${key}`);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(blocked ? 1000 : 700);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(blocked ? 1 : 0);
  });

  it('maps auto to the provider adaptive enum and preserves ultrawide', async () => {
    for (const aspect of ['auto', '21:9']) {
      const d = await setup(false, false, aspect);
      const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'gangnam_task' } }));
      await d.tick();
      expect(d.row().stage).toBe('polling');
      expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).input.aspect_ratio).toBe(aspect === 'auto' ? 'adaptive' : '21:9');
      fetcher.mockRestore();
    }
  });
});
