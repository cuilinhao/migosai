import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import { OZIL_GOAL_COST } from '../lib/ozil-goal';
import { reserveGeneration } from '../lib/server/billing';
import * as availability from '../lib/video-availability';
import { POST } from '../app/api/ozil-goal/generations/route';

const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));
afterEach(() => vi.restoreAllMocks());

const photo = 'users/u/uploads/portrait';
async function generationId(response: Response): Promise<string> {
  return (await response.json() as { id: string }).id;
}
async function setup() {
  const d = database(), token = 'o'.repeat(43);
  d.sqlite.prepare("UPDATE users SET credits=1000 WHERE id='u'").run();
  d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
  d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(photo, 'u', 'image/png');
  const objects = new Map<string, { size: number; httpMetadata: { contentType: string } }>([
    [photo, { size: 128, httpMetadata: { contentType: 'image/png' } }],
  ]);
  const head = vi.fn(async (key: string) => objects.get(key) ?? null);
  const env = { ...jobEnv(d.db), FAL_KEY: 'fal-test-key', FAL_MEDIA_HOSTS: 'v3.fal.media,v3b.fal.media,fal.media', MEDIA: { head } as unknown as R2Bucket };
  routeEnv.value = env;
  const request = (patch: Record<string, unknown> = {}, headers: Record<string, string> = {}) => new Request('https://example.test/api/ozil-goal/generations', {
    method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'ozil-generation-once', ...headers },
    body: JSON.stringify({ photo, consent: true, ...patch }),
  });
  const credits = () => d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits;
  const jobs = () => d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n;
  return { ...d, env, objects, request, head, credits, jobs };
}

describe('Ozil generation API', () => {
  it.each([false, undefined, null, 1, 'true'])('rejects consent=%s before reserving any credits', async consent => {
    const d = await setup();
    const response = await POST(d.request({ consent }), undefined);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/consent|permission|agree/i) });
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(1000);
  });

  it.each([
    undefined, null, '', 'https://attacker.test/portrait.png', 'users/u/uploads/../../portrait',
    'users/other/uploads/portrait', 'users/u/results/portrait', 'users/u/uploads/missing',
  ])('rejects an invalid or unowned photo %s without charging', async invalidPhoto => {
    const d = await setup();
    const response = await POST(d.request({ photo: invalidPhoto }), undefined);
    expect(response.status).toBe(400);
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(1000);
  });

  it('checks database ownership even when the photo key uses the current user prefix', async () => {
    const d = await setup();
    d.sqlite.prepare("INSERT INTO users(id,email,name,credits) VALUES('other','other@example.test','Other',100)").run();
    d.sqlite.prepare('UPDATE uploads SET user_id=? WHERE key=?').run('other', photo);
    expect((await POST(d.request(), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
    expect(d.head).not.toHaveBeenCalled();
  });

  it.each(['missing', 'wrong-type', 'mismatch', 'empty', 'oversize', 'reference-media'])('rejects %s storage objects before charging', async defect => {
    const d = await setup();
    if (defect === 'missing') d.objects.delete(photo);
    if (defect === 'wrong-type') d.objects.set(photo, { size: 128, httpMetadata: { contentType: 'video/mp4' } });
    if (defect === 'mismatch') d.objects.set(photo, { size: 128, httpMetadata: { contentType: 'image/jpeg' } });
    if (defect === 'empty') d.objects.set(photo, { size: 0, httpMetadata: { contentType: 'image/png' } });
    if (defect === 'oversize') d.objects.set(photo, { size: 10 * 1024 * 1024 + 1, httpMetadata: { contentType: 'image/png' } });
    if (defect === 'reference-media') d.sqlite.prepare("UPDATE uploads SET content_type='video/mp4',media_kind='video' WHERE key=?").run(photo);
    expect((await POST(d.request(), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(1000);
  });

  it('reserves the fixed model, cost and motion once regardless of client overrides', async () => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No provider call during reservation'));
    const first = await POST(d.request({ cost: 1, expectedCredits: 1, model: 'wan-3.0', provider: 'apimart', duration: 5, aspect: '16:9', resolution: '480p', referenceDuration: 1, referencePath: 'https://attacker.test/video.mp4', referenceVideo: 'users/u/uploads/other', prompt: 'override', leftImage: 'anything', generate_audio: false }), undefined);
    expect(first.status).toBe(202);
    expect(first.headers.get('Cache-Control')).toBe('no-store');
    const repeated = await POST(d.request(), undefined);
    expect(repeated.status).toBe(202);
    expect(await generationId(repeated)).toBe(await generationId(first));
    const row = d.sqlite.prepare('SELECT kind,cost,payload FROM generations').get()!;
    expect(row).toMatchObject({ kind: 'video', cost: 300 });
    expect(row.cost).toBe(OZIL_GOAL_COST);
    expect(JSON.parse(String(row.payload))).toEqual({
      template: 'ozil-goal', provider: 'fal', photo, consent: true,
      model: 'minimax-h3', duration: 15, aspect: '9:16', resolution: '768p',
      endpoint: 'minimax/h3/reference-to-video',
      referenceDuration: 15, referencePath: '/templates/ozil-goal/motion.mp4',
    });
    expect(d.credits()).toBe(700);
    expect(d.jobs()).toBe(1);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('deduplicates requests without an explicit idempotency key using the template and photo', async () => {
    const d = await setup();
    const request = () => { const r = d.request(); r.headers.delete('Idempotency-Key'); return r; };
    const first = await POST(request(), undefined), second = await POST(request(), undefined);
    expect(first.status).toBe(202);
    expect(await generationId(second)).toBe(await generationId(first));
    expect(d.credits()).toBe(700);
  });

  it('rejects reusing a request key for a different portrait', async () => {
    const d = await setup(), second = 'users/u/uploads/second';
    expect((await POST(d.request(), undefined)).status).toBe(202);
    d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(second, 'u', 'image/png');
    d.objects.set(second, { size: 128, httpMetadata: { contentType: 'image/png' } });
    expect((await POST(d.request({ photo: second }), undefined)).status).toBe(409);
    expect(d.jobs()).toBe(1);
    expect(d.credits()).toBe(700);
  });

  it('requires enough credits for the server price and permits a retry after top-up', async () => {
    const d = await setup();
    d.sqlite.prepare("UPDATE users SET credits=299 WHERE id='u'").run();
    expect((await POST(d.request({ cost: 1 }), undefined)).status).toBe(402);
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(299);
    d.sqlite.prepare("UPDATE users SET credits=300 WHERE id='u'").run();
    expect((await POST(d.request(), undefined)).status).toBe(202);
    expect(d.credits()).toBe(0);
  });

  it('requires same-origin authentication before accessing uploads', async () => {
    const d = await setup();
    expect((await POST(d.request({}, { origin: 'https://attacker.test' }), undefined)).status).toBe(403);
    expect((await POST(d.request({}, { cookie: '' }), undefined)).status).toBe(401);
    expect((await POST(d.request({}, { 'sec-fetch-site': 'cross-site' }), undefined)).status).toBe(403);
    expect(d.head).not.toHaveBeenCalled();
    expect(d.jobs()).toBe(0);
  });

  it.each(['FAL_KEY', 'FAL_MEDIA_HOSTS', 'MEDIA_SIGNING_SECRET', 'SEEAPI_API_KEY', 'MEDIA'])('rejects missing %s before creating a debit', async key => {
    const d = await setup();
    delete routeEnv.value[key];
    expect((await POST(d.request(), undefined)).status).toBe(503);
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(1000);
  });

  it('rejects invalid JSON, non-object input and invalid request identifiers', async () => {
    const d = await setup();
    for (const body of ['{', 'null', '[]']) {
      const valid = d.request();
      expect((await POST(new Request(valid.url, { method: 'POST', headers: valid.headers, body }), undefined)).status).toBe(400);
    }
    expect((await POST(d.request({}, { 'Idempotency-Key': 'bad' }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
  });

  it('keeps Fal available during a Seedance outage', async () => {
    const d = await setup();
    const first = await POST(d.request(), undefined);
    expect(first.status).toBe(202);
    vi.spyOn(availability, 'getVideoModelUnavailableReason').mockReturnValue('Seedance is unavailable.');
    const repeated = await POST(d.request(), undefined);
    expect(await generationId(repeated)).toBe(await generationId(first));
    expect((await POST(d.request({}, { 'Idempotency-Key': 'ozil-new-during-outage' }), undefined)).status).toBe(202);
    expect(d.jobs()).toBe(2);
    expect(d.credits()).toBe(400);
  });

  it.each([true, false])('preserves an earlier Kie reservation across provider defaults (explicit key: %s)', async explicit => {
    const d = await setup();
    const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now);
    const payload = { template: 'ozil-goal', provider: 'kie', photo, consent: true,
      model: 'seedance-2', duration: 15, aspect: '9:16', resolution: '720p', referenceDuration: 15, referencePath: '/templates/ozil-goal/motion.mp4' };
    const key = explicit ? 'ozil-generation-once' : await sha256(`ozil-goal:${JSON.stringify(payload)}:${Math.floor(now / 60000)}`);
    const original = await reserveGeneration(d.db, 'u', key, 'video', payload, 300);
    const request = d.request(); if (!explicit) request.headers.delete('Idempotency-Key');
    // Saved tasks must remain recoverable even if the new provider is unavailable.
    delete routeEnv.value.FAL_KEY;
    const response = await POST(request, undefined);
    expect(response.status).toBe(202);
    expect(await generationId(response)).toBe(original.id);
    expect(JSON.parse(String(d.sqlite.prepare('SELECT payload FROM generations').get()?.payload))).toEqual(payload);
    expect(d.credits()).toBe(700);
    expect(d.jobs()).toBe(1);
  });
});
