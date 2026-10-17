import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import { POST } from '../app/api/flyingcar/generations/route';

const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));
afterEach(() => vi.restoreAllMocks());
const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/flyingcar-images/${name}`, import.meta.url)));
const photo = 'users/u/uploads/car';
async function setup(bytes: Uint8Array, mime = 'image/png') {
  const d = database(), token = 'i'.repeat(43);
  d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
  d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(photo, 'u', mime);
  const metadata = { size: bytes.length, etag: 'photo-etag', httpMetadata: { contentType: mime } };
  const head = vi.fn(async () => metadata);
  const get = vi.fn(async () => ({ ...metadata, arrayBuffer: async () => bytes.slice().buffer }));
  routeEnv.value = { ...jobEnv(d.db), KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com', MEDIA: { head, get } };
  const request = () => new Request('https://example.test/api/flyingcar/generations', {
    method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'flyingcar-photo-check' },
    body: JSON.stringify({ prompt: 'A silver car takes off above a quiet city.', duration: 10, photo, consent: true, width: 1024, height: 1024 }),
  });
  const count = () => d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n;
  const credits = () => d.sqlite.prepare('SELECT credits FROM users').get()?.credits;
  return { ...d, metadata, get, request, count, credits };
}

describe('FlyingCar checks actual uploaded image dimensions before charging', () => {
  it.each([
    ['320x480.png', 'image/png'], ['320x480.jpg', 'image/jpeg'], ['320x480-progressive.jpg', 'image/jpeg'],
    ['320x480.webp', 'image/webp'], ['320x480-lossless.webp', 'image/webp'], ['320x480-alpha.webp', 'image/webp'],
    ['301x301.png', 'image/png'], ['5999x3000.png', 'image/png'], ['401x1000.png', 'image/png'], ['1000x401.png', 'image/png'],
  ])('accepts a real valid %s', async (name, mime) => {
    const d = await setup(fixture(name), mime);
    expect((await POST(d.request(), undefined)).status).toBe(202);
    expect(d.count()).toBe(1);
    expect(d.credits()).toBe(25);
    expect(d.get).toHaveBeenCalledWith(photo, { onlyIf: { etagMatches: 'photo-etag' } });
  });
  it.each(['200x200.png', '1600x400.png', '300x301.png', '6000x3000.png', '400x1000.png', '1000x400.png'])('rejects %s despite forged client dimensions, without a debit', async name => {
    const d = await setup(fixture(name));
    const response = await POST(d.request(), undefined);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/301|dimensions|aspect|ratio/i) });
    expect(d.count()).toBe(0);
    expect(d.credits()).toBe(100);
  });
  it.each([
    ['PNG truncated IHDR', 'image/png', () => fixture('320x480.png').slice(0, 25)],
    ['PNG corrupt IHDR CRC', 'image/png', () => { const b = fixture('320x480.png'); b[20] ^= 1; return b; }],
    ['JPEG truncated segment', 'image/jpeg', () => fixture('320x480.jpg').slice(0, 25)],
    ['JPEG invalid segment size', 'image/jpeg', () => { const b = fixture('320x480.jpg'); b[4] = 255; b[5] = 255; return b; }],
    ['WebP truncated chunk', 'image/webp', () => fixture('320x480.webp').slice(0, 25)],
    ['WebP impossible chunk size', 'image/webp', () => { const b = fixture('320x480.webp'); b.fill(255, 16, 20); return b; }],
    ['WebP mismatched extended canvas', 'image/webp', () => { const b = fixture('320x480-alpha.webp'); b[24] ^= 1; return b; }],
    ['wrong stored MIME', 'image/png', () => fixture('320x480.jpg')],
  ] as const)('rejects malformed %s without a debit', async (_name, mime, bytes) => {
    const d = await setup(bytes(), mime);
    expect((await POST(d.request(), undefined)).status).toBe(400);
    expect(d.count()).toBe(0);
    expect(d.credits()).toBe(100);
  });
  it('rejects an object replaced between metadata and byte reads', async () => {
    const d = await setup(fixture('320x480.png'));
    d.get.mockResolvedValueOnce({ ...d.metadata, arrayBuffer: undefined } as any);
    expect((await POST(d.request(), undefined)).status).toBe(400);
    expect(d.credits()).toBe(100);
  });
  it('does not read bytes of another user upload', async () => {
    const d = await setup(fixture('320x480.png'));
    d.sqlite.prepare("INSERT INTO users(id,email,name,credits) VALUES('other','other@x.test','Other',100)").run();
    d.sqlite.prepare("UPDATE uploads SET user_id='other' WHERE key=?").run(photo);
    expect((await POST(d.request(), undefined)).status).toBe(400);
    expect(d.get).not.toHaveBeenCalled();
    expect(d.credits()).toBe(100);
  });
});
