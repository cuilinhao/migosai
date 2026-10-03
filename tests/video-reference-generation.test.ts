import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import { advanceJob, generationResponse } from '../lib/server/jobs';
import { saveReferenceUpload } from '../lib/server/reference-uploads';
import { POST } from '../app/api/generations/route';
const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));
import { createGeneration } from '../lib/server/generations';
afterEach(() => vi.restoreAllMocks());
async function setup() {
  const d = database(), token = 'r'.repeat(43);
  routeEnv.value = { ...jobEnv(d.db), KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com' };
  d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
  for (const key of ['left', 'right']) d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(key, 'u', 'image/png');
  d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type,media_kind,duration,has_audio) VALUES(?,?,?,?,?,?)').run('video', 'u', 'video/mp4', 'video', 4.9, 0);
  d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type,media_kind,duration,has_audio) VALUES(?,?,?,?,?,?)').run('audio', 'u', 'audio/wav', 'audio', 4.9, 1);
  const body = { leftImage: 'left', rightImage: 'right', aspect: '16:9', duration: 5, resolution: '480p', model: 'wan-3.0', scene: 'hotel-lobby', motion: 'video', soundtrack: 'song', referenceVideo: 'video', referenceAudio: 'audio' };
  const request = (patch = {}) => new Request('https://example.test/api/generations', { method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'reference-create-once' }, body: JSON.stringify({ ...body, ...patch }) });
  return { ...d, request };
}
describe('custom generation reservation', () => {
  it('reserves actual model, motion and audio once and bills measured reference seconds', async () => {
    const d = await setup();
    const first = await (await createGeneration(d.request({ expectedCredits: 1, referenceDuration: 0 }), 'video')).json() as { id: string };
    const second = await (await createGeneration(d.request(), 'video')).json() as { id: string };
    expect(first.id).toBe(second.id);
    const row = d.sqlite.prepare('SELECT cost,payload FROM generations').get()!;
    expect(row.cost).toBe(30); // ceil((5 output + 4.9 actual reference) * 3)
    expect(JSON.parse(String(row.payload))).toMatchObject({ provider: 'kie', model: 'wan-3.0', motion: 'video', soundtrack: 'song', referenceVideo: 'video', referenceAudio: 'audio' });
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(70);
    expect(d.sqlite.prepare('SELECT count(*) n FROM credit_ledger').get()?.n).toBe(1);
  });
  it('does not reserve or deduct credits for missing or mis-typed media', async () => {
    const d = await setup();
    await expect(createGeneration(d.request({ referenceAudio: 'left' }), 'video')).rejects.toThrow();
    await expect(createGeneration(d.request({ referenceVideo: 'unknown' }), 'video')).rejects.toThrow();
    await expect(createGeneration(d.request({ duration: 15 }), 'video')).rejects.toThrow();
    expect(d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n).toBe(0);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);
  });

  it('returns 402 for the measured price and can reserve the same request after sufficient credits are available', async () => {
    const d = await setup();
    d.sqlite.prepare("UPDATE users SET credits=29 WHERE id='u'").run();
    const rejected = await POST(d.request({ expectedCredits: 1, referenceDuration: 0 }), undefined);
    expect(rejected.status).toBe(402);
    expect(await rejected.json()).toEqual({ error: 'Not enough credits. Please purchase a credit pack.' });
    expect(d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n).toBe(0);
    expect(d.sqlite.prepare('SELECT count(*) n FROM credit_ledger').get()?.n).toBe(0);
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits).toBe(29);

    d.sqlite.prepare("UPDATE users SET credits=30 WHERE id='u'").run();
    expect((await POST(d.request(), undefined)).status).toBe(202);
    expect(d.sqlite.prepare('SELECT cost FROM generations').get()?.cost).toBe(30);
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits).toBe(0);
    expect(d.sqlite.prepare('SELECT count(*) n FROM credit_ledger').get()?.n).toBe(1);
  });

  it.each(['referenceVideo', 'referenceAudio'] as const)('rejects a foreign %s even when both photos belong to the caller', async field => {
    const d = await setup();
    d.sqlite.prepare('INSERT INTO users(id,email,name,credits) VALUES(?,?,?,?)').run('other', 'other@example.test', 'Other', 100);
    d.sqlite.prepare('UPDATE uploads SET user_id=? WHERE key=?').run('other', field === 'referenceVideo' ? 'video' : 'audio');
    const response = await POST(d.request(), undefined);
    expect(response.status).toBe(400);
    expect(d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n).toBe(0);
    expect(d.sqlite.prepare('SELECT count(*) n FROM credit_ledger').get()?.n).toBe(0);
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits).toBe(100);
  });

  it('does not reserve while reference storage is still pending and succeeds only after upload completion', async () => {
    const d = await setup();
    let savedKey = '', markStarted!: () => void, finishStorage!: () => void;
    const storageStarted = new Promise<void>(resolve => { markStarted = resolve; });
    const storageFinished = new Promise<void>(resolve => { finishStorage = resolve; });
    routeEnv.value.MEDIA = { put: vi.fn(async (key: string) => { savedKey = key; markStarted(); await storageFinished; }), delete: vi.fn() };
    const form = new FormData();
    form.set('kind', 'video');
    form.set('file', new File([readFileSync(new URL('./fixtures/reference-media/silent.mp4', import.meta.url))], 'motion.mp4', { type: 'video/mp4' }));
    const uploading = saveReferenceUpload(new Request('https://example.test/api/reference-uploads', {
      method: 'POST', headers: { origin: 'https://example.test', cookie: d.request().headers.get('cookie')! }, body: form,
    }), routeEnv.value);
    await storageStarted;
    try {
      const early = await POST(d.request({ duration: 4, referenceVideo: savedKey }), undefined);
      expect(early.status).toBe(400);
      expect(d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n).toBe(0);
      expect(d.sqlite.prepare('SELECT count(*) n FROM credit_ledger').get()?.n).toBe(0);
      expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits).toBe(100);
    } finally { finishStorage(); }
    const uploaded = await uploading;
    expect(uploaded.status).toBe(201);
    expect((await POST(d.request({ duration: 4, referenceVideo: savedKey }), undefined)).status).toBe(202);
    expect(d.sqlite.prepare('SELECT cost FROM generations').get()?.cost).toBe(24);
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits).toBe(76);
  });

  it.each(['referenceVideo', 'referenceAudio'] as const)('does not replace %s on an already reserved request identifier', async field => {
    const d = await setup(), originalKey = field === 'referenceVideo' ? 'video' : 'audio';
    d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type,media_kind,duration,has_audio) SELECT ?,user_id,content_type,media_kind,duration,has_audio FROM uploads WHERE key=?').run('replacement', originalKey);
    expect((await POST(d.request(), undefined)).status).toBe(202);
    expect((await POST(d.request({ [field]: 'replacement' }), undefined)).status).toBe(409);
    expect(JSON.parse(String(d.sqlite.prepare('SELECT payload FROM generations').get()?.payload))[field]).toBe(originalKey);
    expect(d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n).toBe(1);
    expect(d.sqlite.prepare('SELECT count(*) n FROM credit_ledger').get()?.n).toBe(1);
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits).toBe(70);
  });

  it.each([
    ['wan-3.0', 30], ['seedance-2', 50], ['seedance-2-fast', 40],
  ] as const)('refunds the actual %s reservation once after a definitive submission rejection', async (model, cost) => {
    const d = await setup();
    const patch = model === 'wan-3.0' ? { model } : { model, soundtrack: 'ai', referenceAudio: undefined };
    const created = await (await POST(d.request(patch), undefined)).json() as { id: string };
    expect(d.sqlite.prepare('SELECT cost FROM generations').get()?.cost).toBe(cost);
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits).toBe(100 - cost);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 422, msg: 'private provider detail', data: null }));
    await advanceJob(routeEnv.value, created.id);
    d.sqlite.prepare('UPDATE generations SET next_poll=0 WHERE id=?').run(created.id);
    await advanceJob(routeEnv.value, created.id);
    expect(d.sqlite.prepare('SELECT status,stage,error FROM generations').get()).toMatchObject({ status: 'failed', stage: 'terminal', error: expect.not.stringContaining('private') });
    expect(d.sqlite.prepare('SELECT kind,amount FROM credit_ledger ORDER BY amount').all()).toEqual([
      { kind: 'generation', amount: -cost }, { kind: 'refund', amount: cost },
    ]);
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits).toBe(100);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.method).toBe('POST');
  });

  it('returns the measured Wan debit once when the generated candidate is blocked by safety review', async () => {
    const d = await setup();
    const created = await (await POST(d.request(), undefined)).json() as { id: string };
    const row = () => d.sqlite.prepare('SELECT * FROM generations WHERE id=?').get(created.id) as any;
    const tick = async () => { d.sqlite.prepare('UPDATE generations SET next_poll=0 WHERE id=?').run(created.id); await advanceJob(routeEnv.value, created.id); };
    const deleteObject = vi.fn(async () => {});
    routeEnv.value.MEDIA = {
      createMultipartUpload: async () => ({ uploadPart: async (partNumber: number) => ({ partNumber, etag: 'part' }), complete: async () => ({}), abort: async () => {} }),
      head: async () => ({ etag: 'wan-candidate' }), delete: deleteObject,
    };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected external request'))
      .mockResolvedValueOnce(Response.json({ code: 200, data: { taskId: 'wan_task' } }))
      .mockResolvedValueOnce(Response.json({ code: 200, data: { taskId: 'wan_task', model: 'wan/3-0-video', state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://tempfile.aiquickdraw.com/wan.mp4'] }) } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0, 1, 2, 3]), { headers: { 'content-type': 'video/mp4', 'content-length': '4' } }))
      .mockResolvedValueOnce(Response.json({ id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'queued', result: null, error: null }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'succeeded', error: null, result: { type: 'json', data: { flagged: true, reason: 'content_policy_blocked', output: null } } }));
    await tick(); // Kie submission.
    await tick(); // Download into the private moderation candidate.
    expect(row()).toMatchObject({ stage: 'moderation_submitting', result_keys: null });
    expect(generationResponse(row()).videoUrl).toBeUndefined();
    await tick(); // Submit safety review.
    await tick(); // Receive the blocked verdict and return the stored debit.
    await tick(); // A terminal repeat must not refund or query again.
    expect(row()).toMatchObject({ status: 'failed', stage: 'terminal', moderation_verdict: 'blocked', result_keys: null });
    expect(generationResponse(row()).videoUrl).toBeUndefined();
    expect(d.sqlite.prepare('SELECT kind,amount FROM credit_ledger ORDER BY amount').all()).toEqual([
      { kind: 'generation', amount: -30 }, { kind: 'refund', amount: 30 },
    ]);
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits).toBe(100);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(deleteObject).toHaveBeenCalledExactlyOnceWith(row().moderation_key);
  });
});
