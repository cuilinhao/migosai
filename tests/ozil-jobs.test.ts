import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob, generationResponse } from '../lib/server/jobs';
import { verifyMediaSignature } from '../lib/server/media';

afterEach(() => vi.restoreAllMocks());

async function setup(polling = false) {
  const d = database();
  d.sqlite.prepare("UPDATE users SET credits=1000 WHERE id='u'").run();
  const env = { ...jobEnv(d.db), KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com' };
  const job = await reserveGeneration(d.db, 'u', 'ozil-test-once', 'video', {
    template: 'ozil-goal', provider: 'kie', photo: 'users/u/uploads/portrait', consent: true,
    model: 'seedance-2', duration: 15, aspect: '9:16', resolution: '720p',
    referenceDuration: 15, referencePath: '/templates/ozil-goal/motion.mp4',
  }, 300);
  if (polling) d.sqlite.prepare("UPDATE generations SET stage='polling',status='processing',provider_id='ozil_task' WHERE id=?").run(job.id);
  const row = () => d.sqlite.prepare('SELECT * FROM generations WHERE id=?').get(job.id) as any;
  const tick = async () => {
    d.sqlite.prepare('UPDATE generations SET next_poll=0 WHERE id=?').run(job.id);
    await advanceJob(env, job.id);
  };
  return { ...d, env, id: job.id, row, tick };
}

describe('Ozil goal video jobs', () => {
  it('submits one signed portrait with fixed soccer motion and audio, then polls the saved task', async () => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ code: 200, data: { taskId: 'ozil_task' } }))
      .mockResolvedValueOnce(Response.json({ code: 200, data: { taskId: 'ozil_task', model: 'bytedance/seedance-2', state: 'generating' } }));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'polling', provider_id: 'ozil_task' });
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ model: 'bytedance/seedance-2', input: {
      duration: 15, resolution: '720p', aspect_ratio: '9:16', generate_audio: true, nsfw_checker: true,
      reference_video_urls: ['https://example.test/templates/ozil-goal/motion.mp4'],
    } });
    expect(body.input.reference_image_urls).toHaveLength(1);
    expect(await verifyMediaSignature(d.env, 'users/u/uploads/portrait', new URL(body.input.reference_image_urls[0]))).toBe(true);
    expect(body.input.reference_audio_urls).toBeUndefined();
    expect(body.input.prompt).toMatch(/0[–-]3/);
    expect(body.input.prompt).toMatch(/3[–-]8\.5/);
    expect(body.input.prompt).toMatch(/8\.5[–-]15/);
    expect(body.input.prompt).toMatch(/goalkeeper/i);
    expect(body.input.prompt).toMatch(/chest/i);
    expect(body.input.prompt).toMatch(/slide tackle/i);
    expect(body.input.prompt).not.toMatch(/hotel|microphone|rap performance/i);
    await d.tick();
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'GET']);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
  });

  it('refunds a failed soccer task once through the shared ledger', async () => {
    const d = await setup(true);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: {
      taskId: 'ozil_task', model: 'bytedance/seedance-2', state: 'fail', failCode: 'content_policy_blocked', failMsg: 'private provider detail',
    } }));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal' });
    expect(generationResponse(d.row()).error).toContain('Your credits have been returned.');
    expect(generationResponse(d.row()).error).not.toContain('private');
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits).toBe(1000);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('holds uncertain soccer submission for support without repeating a paid request', async () => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network timeout'));
    await d.tick(); await d.tick();
    expect(d.row()).toMatchObject({ stage: 'manual_review', provider_id: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits).toBe(700);
  });

  it('quarantines soccer results for the shared safety review before exposing media', async () => {
    const d = await setup(true);
    d.env.MEDIA = {
      createMultipartUpload: async () => ({ uploadPart: async (partNumber: number) => ({ partNumber, etag: 'part' }), complete: async () => ({}), abort: async () => {} }),
      head: async () => ({ etag: 'ozil-etag' }), delete: async () => {},
    } as unknown as R2Bucket;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async target => String(target).startsWith('https://api.kie.ai/')
      ? Response.json({ code: 200, data: { taskId: 'ozil_task', state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://tempfile.aiquickdraw.com/goal.mp4'] }) } })
      : new Response(new Uint8Array([0, 1, 2, 3]), { headers: { 'content-type': 'video/mp4', 'content-length': '4' } }));
    await d.tick();
    expect(d.row()).toMatchObject({ stage: 'moderation_submitting', status: 'reviewing', moderation_verdict: 'pending', result_keys: null });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined();
    expect(JSON.parse(d.row().moderation_state).requestBody).toContain('video-nsfw-filter');
  });
});
