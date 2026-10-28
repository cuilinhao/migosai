import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import { POST } from '../app/api/gangnam-style/generations/route';
import { GET } from '../app/api/generations/route';
import { getGangnamStyleCost } from '../lib/gangnam-style';
import { reserveGeneration } from '../lib/server/billing';

const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));
afterEach(() => vi.restoreAllMocks());
const photos = ['users/u/uploads/middle', 'users/u/uploads/right', 'users/u/uploads/left'];
const fixture = (name = '320x480.png') => new Uint8Array(readFileSync(new URL(`./fixtures/flyingcar-images/${name}`, import.meta.url)));
async function setup() {
  const d = database(), token = 'g'.repeat(43);
  d.sqlite.prepare("UPDATE users SET credits=1000 WHERE id='u'").run();
  d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
  const objects = new Map(photos.map(key => [key, { bytes: fixture(), mime: 'image/png' }]));
  for (const photo of photos) d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(photo, 'u', 'image/png');
  const metadata = (key: string) => { const object = objects.get(key); return object ? { size: object.bytes.length, etag: key, httpMetadata: { contentType: object.mime } } : null; };
  const head = vi.fn(async (key: string) => metadata(key));
  const get = vi.fn(async (key: string) => { const object = objects.get(key); return object ? { ...metadata(key), arrayBuffer: async () => object.bytes.slice().buffer } : null; });
  routeEnv.value = { ...jobEnv(d.db), KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com', FAL_KEY: 'fal-test-key', FAL_MEDIA_HOSTS: 'v3.fal.media', MEDIA: { head, get } };
  const request = (patch: Record<string, unknown> = {}, headers: Record<string, string> = {}) => new Request('https://example.test/api/gangnam-style/generations', {
    method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'gangnam-generation-once', ...headers },
    body: JSON.stringify({ mode: 'friends', photos, aspect: '16:9', resolution: '480p', consent: true, ...patch }),
  });
  const credits = () => d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits;
  const jobs = () => d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n;
  const payload = () => JSON.parse(String(d.sqlite.prepare('SELECT payload FROM generations').get()?.payload));
  return { ...d, objects, request, head, get, credits, jobs, payload };
}
async function reserveLegacy(d: Awaited<ReturnType<typeof setup>>, aspect = '16:9', userId = 'u', template = 'gangnam-style', kind = 'video') {
  return reserveGeneration(d.db, userId, 'gangnam-generation-once', kind, {
    template, provider: 'kie', model: 'seedance-2-5', prompt: 'Previously reserved direction.', duration: 15,
    mode: 'friends', photos, aspect, resolution: '480p', consent: true, generateAudio: false,
  }, 150);
}

describe('Gangnam Style reservations', () => {
  it.each([['480p', 150], ['720p', 300]] as const)('quotes and charges %s at %s shared credits', async (resolution, cost) => {
    const d = await setup();
    const response = await POST(d.request({ resolution, cost: 1, prompt: 'malicious override', model: 'wan-3.0', provider: 'fal', duration: 1, generateAudio: true, generate_audio: true }), undefined);
    expect(response.status).toBe(202);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(getGangnamStyleCost(resolution)).toBe(cost);
    expect(d.credits()).toBe(1000 - cost);
    expect(d.payload()).toMatchObject({ template: 'gangnam-style', workflow: 'reference-edit-v1', soundtrack: 'gangnam-style-v1', provider: 'kie', model: 'seedance-2-5', duration: 15, aspect: '16:9', generateAudio: false, photos, consent: true, mode: 'friends', resolution });
    expect(d.payload().prompt).not.toContain('malicious override');
    expect(d.payload().prompt).toContain('screen-left is @Image3, center is @Image1, screen-right is @Image2');
    expect(d.payload().prompt).toContain('2-4.9 seconds is @Image1; 4.9-8.4 seconds is @Image2; 8.4-12.3 seconds is @Image3');
  });
  it.each(['9:16', '1:1', '4:3', '3:4', '21:9', 'auto', 'adaptive', '', null])('rejects unsupported aspect %s before uploads or charging', async aspect => {
    const d = await setup(); expect((await POST(d.request({ aspect }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0); expect(d.credits()).toBe(1000); expect(d.head).not.toHaveBeenCalled();
  });
  it.each(['reference-edit-v1', 'legacy', '', null, {}])('rejects a client-owned workflow %# before uploads or charging', async workflow => {
    const d = await setup(); expect((await POST(d.request({ workflow }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0); expect(d.credits()).toBe(1000); expect(d.head).not.toHaveBeenCalled();
  });
  it.each(['gangnam-style-v1', 'silent', null])('rejects client-owned soundtrack %# before charging', async soundtrack => {
    const d = await setup(); expect((await POST(d.request({ soundtrack }), undefined)).status).toBe(400);
    expect(d.jobs()).toBe(0); expect(d.credits()).toBe(1000);
  });
  it('uses one selfie as all three identities without fabricating extra upload keys', async () => {
    const d = await setup(); expect((await POST(d.request({ mode: 'selfie', photos: photos.slice(0, 1) }), undefined)).status).toBe(202);
    expect(d.payload().photos).toEqual([photos[0]]);
    expect(d.payload().prompt).toMatch(/three.*same.*@Image1/i);
    expect(d.payload().prompt).not.toContain('@Image2');
  });
  it('uses the pet choreography while preserving each pet reference', async () => {
    const d = await setup(); expect((await POST(d.request({ mode: 'pets' }), undefined)).status).toBe(202);
    expect(d.payload().prompt).toMatch(/species|fur/i); expect(d.payload().prompt).toContain('@Image3');
  });
  it.each([
    { mode: 'other' }, { mode: null }, { photos: [] }, { photos: photos.slice(0, 2) }, { photos: [...photos, photos[0]] },
    { mode: 'selfie', photos }, { photos: null }, { photos: 'bad' }, { aspect: 'adaptive' }, { aspect: '' }, { resolution: '1080p' }, { resolution: null },
    { consent: false }, { consent: 'true' }, { consent: null },
  ])('rejects invalid public options before a debit %#', async patch => {
    const d = await setup(); expect((await POST(d.request(patch), undefined)).status).toBe(400); expect(d.jobs()).toBe(0); expect(d.credits()).toBe(1000);
  });
  it.each(['https://evil.test/a.png', 'users/other/uploads/a', 'users/u/uploads/../a', 'users/u/results/a', 'users/u/uploads/missing', ''])('rejects an invalid third photo %s before charging', async photo => {
    const d = await setup(); expect((await POST(d.request({ photos: [photos[0], photos[1], photo] }), undefined)).status).toBe(400); expect(d.jobs()).toBe(0);
  });
  it('checks database ownership of every reference', async () => {
    const d = await setup(); d.sqlite.prepare("INSERT INTO users(id,email,name) VALUES('other','other@x.test','Other')").run();
    d.sqlite.prepare("UPDATE uploads SET user_id='other' WHERE key=?").run(photos[2]);
    expect((await POST(d.request(), undefined)).status).toBe(400); expect(d.jobs()).toBe(0);
  });
  it.each(['missing', 'mime', 'empty', 'oversize', 'reference', 'small', 'corrupt', 'replaced'])('rejects %s third image storage without a debit', async defect => {
    const d = await setup();
    if (defect === 'missing') d.objects.delete(photos[2]);
    if (defect === 'mime') d.objects.get(photos[2])!.mime = 'image/jpeg';
    if (defect === 'empty') d.objects.get(photos[2])!.bytes = new Uint8Array(0);
    if (defect === 'oversize') d.objects.get(photos[2])!.bytes = new Uint8Array(10 * 1024 * 1024 + 1);
    if (defect === 'reference') d.sqlite.prepare("UPDATE uploads SET media_kind='video' WHERE key=?").run(photos[2]);
    if (defect === 'small') d.objects.get(photos[2])!.bytes = fixture('200x200.png');
    if (defect === 'corrupt') d.objects.get(photos[2])!.bytes = fixture().slice(0, 25);
    if (defect === 'replaced') d.get.mockResolvedValueOnce({ ...await d.head(photos[0]), etag: 'replaced', arrayBuffer: async () => fixture().buffer });
    expect((await POST(d.request(), undefined)).status).toBe(400); expect(d.jobs()).toBe(0); expect(d.credits()).toBe(1000);
  });
  it.each([true, false])('deduplicates identical retries with explicit key=%s', async explicit => {
    const d = await setup(); const request = () => { const r = d.request(); if (!explicit) r.headers.delete('Idempotency-Key'); return r; };
    const first = await POST(request(), undefined), second = await POST(request(), undefined);
    expect(first.status).toBe(202); expect(await second.json()).toEqual(await first.json()); expect(d.credits()).toBe(850); expect(d.jobs()).toBe(1);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
  });
  it.each(['16:9', '9:16', 'auto'])('recovers an old %s reservation despite changed server workflow and prompt', async aspect => {
    const d = await setup(), previous = await reserveLegacy(d, aspect);
    const response = await POST(d.request({ aspect }), undefined);
    expect(response.status).toBe(202);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ id: previous.id, template: 'gangnam-style', status: 'queued', progress: 0 });
    expect(d.head).not.toHaveBeenCalled(); expect(d.get).not.toHaveBeenCalled();
    expect(d.credits()).toBe(850); expect(d.jobs()).toBe(1);
    expect(d.sqlite.prepare('SELECT payload FROM generations WHERE id=?').get(previous.id)?.payload).toBe(previous.payload);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
  });
  it('recovers an existing task after uploads and generation configuration become unavailable', async () => {
    const d = await setup(), previous = await reserveLegacy(d);
    d.objects.clear();
    for (const key of ['KIE_API_KEY', 'KIE_MEDIA_HOSTS', 'FAL_KEY', 'FAL_MEDIA_HOSTS', 'MEDIA_SIGNING_SECRET', 'SEEAPI_API_KEY', 'MEDIA']) delete routeEnv.value[key];
    const response = await POST(d.request(), undefined);
    expect(response.status).toBe(202); expect(await response.json()).toMatchObject({ id: previous.id });
    expect(d.head).not.toHaveBeenCalled(); expect(d.credits()).toBe(850); expect(d.jobs()).toBe(1);
  });
  it.each([{ mode: 'pets' }, { photos: [...photos].reverse() }, { photos: [] }, { aspect: '9:16' }, { resolution: '720p' }, { consent: false }])('rejects changed public parameters for an old reservation %#', async patch => {
    const d = await setup(); await reserveLegacy(d);
    expect((await POST(d.request(patch), undefined)).status).toBe(409);
    expect(d.head).not.toHaveBeenCalled(); expect(d.credits()).toBe(850); expect(d.jobs()).toBe(1);
  });
  it('does not recover another user\'s job with the same key', async () => {
    const d = await setup();
    d.sqlite.prepare("INSERT INTO users(id,email,name,credits) VALUES('other','other@example.test','Other',1000)").run();
    const previous = await reserveLegacy(d, '16:9', 'other');
    const response = await POST(d.request(), undefined), body = await response.json() as { id: string };
    expect(response.status).toBe(202); expect(body.id).not.toBe(previous.id);
    expect(d.credits()).toBe(850); expect(d.jobs()).toBe(2);
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='other'").get()?.credits).toBe(850);
  });
  it.each([['ozil-goal', 'video'], ['gangnam-style', 'image']])('rejects the same key owned by %s/%s', async (template, kind) => {
    const d = await setup(); await reserveLegacy(d, '16:9', 'u', template, kind);
    expect((await POST(d.request(), undefined)).status).toBe(409);
    expect(d.head).not.toHaveBeenCalled(); expect(d.credits()).toBe(850); expect(d.jobs()).toBe(1);
  });
  it.each([false, true])('handles a legacy reservation appearing after both early reads, changed=%s', async changed => {
    const d = await setup(), previous = await reserveLegacy(d);
    const original = d.db.prepare.bind(d.db); let hiddenReads = 2;
    vi.spyOn(d.db, 'prepare').mockImplementation(sql => {
      const statement = original(sql);
      if (sql === 'SELECT * FROM generations WHERE user_id=? AND idempotency_key=?' && hiddenReads-- > 0) {
        return { ...statement, bind: (...args: unknown[]) => ({ ...statement.bind(...args), first: async () => null }) } as D1PreparedStatement;
      }
      return statement;
    });
    const response = await POST(d.request(changed ? { mode: 'pets' } : {}), undefined);
    expect(response.status).toBe(changed ? 409 : 202);
    if (!changed) expect(await response.json()).toMatchObject({ id: previous.id });
    expect(d.credits()).toBe(850); expect(d.jobs()).toBe(1);
    expect(d.sqlite.prepare('SELECT payload FROM generations WHERE id=?').get(previous.id)?.payload).toBe(previous.payload);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
  });
  it('does not let retry recovery bypass origin, authentication, workflow or key checks', async () => {
    const d = await setup(); await reserveLegacy(d);
    expect((await POST(d.request({}, { origin: 'https://evil.test' }), undefined)).status).toBe(403);
    expect((await POST(d.request({}, { cookie: '' }), undefined)).status).toBe(401);
    expect((await POST(d.request({ workflow: 'reference-edit-v1' }), undefined)).status).toBe(400);
    expect((await POST(d.request({}, { 'Idempotency-Key': '' }), undefined)).status).toBe(400);
    expect(d.credits()).toBe(850); expect(d.jobs()).toBe(1);
  });
  it.each([{ mode: 'pets' }, { photos: [...photos].reverse() }, { resolution: '720p' }])('rejects changed options on an existing idempotency key %#', async patch => {
    const d = await setup(); await POST(d.request(), undefined); expect((await POST(d.request(patch), undefined)).status).toBe(409); expect(d.credits()).toBe(850);
  });
  it('enforces balance and returns an existing reservation despite a missing provider', async () => {
    const d = await setup(); d.sqlite.prepare("UPDATE users SET credits=299 WHERE id='u'").run();
    expect((await POST(d.request({ resolution: '720p' }), undefined)).status).toBe(402); expect(d.jobs()).toBe(0);
    d.sqlite.prepare("UPDATE users SET credits=300 WHERE id='u'").run();
    const first = await POST(d.request({ resolution: '720p' }), undefined); delete routeEnv.value.KIE_API_KEY;
    const retry = await POST(d.request({ resolution: '720p' }), undefined);
    expect(retry.status).toBe(202); expect(await retry.json()).toEqual(await first.json()); expect(d.credits()).toBe(0);
  });
  it('requires same-origin sign-in before reading private uploads', async () => {
    const d = await setup();
    expect((await POST(d.request({}, { origin: 'https://evil.test' }), undefined)).status).toBe(403);
    expect((await POST(d.request({}, { cookie: '' }), undefined)).status).toBe(401);
    expect(d.head).not.toHaveBeenCalled(); expect(d.jobs()).toBe(0);
  });
  it.each(['KIE_API_KEY', 'KIE_MEDIA_HOSTS', 'FAL_KEY', 'FAL_MEDIA_HOSTS', 'MEDIA_SIGNING_SECRET', 'SEEAPI_API_KEY', 'MEDIA'])('rejects missing %s before charging', async key => {
    const d = await setup(); delete routeEnv.value[key]; expect((await POST(d.request(), undefined)).status).toBe(503); expect(d.jobs()).toBe(0);
  });
  it('rejects malformed JSON and an invalid idempotency key', async () => {
    const d = await setup();
    for (const body of ['{', 'null', '[]']) { const r = d.request(); expect((await POST(new Request(r.url, { method: 'POST', headers: r.headers, body }), undefined)).status).toBe(400); }
    expect((await POST(d.request({}, { 'Idempotency-Key': 'bad' }), undefined)).status).toBe(400); expect(d.jobs()).toBe(0);
  });
  it('exposes only the template discriminator and quote in shared history', async () => {
    const d = await setup(); await POST(d.request(), undefined);
    const response = await GET(new Request('https://example.test/api/generations', { headers: d.request().headers }), undefined);
    const body = await response.json() as { generations: Record<string, unknown>[] }; expect(body.generations[0]).toMatchObject({ template: 'gangnam-style', cost: 150, kind: 'video' });
    expect(JSON.stringify(body)).not.toContain(photos[0]); expect(JSON.stringify(body)).not.toContain(d.payload().prompt);
  });
});
