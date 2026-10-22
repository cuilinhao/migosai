import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import { GET as history } from '../app/api/generations/route';
import { POST } from '../app/api/images/route';
import { GET as detail } from '../app/api/generations/[id]/route';

const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));
afterEach(() => vi.restoreAllMocks());
const photo = 'users/u/uploads/image-reference';
async function setup() {
  const d = database(), token = 'i'.repeat(43);
  d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
  d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(photo, 'u', 'image/png');
  const objects = new Map([[photo, { size: 1024, httpMetadata: { contentType: 'image/png' } }]]);
  const head = vi.fn(async (key: string) => objects.get(key) ?? null);
  routeEnv.value = { ...jobEnv(d.db), KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com', MEDIA: { head } as unknown as R2Bucket };
  delete routeEnv.value.SEEAPI_API_KEY;
  const request = (patch: Record<string, unknown> = {}, headers: Record<string, string> = {}) => new Request('https://example.test/api/images', {
    method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'image-request-once', ...headers },
    body: JSON.stringify({ prompt: '  A bright orange cat  ', images: [], aspect: 'auto', resolution: '1K', outputFormat: 'png', ...patch }),
  });
  const credits = () => d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits;
  const jobs = () => d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n;
  return { ...d, request, credits, jobs, objects, head };
}
const post = (request: Request) => POST(request, undefined);

describe('image creation authentication, pricing and idempotency', () => {
  it.each([['1K', 5], ['2K', 8], ['4K', 12]])('reserves %s at %s credits without a paid call or video moderation', async (resolution, cost) => {
    const d = await setup(); const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Must not call providers'));
    const response = await post(d.request({ resolution, cost: 1, model: 'attacker', provider: 'attacker', count: 10 }));
    expect(response.status).toBe(202); expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(d.sqlite.prepare('SELECT kind,cost FROM generations').get()).toEqual({ kind: 'image', cost });
    expect(JSON.parse(String(d.sqlite.prepare('SELECT payload FROM generations').get()?.payload))).toEqual({ provider: 'kie', model: 'nano-banana-2', prompt: 'A bright orange cat', images: [], aspect: 'auto', resolution, outputFormat: 'png' });
    expect(d.credits()).toBe(100 - Number(cost)); expect(fetcher).not.toHaveBeenCalled(); expect(d.head).not.toHaveBeenCalled();
  });
  it('deduplicates concurrent retries and conflicts when options change', async () => {
    const d = await setup();
    const [first, second] = await Promise.all([post(d.request()), post(d.request())]);
    expect(first.status).toBe(202); expect(await second.json()).toEqual(await first.json());
    expect(d.jobs()).toBe(1); expect(d.credits()).toBe(95);
    expect((await post(d.request({ resolution: '4K' }))).status).toBe(409);
    expect(d.credits()).toBe(95);
  });
  it('reuses a saved reservation while provider configuration is unavailable', async () => {
    const d = await setup(); const first = await post(d.request()); delete routeEnv.value.KIE_API_KEY;
    expect(await (await post(d.request())).json()).toEqual(await first.json()); expect(d.credits()).toBe(95);
  });
  it('recovers a saved reference request after its upload is removed', async () => {
    const d = await setup(); const first = await post(d.request({ images: [photo] }));
    d.objects.delete(photo); d.sqlite.prepare('DELETE FROM uploads WHERE key=?').run(photo);
    expect(await (await post(d.request({ images: [photo] }))).json()).toEqual(await first.json()); expect(d.credits()).toBe(95);
  });
  it('isolates saved image details and history from a second user', async () => {
    const d = await setup(); const created = await (await post(d.request())).json() as { id: string };
    const other = 'z'.repeat(43); d.sqlite.exec("INSERT INTO users(id,email,name) VALUES('other','other@example.test','Other')");
    d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(other), 'other');
    const request = new Request('https://example.test/api/generations/' + created.id, { headers: { cookie: `migos_session=${other}` } });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No access to private work'));
    expect((await detail(request, { params: Promise.resolve({ id: created.id }) })).status).toBe(404);
    expect(await (await history(request, undefined)).json()).toEqual({ generations: [] });
    expect(fetcher).not.toHaveBeenCalled(); expect(d.credits()).toBe(95);
  });
  it('rejects insufficient balance before storing a generation and allows retry after purchase', async () => {
    const d = await setup(); d.sqlite.prepare("UPDATE users SET credits=11 WHERE id='u'").run();
    expect((await post(d.request({ resolution: '4K', cost: 1 }))).status).toBe(402); expect(d.jobs()).toBe(0);
    d.sqlite.prepare("UPDATE users SET credits=12 WHERE id='u'").run();
    expect((await post(d.request({ resolution: '4K' }))).status).toBe(202); expect(d.credits()).toBe(0);
  });
  it.each([{ prompt: '' }, { prompt: '  ' }, { prompt: 'a'.repeat(20001) }, { prompt: 4 }, { images: null }, { images: 'url' }, { images: Array(11).fill(photo) }, { aspect: 'bad' }, { resolution: '8K' }, { outputFormat: 'webp' }])('rejects invalid options %# before charging', async patch => {
    const d = await setup(); expect((await post(d.request(patch))).status).toBe(400); expect(d.jobs()).toBe(0); expect(d.credits()).toBe(100);
  });
  it.each([1, 20000])('accepts the prompt boundary %s', async count => {
    const d = await setup(); expect((await post(d.request({ prompt: 'a'.repeat(count) }))).status).toBe(202);
  });
  it('accepts a 20,000-character multilingual prompt within a bounded request', async () => {
    const d = await setup(); expect((await post(d.request({ prompt: '猫'.repeat(20000) }))).status).toBe(202);
  });
  it('rejects an oversized request envelope before debiting', async () => {
    const d = await setup(); expect((await post(d.request({ unused: 'x'.repeat(128 * 1024) }))).status).toBe(413); expect(d.jobs()).toBe(0);
  });
  it.each(['auto', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '5:4', '21:9', '1:4', '4:1', '1:8', '8:1'])('accepts supported aspect %s', async aspect => {
    const d = await setup(); expect((await post(d.request({ aspect, outputFormat: 'jpg' }))).status).toBe(202);
  });
  it('requires same-origin authentication before upload access', async () => {
    const d = await setup();
    expect((await post(d.request({ images: [photo] }, { origin: 'https://evil.test' }))).status).toBe(403);
    expect((await post(d.request({ images: [photo] }, { cookie: '' }))).status).toBe(401);
    expect((await post(d.request({ images: [photo] }, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect(d.head).not.toHaveBeenCalled(); expect(d.jobs()).toBe(0);
  });
  it.each(['KIE_API_KEY', 'KIE_MEDIA_HOSTS', 'MEDIA_SIGNING_SECRET', 'MEDIA'])('requires %s before new debit', async name => {
    const d = await setup(); delete routeEnv.value[name];
    expect((await post(d.request())).status).toBe(503); expect(d.jobs()).toBe(0);
  });
  it('rejects malformed JSON, arrays and invalid idempotency keys', async () => {
    const d = await setup();
    for (const body of ['{', 'null', '[]']) { const valid = d.request(); expect((await post(new Request(valid.url, { method: 'POST', headers: valid.headers, body }))).status).toBe(400); }
    expect((await post(d.request({}, { 'Idempotency-Key': 'bad' }))).status).toBe(400); expect(d.jobs()).toBe(0);
  });
});

describe('image references and private history', () => {
  it('accepts ten owned references and records only private keys', async () => {
    const d = await setup(); const images = [];
    for (let i = 0; i < 10; i++) { const key = `users/u/uploads/image-${i}`; images.push(key); d.objects.set(key, { size: 10 * 1024 * 1024, httpMetadata: { contentType: 'image/png' } }); d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(key, 'u', 'image/png'); }
    expect((await post(d.request({ images }))).status).toBe(202); expect(d.head).toHaveBeenCalledTimes(10); expect(d.credits()).toBe(95);
    const response = await history(new Request('https://example.test/api/generations', { headers: d.request().headers }), undefined);
    const body = await response.json() as any;
    expect(body.generations[0]).toMatchObject({ kind: 'image', cost: 5, status: 'queued' });
    expect(body.generations[0]).not.toHaveProperty('payload'); expect(JSON.stringify(body)).not.toContain('image-0');
  });
  it.each(['https://evil.test/a.png', 'users/other/uploads/image', 'users/u/results/image', 'users/u/uploads/../image', 'users/u/uploads/missing', null])('rejects invalid or unowned reference %s', async key => {
    const d = await setup(); expect((await post(d.request({ images: [key] }))).status).toBe(400); expect(d.jobs()).toBe(0);
  });
  it('checks upload ownership from the database', async () => {
    const d = await setup(); d.sqlite.exec("INSERT INTO users(id,email,name) VALUES('other','other@example.test','Other')");
    d.sqlite.prepare('UPDATE uploads SET user_id=? WHERE key=?').run('other', photo);
    expect((await post(d.request({ images: [photo] }))).status).toBe(400); expect(d.head).not.toHaveBeenCalled();
  });
  it.each(['missing', 'oversize', 'empty', 'mismatch', 'video'])('rejects %s reference storage', async defect => {
    const d = await setup();
    if (defect === 'missing') d.objects.delete(photo);
    if (defect === 'oversize') d.objects.set(photo, { size: 10 * 1024 * 1024 + 1, httpMetadata: { contentType: 'image/png' } });
    if (defect === 'empty') d.objects.set(photo, { size: 0, httpMetadata: { contentType: 'image/png' } });
    if (defect === 'mismatch') d.objects.set(photo, { size: 1024, httpMetadata: { contentType: 'image/jpeg' } });
    if (defect === 'video') d.sqlite.prepare("UPDATE uploads SET media_kind='video' WHERE key=?").run(photo);
    expect((await post(d.request({ images: [photo] }))).status).toBe(400); expect(d.jobs()).toBe(0);
  });
});
