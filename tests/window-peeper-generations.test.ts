import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import type { GenerationResponse } from '../lib/contracts';
import { POST } from '../app/api/window-peeper/generations/route';
import { GET } from '../app/api/generations/route';

const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));
afterEach(() => vi.restoreAllMocks());

const photo = 'users/u/uploads/portrait';
async function setup() {
  const d = database(), token = 'w'.repeat(43);
  d.sqlite.prepare("UPDATE users SET credits=1000 WHERE id='u'").run();
  d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
  d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(photo, 'u', 'image/png');
  const objects = new Map<string, { size: number; httpMetadata: { contentType: string } }>([
    [photo, { size: 128, httpMetadata: { contentType: 'image/png' } }],
  ]);
  const head = vi.fn(async (key: string) => objects.get(key) ?? null);
  routeEnv.value = { ...jobEnv(d.db), FAL_KEY: 'fal-test-key', FAL_MEDIA_HOSTS: 'v3.fal.media,v3b.fal.media,fal.media', MEDIA: { head } as unknown as R2Bucket };
  const request = (patch: Record<string, unknown> = {}, headers: Record<string, string> = {}) => new Request('https://example.test/api/window-peeper/generations', {
    method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'window-peeper-once', ...headers },
    body: JSON.stringify({ photo, consent: true, ...patch }),
  });
  const credits = () => d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits;
  const jobs = () => d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n;
  return { ...d, objects, request, head, credits, jobs };
}

describe('Window Peeper generation API', () => {
  it.each([false, undefined, null, 1, 'true'])('rejects consent=%s without reserving credits', async consent => {
    const d = await setup();
    const response = await POST(d.request({ consent }), undefined);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/permission|agree/i) });
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(1000);
  });

  it.each([undefined, null, '', 'https://attacker.test/photo.png', 'users/u/uploads/../../portrait', 'users/other/uploads/portrait', 'users/u/results/portrait', 'users/u/uploads/missing'])('rejects invalid or unowned photo %s without charging', async invalidPhoto => {
    const d = await setup();
    expect((await POST(d.request({ photo: invalidPhoto }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(1000);
  });

  it('checks database ownership even when the key matches the current account prefix', async () => {
    const d = await setup();
    d.sqlite.prepare("INSERT INTO users(id,email,name,credits) VALUES('other','other@example.test','Other',100)").run();
    d.sqlite.prepare('UPDATE uploads SET user_id=? WHERE key=?').run('other', photo);
    expect((await POST(d.request(), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
    expect(d.head).not.toHaveBeenCalled();
    expect(d.credits()).toBe(1000);
  });

  it.each(['missing', 'wrong-type', 'mismatch', 'empty', 'oversize', 'reference-media'])('rejects %s storage objects without a debit', async defect => {
    const d = await setup();
    if (defect === 'missing') d.objects.delete(photo);
    if (defect === 'wrong-type') d.objects.set(photo, { size: 128, httpMetadata: { contentType: 'video/mp4' } });
    if (defect === 'mismatch') d.objects.set(photo, { size: 128, httpMetadata: { contentType: 'image/jpeg' } });
    if (defect === 'empty') d.objects.set(photo, { size: 0, httpMetadata: { contentType: 'image/png' } });
    if (defect === 'oversize') d.objects.set(photo, { size: 10 * 1024 * 1024 + 1, httpMetadata: { contentType: 'image/png' } });
    if (defect === 'reference-media') d.sqlite.prepare("UPDATE uploads SET media_kind='video'").run();
    expect((await POST(d.request(), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(1000);
  });

  it('reserves server-owned options once and returns the saved task after a lost submission response', async () => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No provider call during reservation'));
    const first = await POST(d.request({ cost: 1, expectedCredits: 1, provider: 'apimart', model: 'wan-3.0', duration: 5, aspect: '16:9', resolution: '480p', referenceDuration: 1, referencePath: 'https://attacker.test/video.mp4', prompt: 'override', template: 'ozil-goal' }), undefined);
    expect(first.status).toBe(202);
    expect(first.headers.get('Cache-Control')).toBe('no-store');
    const result = await first.json() as GenerationResponse;
    expect(result).toMatchObject({ template: 'window-peeper', status: 'queued' });
    const repeated = await POST(d.request(), undefined);
    expect(repeated.status).toBe(202);
    expect(await repeated.json()).toEqual(result);
    const row = d.sqlite.prepare('SELECT kind,cost,payload FROM generations').get()!;
    expect(row).toMatchObject({ kind: 'video', cost: 300 });
    expect(JSON.parse(String(row.payload))).toEqual({ template: 'window-peeper', provider: 'fal', photo, consent: true,
      model: 'minimax-h3', endpoint: 'minimax/h3/reference-to-video', duration: 15, aspect: '9:16', resolution: '768p',
      referenceDuration: 8.2, referencePath: '/templates/window-peeper/motion.mp4' });
    expect(d.jobs()).toBe(1);
    expect(d.credits()).toBe(700);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
    expect(fetcher).not.toHaveBeenCalled();
    const history = await GET(new Request('https://example.test/api/generations', { headers: { cookie: d.request().headers.get('cookie')! } }), undefined);
    expect(await history.json()).toMatchObject({ generations: [{ id: result.id, template: 'window-peeper', cost: 300 }] });
  });

  it('uses the same implicit retry key for the same photo within a minute', async () => {
    const d = await setup();
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const request = () => { const r = d.request(); r.headers.delete('Idempotency-Key'); return r; };
    const first = await POST(request(), undefined), second = await POST(request(), undefined);
    expect(first.status).toBe(202);
    expect(await second.json()).toEqual(await first.json());
    expect(d.credits()).toBe(700);
    expect(d.jobs()).toBe(1);
  });

  it('rejects reusing a request key for another authorized photo', async () => {
    const d = await setup(), second = 'users/u/uploads/second';
    expect((await POST(d.request(), undefined)).status).toBe(202);
    d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(second, 'u', 'image/png');
    d.objects.set(second, { size: 128, httpMetadata: { contentType: 'image/png' } });
    expect((await POST(d.request({ photo: second }), undefined)).status).toBe(409);
    expect(d.jobs()).toBe(1);
    expect(d.credits()).toBe(700);
  });

  it('enforces the full price while permitting the same key after a top-up', async () => {
    const d = await setup();
    d.sqlite.prepare("UPDATE users SET credits=299 WHERE id='u'").run();
    expect((await POST(d.request({ cost: 1 }), undefined)).status).toBe(402);
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(299);
    d.sqlite.prepare("UPDATE users SET credits=300 WHERE id='u'").run();
    expect((await POST(d.request(), undefined)).status).toBe(202);
    expect(d.credits()).toBe(0);
  });

  it('requires same-origin authentication before checking photos', async () => {
    const d = await setup();
    expect((await POST(d.request({}, { origin: 'https://attacker.test' }), undefined)).status).toBe(403);
    expect((await POST(d.request({}, { cookie: '' }), undefined)).status).toBe(401);
    expect((await POST(d.request({}, { 'sec-fetch-site': 'cross-site' }), undefined)).status).toBe(403);
    expect(d.head).not.toHaveBeenCalled();
    expect(d.jobs()).toBe(0);
  });

  it.each(['FAL_KEY', 'FAL_MEDIA_HOSTS', 'MEDIA_SIGNING_SECRET', 'SEEAPI_API_KEY', 'MEDIA'])('rejects missing %s before charging', async key => {
    const d = await setup(); delete routeEnv.value[key];
    expect((await POST(d.request(), undefined)).status).toBe(503);
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(1000);
  });

  it('can recover an existing reservation while Fal is unavailable', async () => {
    const d = await setup();
    const first = await POST(d.request(), undefined);
    expect(first.status).toBe(202);
    delete routeEnv.value.FAL_KEY;
    const retry = await POST(d.request(), undefined);
    expect(retry.status).toBe(202);
    expect(await retry.json()).toEqual(await first.json());
    expect((await POST(d.request({}, { 'Idempotency-Key': 'new-during-outage' }), undefined)).status).toBe(503);
    expect(d.jobs()).toBe(1);
    expect(d.credits()).toBe(700);
  });

  it('rejects malformed bodies and request identifiers without creating jobs', async () => {
    const d = await setup();
    for (const body of ['{', 'null', '[]']) {
      const r = d.request();
      expect((await POST(new Request(r.url, { method: 'POST', headers: r.headers, body }), undefined)).status).toBe(400);
    }
    expect((await POST(d.request({}, { 'Idempotency-Key': 'bad' }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
  });
});
