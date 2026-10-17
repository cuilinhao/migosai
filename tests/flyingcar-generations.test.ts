import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import { getFlyingCarCost } from '../lib/flyingcar';
import { getVideoCost } from '../lib/video-options';
import { POST } from '../app/api/flyingcar/generations/route';
import { GET } from '../app/api/generations/route';
import { readFileSync } from 'node:fs';

const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));
afterEach(() => vi.restoreAllMocks());
const photo = 'users/u/uploads/car';
const prompt = '  A silver car rises above the city.\nTrack its flight through sunset clouds.  ';
const imageBytes = new Uint8Array(readFileSync(new URL('./fixtures/flyingcar-images/320x480.png', import.meta.url)));
async function setup() {
  const d = database(), token = 'c'.repeat(43);
  d.sqlite.prepare("UPDATE users SET credits=1000 WHERE id='u'").run();
  d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
  d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(photo, 'u', 'image/png');
  const objects = new Map<string, { size: number; httpMetadata: { contentType: string } }>([[photo, { size: imageBytes.length, httpMetadata: { contentType: 'image/png' } }]]);
  const head = vi.fn(async (key: string) => { const object = objects.get(key); return object ? { ...object, etag: 'image-etag' } : null; });
  const get = vi.fn(async (key: string) => { const object = objects.get(key); return object ? { ...object, etag: 'image-etag', arrayBuffer: async () => imageBytes.slice().buffer } : null; });
  routeEnv.value = { ...jobEnv(d.db), KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com', MEDIA: { head, get } as unknown as R2Bucket };
  const request = (patch: Record<string, unknown> = {}, headers: Record<string, string> = {}) => new Request('https://example.test/api/flyingcar/generations', {
    method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'flyingcar-generation-once', ...headers },
    body: JSON.stringify({ prompt, duration: 10, ...patch }),
  });
  const credits = () => d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits;
  const jobs = () => d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n;
  return { ...d, objects, request, head, credits, jobs };
}

describe('FlyingCar public quotes and reservations', () => {
  it.each([[5, 50], [8, 65], [10, 75], [11, 90], [15, 150], [16, 165], [20, 225], [25, 300], [30, 375]])('quotes %ss at %s shared credits', (duration, credits) => {
    expect(getFlyingCarCost(duration)).toBe(credits);
    if (duration <= 15) expect(getFlyingCarCost(duration)).toBe(getVideoCost(duration, '480p', 'seedance-2'));
  });
  it.each([4, 0, 31, 5.5, NaN, Infinity])('rejects invalid quote duration %s', duration => expect(() => getFlyingCarCost(duration)).toThrow());

  it('reserves text-only without touching uploads, preserving the prompt and ignoring client pricing/model overrides', async () => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Reservation must not call providers'));
    const response = await POST(d.request({ duration: 30, cost: 1, expectedCredits: 1, provider: 'fal', model: 'minimax-h3', resolution: '1080p', aspect: '16:9', generateAudio: true, generate_audio: true, referenceVideo: 'attacker', referencePath: 'https://attacker.test/video.mp4' }), undefined);
    expect(response.status).toBe(202);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(d.head).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    const row = d.sqlite.prepare('SELECT kind,cost,payload FROM generations').get()!;
    expect(row).toMatchObject({ kind: 'video', cost: 375 });
    expect(JSON.parse(String(row.payload))).toEqual({ template: 'flyingcar', provider: 'kie', model: 'seedance-2-5', duration: 30, resolution: '480p', aspect: '9:16', generateAudio: false, prompt: prompt.trim() });
    expect(d.credits()).toBe(625);
  });

  it('accepts an owned optional photo only with affirmative consent', async () => {
    const d = await setup();
    expect((await POST(d.request({ photo, consent: true }), undefined)).status).toBe(202);
    expect(JSON.parse(String(d.sqlite.prepare('SELECT payload FROM generations').get()?.payload))).toMatchObject({ photo, consent: true });
    expect(d.credits()).toBe(925);
  });
  it.each([undefined, false, 'true', 1, null])('rejects photo consent=%s without charging', async consent => {
    const d = await setup();
    expect((await POST(d.request({ photo, consent }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(1000);
  });
  it.each([null, '', 'https://attacker.test/car.png', 'users/other/uploads/car', 'users/u/uploads/../car', 'users/u/results/car', 'users/u/uploads/missing'])('rejects unowned or invalid optional photo %s', async value => {
    const d = await setup();
    expect((await POST(d.request({ photo: value, consent: true }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
    expect(d.credits()).toBe(1000);
  });
  it('checks database ownership even when the key uses the current user prefix', async () => {
    const d = await setup();
    d.sqlite.prepare("INSERT INTO users(id,email,name,credits) VALUES('other','other@example.test','Other',100)").run();
    d.sqlite.prepare('UPDATE uploads SET user_id=? WHERE key=?').run('other', photo);
    expect((await POST(d.request({ photo, consent: true }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
    expect(d.head).not.toHaveBeenCalled();
  });
  it.each(['missing', 'wrong-type', 'mismatch', 'empty', 'oversize', 'reference-media'])('rejects %s photo storage objects', async defect => {
    const d = await setup();
    if (defect === 'missing') d.objects.delete(photo);
    if (defect === 'wrong-type') d.objects.set(photo, { size: 128, httpMetadata: { contentType: 'video/mp4' } });
    if (defect === 'mismatch') d.objects.set(photo, { size: 128, httpMetadata: { contentType: 'image/jpeg' } });
    if (defect === 'empty') d.objects.set(photo, { size: 0, httpMetadata: { contentType: 'image/png' } });
    if (defect === 'oversize') d.objects.set(photo, { size: 10 * 1024 * 1024 + 1, httpMetadata: { contentType: 'image/png' } });
    if (defect === 'reference-media') d.sqlite.prepare("UPDATE uploads SET media_kind='video' WHERE key=?").run(photo);
    expect((await POST(d.request({ photo, consent: true }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
  });
  it.each([4, 31, 5.5, null, '10', undefined])('rejects invalid duration %s before charging', async duration => {
    const d = await setup();
    expect((await POST(d.request({ duration }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
  });
  it.each([undefined, null, '', '  ', 'a'.repeat(11), 'a'.repeat(601), 123, {}])('rejects missing, oversize or invalid prompt %#', async value => {
    const d = await setup();
    expect((await POST(d.request({ prompt: value }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
  });
  it.each([12, 600])('accepts a trimmed prompt of exactly %s characters', async length => {
    const d = await setup();
    expect((await POST(d.request({ prompt: `  ${'a'.repeat(length)}  ` }), undefined)).status).toBe(202);
    expect(JSON.parse(String(d.sqlite.prepare('SELECT payload FROM generations').get()?.payload)).prompt).toBe('a'.repeat(length));
  });
  it('recovers the same reservation when only surrounding prompt whitespace differs', async () => {
    const d = await setup();
    const first = await POST(d.request(), undefined);
    const retry = await POST(d.request({ prompt: prompt.trim() }), undefined);
    expect(retry.status).toBe(202);
    expect(await retry.json()).toEqual(await first.json());
    expect(d.credits()).toBe(925);
  });
  it.each([true, false])('deduplicates an identical retry with explicit key=%s', async explicit => {
    const d = await setup();
    const request = () => { const r = d.request(); if (!explicit) r.headers.delete('Idempotency-Key'); return r; };
    const first = await POST(request(), undefined), second = await POST(request(), undefined);
    expect(first.status).toBe(202);
    expect(await second.json()).toEqual(await first.json());
    expect(d.credits()).toBe(925);
    expect(d.jobs()).toBe(1);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
  });
  it.each([{ duration: 30 }, { prompt: 'A blue car takes off from a bridge.' }, { photo, consent: true }])('rejects a changed request using an existing key %#', async patch => {
    const d = await setup();
    await POST(d.request(), undefined);
    expect((await POST(d.request(patch), undefined)).status).toBe(409);
    expect(d.jobs()).toBe(1);
    expect(d.credits()).toBe(925);
  });
  it('enforces the real quote and allows a retry after credits are purchased', async () => {
    const d = await setup();
    d.sqlite.prepare("UPDATE users SET credits=374 WHERE id='u'").run();
    expect((await POST(d.request({ duration: 30, cost: 1 }), undefined)).status).toBe(402);
    expect(d.jobs()).toBe(0);
    d.sqlite.prepare("UPDATE users SET credits=375 WHERE id='u'").run();
    expect((await POST(d.request({ duration: 30 }), undefined)).status).toBe(202);
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
  it.each(['KIE_API_KEY', 'KIE_MEDIA_HOSTS', 'MEDIA_SIGNING_SECRET', 'SEEAPI_API_KEY', 'MEDIA'])('rejects missing %s before debit', async key => {
    const d = await setup(); delete routeEnv.value[key];
    expect((await POST(d.request(), undefined)).status).toBe(503);
    expect(d.jobs()).toBe(0);
  });
  it('recovers an already reserved job if the provider is temporarily unconfigured', async () => {
    const d = await setup(); const first = await POST(d.request(), undefined);
    delete routeEnv.value.KIE_API_KEY;
    const retry = await POST(d.request(), undefined);
    expect(retry.status).toBe(202);
    expect(await retry.json()).toEqual(await first.json());
    expect(d.credits()).toBe(925);
  });
  it('rejects malformed JSON, arrays and invalid request identifiers', async () => {
    const d = await setup();
    for (const body of ['{', 'null', '[]']) {
      const valid = d.request();
      expect((await POST(new Request(valid.url, { method: 'POST', headers: valid.headers, body }), undefined)).status).toBe(400);
    }
    expect((await POST(d.request({}, { 'Idempotency-Key': 'bad' }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0);
  });
  it('exposes only the template discriminator in shared history', async () => {
    const d = await setup(); await POST(d.request({ photo, consent: true }), undefined);
    const response = await GET(new Request('https://example.test/api/generations', { headers: d.request().headers }), undefined);
    expect(response.status).toBe(200);
    const body = await response.json() as { generations: Record<string, unknown>[] };
    expect(body.generations[0]).toMatchObject({ template: 'flyingcar', cost: 75, kind: 'video' });
    expect(JSON.stringify(body)).not.toContain(prompt.trim());
    expect(JSON.stringify(body)).not.toContain(photo);
  });
});
