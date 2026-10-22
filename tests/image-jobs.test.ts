import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob, generationResponse } from '../lib/server/jobs';
import { signedMediaUrl, verifyMediaSignature } from '../lib/server/media';
import { serveUserMedia } from '../lib/server/moderation-media';
import { sha256 } from '../lib/server/security';

afterEach(() => vi.restoreAllMocks());
const resultUrl = 'https://tempfile.aiquickdraw.com/cat.png';
const task = (state: string, patch: Record<string, unknown> = {}) => Response.json({ code: 200, data: { taskId: 'image-task', model: 'nano-banana-2', state, resultJson: null, failCode: null, failMsg: null, ...patch } });
async function setup(polling = false, images: string[] = []) {
  const d = database();
  const objects = new Map<string, { bytes: Uint8Array; mime: string }>();
  const bucket = {
    createMultipartUpload: async (key: string, options: any) => {
      const parts: Uint8Array[] = [];
      return { uploadPart: async (partNumber: number, bytes: Uint8Array) => { parts.push(bytes.slice()); return { partNumber, etag: 'part' }; },
        complete: async () => { const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0)); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; } objects.set(key, { bytes, mime: options.httpMetadata.contentType }); }, abort: async () => {} };
    },
    get: async (key: string) => { const object = objects.get(key); return object ? { size: object.bytes.length, httpMetadata: { contentType: object.mime }, body: new Blob([object.bytes as BlobPart]).stream() } : null; },
  } as unknown as R2Bucket;
  const env = { ...jobEnv(d.db), KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com', MEDIA: bucket, SEEAPI_API_KEY: undefined };
  const job = await reserveGeneration(d.db, 'u', 'image-once', 'image', { provider: 'kie', model: 'nano-banana-2', prompt: 'An orange cat', images, aspect: 'auto', resolution: '2K', outputFormat: 'png' }, 8);
  if (polling) d.sqlite.prepare("UPDATE generations SET stage='polling',status='processing',provider_id='image-task' WHERE id=?").run(job.id);
  const row = () => d.sqlite.prepare('SELECT * FROM generations WHERE id=?').get(job.id) as any;
  const tick = async () => { d.sqlite.prepare('UPDATE generations SET next_poll=0 WHERE id=?').run(job.id); await advanceJob(env, job.id); };
  const credits = () => d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits;
  return { ...d, env, row, tick, credits, objects, id: job.id };
}

describe('image job lifecycle', () => {
  it('submits signed image references through Kie and preserves the saved parameters', async () => {
    const d = await setup(false, ['users/u/uploads/photo']);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'image-task' } }));
    await d.tick(); expect(d.row()).toMatchObject({ stage: 'polling', provider_id: 'image-task', status: 'processing' });
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ model: 'nano-banana-2', input: { prompt: 'An orange cat', resolution: '2K', output_format: 'png' } });
    expect(await verifyMediaSignature(d.env, 'users/u/uploads/photo', new URL(body.input.image_input[0]))).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(d.credits()).toBe(92);
  });
  it('serializes concurrent workers before making one paid submission', async () => {
    const d = await setup(); const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'image-task' } }));
    await Promise.all([d.tick(), d.tick()]); expect(fetcher).toHaveBeenCalledTimes(1); expect(d.row().stage).toBe('polling');
  });
  it('holds an ambiguous network submission without resubmitting or refunding', async () => {
    const d = await setup(); const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('timeout'));
    await d.tick(); await d.tick(); expect(d.row()).toMatchObject({ stage: 'manual_review', provider_id: null });
    expect(generationResponse(d.row()).statusMessage).toBe('This request needs support review. It will not be retried automatically.');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(d.credits()).toBe(92);
  });
  it('preserves the video safety-review message over the generic manual-review message', async () => {
    const d = await setup();
    const response = generationResponse({ ...d.row(), kind: 'video', stage: 'manual_review', moderation_verdict: 'manual' });
    expect(response.statusMessage).toBe('Safety review needs attention. Your video remains unavailable.');
  });
  it('holds a crashed submission stage without another request', async () => {
    const d = await setup(); d.sqlite.prepare("UPDATE generations SET stage='submitting_generation' WHERE id=?").run(d.id);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Must not resubmit'));
    await d.tick(); expect(d.row().stage).toBe('manual_review'); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([false, true])('refunds an explicit failure once, during polling=%s', async polling => {
    const d = await setup(polling); vi.spyOn(globalThis, 'fetch').mockResolvedValue(polling ? task('fail', { failCode: 'FAILED', failMsg: 'private-detail' }) : Response.json({ code: 422, msg: 'private-detail', data: null }));
    await d.tick(); await d.tick(); expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal' }); expect(d.credits()).toBe(100);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1); expect(d.row().error).not.toContain('private-detail');
  });
  it('retries a transient saved-task query and never submits a replacement', async () => {
    const d = await setup(true); const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({}, { status: 503 })).mockResolvedValueOnce(task('generating'));
    await d.tick(); expect(d.row()).toMatchObject({ status: 'processing', stage: 'polling', provider_id: 'image-task' });
    await d.tick(); expect(d.row().error).toBeNull(); expect(d.credits()).toBe(92);
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });
  it('holds inconsistent completed task identity for review', async () => {
    const d = await setup(true); vi.spyOn(globalThis, 'fetch').mockResolvedValue(task('success', { model: 'another-model', resultJson: JSON.stringify({ resultUrls: [resultUrl] }) }));
    await d.tick(); expect(d.row()).toMatchObject({ stage: 'manual_review', result_keys: null }); expect(d.credits()).toBe(92);
  });
  it.each(['image/png', 'image/jpeg'])('stores completed %s directly as a private image asset without video moderation', async mime => {
    const d = await setup(true); const bytes = new Uint8Array([137, 80, 78, 71]);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async target => String(target).startsWith('https://api.kie.ai/') ? task('success', { resultJson: JSON.stringify({ resultUrls: [resultUrl] }) }) : new Response(bytes, { headers: { 'content-type': mime, 'content-length': '4' } }));
    await d.tick(); await d.tick(); expect(d.row()).toMatchObject({ status: 'completed', stage: 'terminal', moderation_key: null, moderation_verdict: null, progress: 100 });
    const keys = JSON.parse(d.row().result_keys); expect(keys).toHaveLength(1); expect(keys[0]).toMatch(new RegExp(`^users/u/results/${d.id}/[\\w-]+$`));
    expect(d.objects.get(keys[0])).toEqual({ bytes, mime }); expect(generationResponse(d.row())).toMatchObject({ imageUrls: [`/api/media/${keys[0]}`] });
    expect(generationResponse(d.row()).videoUrl).toBeUndefined(); expect(generationResponse(d.row()).audioUrls).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2); expect(d.credits()).toBe(92);
    const token = 'o'.repeat(43); d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
    const response = await serveUserMedia(new Request('https://example.test/api/media/' + keys[0], { headers: { cookie: `migos_session=${token}` } }), d.env, keys[0]);
    expect(response.status).toBe(200); expect(response.headers.get('Content-Type')).toBe(mime); expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    await expect(serveUserMedia(new Request(await signedMediaUrl(d.env, keys[0])), d.env, keys[0])).rejects.toMatchObject({ status: 404 });
    d.sqlite.exec("INSERT INTO users(id,email,name) VALUES('other','other@example.test','Other')");
    const other = 'x'.repeat(43); d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(other), 'other');
    await expect(serveUserMedia(new Request('https://example.test/api/media/' + keys[0], { headers: { cookie: `migos_session=${other}` } }), d.env, keys[0])).rejects.toMatchObject({ status: 404 });
  });
  it.each(['text/html', 'video/mp4', 'image/svg+xml'])('does not expose an unsupported %s result', async mime => {
    const d = await setup(true); vi.spyOn(globalThis, 'fetch').mockImplementation(async target => String(target).startsWith('https://api.kie.ai/') ? task('success', { resultJson: JSON.stringify({ resultUrls: [resultUrl] }) }) : new Response('unsafe', { headers: { 'content-type': mime } }));
    await d.tick(); expect(d.row()).toMatchObject({ status: 'processing', stage: 'polling', result_keys: null }); expect(generationResponse(d.row()).imageUrls).toBeUndefined();
  });
  it('never fetches a result outside the configured allowlist', async () => {
    const d = await setup(true); const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(task('success', { resultJson: JSON.stringify({ resultUrls: ['https://evil.test/a.png'] }) }));
    await d.tick(); expect(fetcher).toHaveBeenCalledTimes(1); expect(d.row().result_keys).toBeNull(); expect(d.credits()).toBe(92);
  });
});
