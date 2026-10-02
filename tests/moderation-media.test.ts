import { describe, it, expect, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { hmac, sha256 } from '../lib/server/security';
import type { Env } from '../lib/server/env';
import { api } from '../lib/server/errors';
import { signedMediaUrl } from '../lib/server/media';
import * as moderationMedia from '../lib/server/moderation-media';

const routeEnv = vi.hoisted(() => ({ value: {} as Env }));
vi.mock('@/lib/server/env', async () => ({ ...await import('../lib/server/env'), getEnv: async () => routeEnv.value }));
vi.mock('@/lib/server/auth', () => import('../lib/server/auth'));
vi.mock('@/lib/server/media', () => import('../lib/server/media'));
vi.mock('@/lib/server/errors', () => import('../lib/server/errors'));
vi.mock('@/lib/server/moderation-media', () => import('../lib/server/moderation-media'));

describe('result media quarantine', () => {
 it('denies the owner access to a pending video by guessing its result key', async () => {
  const d = database();
  const token = 'x'.repeat(43);
  d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+3600)').run(await sha256(token), 'u');
  d.sqlite.prepare("INSERT INTO generations(id,user_id,idempotency_key,kind,payload,cost,status,stage) VALUES('job','u','guess','video','{}',1,'processing','moderation_polling')").run();
  const key = 'users/u/results/job/0';
  routeEnv.value = { ...jobEnv(d.db), MEDIA: { get: async () => ({ size: 5, etag: 'original', body: 'video', httpMetadata: { contentType: 'video/mp4' } }) } as unknown as R2Bucket };
  const { GET } = await import('../app/api/media/[...key]/route');
  const response = await GET(new Request(`https://example.test/api/media/${key}`, { headers: { cookie: `migos_session=${token}` } }), { params: Promise.resolve({ key: key.split('/') }) });
  expect(response.status).toBe(404);
 });
});

const secret = 'a'.repeat(32);
const candidateKey = 'users/u/results/job/2c7ca410-afb3-4fe1-ae71-c9bbf72848c0';
const pinnedEtag = 'candidate-etag';

async function fixture(overrides: Record<string, unknown> = {}, objectOptions: { etag?: string; missing?: boolean; bodyless?: boolean } = {}) {
 const d = database();
 const token = 'x'.repeat(43);
 d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+3600)').run(await sha256(token), 'u');
 const row = {
  id: 'job', user_id: 'u', idempotency_key: 'media-test', kind: 'video', payload: '{}', cost: 1,
  status: 'processing', stage: 'moderation_polling', result_keys: null,
  moderation_verdict: 'pending', moderation_key: candidateKey, moderation_etag: pinnedEtag, ...overrides,
 };
 const columns = Object.keys(row);
 d.sqlite.prepare(`INSERT INTO generations(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`).run(...Object.values(row) as (string | number | null)[]);
 const reads: { key: string; options?: R2GetOptions }[] = [];
 const env: Env = { ...jobEnv(d.db), MEDIA: {
  async get(key: string, options?: R2GetOptions) {
   reads.push({ key, options });
   if (objectOptions.missing) return null;
   const etag = objectOptions.etag ?? pinnedEtag;
   const metadata = { key, etag, size: 10, httpMetadata: { contentType: row.kind === 'video' ? 'video/mp4' : 'audio/mpeg' } };
   const conditional = options?.onlyIf as R2Conditional | undefined;
   if (objectOptions.bodyless || (conditional?.etagMatches && conditional.etagMatches !== etag)) return metadata;
   const rangeHeader = options?.range instanceof Headers ? options.range.get('range') : null;
   return rangeHeader === 'bytes=2-4' ? { ...metadata, body: '234', range: { offset: 2, length: 3 } } : { ...metadata, body: '0123456789' };
  },
 } as unknown as R2Bucket };
 const cookies = { cookie: `migos_session=${token}` };
 return { ...d, env, reads, cookies };
}

async function userGet(f: Awaited<ReturnType<typeof fixture>>, key = candidateKey, headers: Record<string, string> = f.cookies) {
 return api(request => moderationMedia.serveUserMedia(request, f.env, key))(new Request(`https://example.test/api/media/${key}`, { headers }), {});
}

async function moderationUrl(options: { purpose?: string; id?: string; key?: string; etag?: string; expires?: number } = {}) {
 const id = options.id ?? 'job';
 const expires = options.expires ?? Math.floor(Date.now() / 1000) + 300;
 const signature = await hmac(secret, `${options.purpose ?? 'video-moderation'}\n${id}\n${options.key ?? candidateKey}\n${options.etag ?? pinnedEtag}\n${expires}`);
 return `https://example.test/api/moderation-media/${id}?expires=${expires}&signature=${signature}`;
}

async function moderationGet(f: Awaited<ReturnType<typeof fixture>>, url?: string, headers?: Record<string, string>, id = 'job') {
 return api(request => moderationMedia.serveModerationMedia(request, f.env, id))(new Request(url ?? await moderationUrl(), { headers }), {});
}

describe('result access requires recorded approval', () => {
 for (const [status, stage, moderation_verdict] of [
  ['processing', 'moderation_polling', 'pending'],
  ['failed', 'terminal', 'blocked'],
  ['processing', 'manual_review', 'manual'],
  ['completed', 'terminal', null],
  ['completed', 'terminal', 'pending'],
  ['completed', 'terminal', 'blocked'],
 ] as const) {
  it(`denies a guessed ${status}/${moderation_verdict ?? 'legacy'} result even when result_keys contains it`, async () => {
   const f = await fixture({ status, stage, moderation_verdict, result_keys: JSON.stringify([candidateKey]) });
   expect((await userGet(f)).status).toBe(404);
   expect(f.reads).toHaveLength(0);
  });
 }
 it('denies another authenticated user even for an approved result', async () => {
  const f = await fixture({ status: 'completed', moderation_verdict: 'passed', result_keys: JSON.stringify([candidateKey]) });
  f.sqlite.exec("INSERT INTO users(id,email,name,credits) VALUES('other','other@example.test','Other',100)");
  const otherToken = 'y'.repeat(43);
  f.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+3600)').run(await sha256(otherToken), 'other');
  expect((await userGet(f, candidateKey, { cookie: `migos_session=${otherToken}` })).status).toBe(404);
  expect(f.reads).toHaveLength(0);
 });
 for (const result_keys of [null, 'not json', '{}', JSON.stringify(['users/u/results/job/another-candidate'])]) {
  it(`denies results not exactly associated with the job: ${result_keys}`, async () => {
   const f = await fixture({ status: 'completed', moderation_verdict: 'passed', result_keys });
   expect((await userGet(f)).status).toBe(404);
  });
 }
 it('denies a result path whose named owner differs from the actual job owner', async () => {
  const f = await fixture({ status: 'completed', moderation_verdict: 'passed', result_keys: JSON.stringify([candidateKey]) });
  f.sqlite.exec("INSERT INTO users(id,email,name,credits) VALUES('other','other@example.test','Other',100)");
  f.sqlite.exec("UPDATE generations SET user_id='other' WHERE id='job'");
  expect((await userGet(f)).status).toBe(404);
 });
 for (const overrides of [{ moderation_key: 'users/u/results/job/another-candidate' }, { moderation_etag: null }]) {
  it(`requires the reviewed candidate and ETag ${JSON.stringify(overrides)}`, async () => {
   const f = await fixture({ status: 'completed', moderation_verdict: 'passed', result_keys: JSON.stringify([candidateKey]), ...overrides });
   expect((await userGet(f)).status).toBe(404);
  });
 }
 it('serves the approved immutable video and preserves range requests', async () => {
  const f = await fixture({ status: 'completed', moderation_verdict: 'passed', result_keys: JSON.stringify([candidateKey]) });
  const response = await userGet(f, candidateKey, { ...f.cookies, range: 'bytes=2-4', authorization: 'private-browser-token' });
  expect(response.status).toBe(206);
  expect(response.headers.get('Content-Range')).toBe('bytes 2-4/10');
  expect(await response.text()).toBe('234');
  expect(f.reads[0].options?.onlyIf).toEqual({ etagMatches: pinnedEtag });
 });
 for (const objectOptions of [{ etag: 'replaced-object' }, { missing: true }, { bodyless: true }]) {
  it(`fails closed when the approved object cannot be retrieved intact ${JSON.stringify(objectOptions)}`, async () => {
   const f = await fixture({ status: 'completed', moderation_verdict: 'passed', result_keys: JSON.stringify([candidateKey]) }, objectOptions);
   expect((await userGet(f)).status).toBe(404);
  });
 }
 it('keeps owner access to completed music results without video moderation', async () => {
  const key = 'users/u/results/job/0';
  const f = await fixture({ kind: 'music', status: 'completed', result_keys: JSON.stringify([key]), moderation_verdict: null, moderation_key: null, moderation_etag: null });
  const response = await userGet(f, key);
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
  expect(await response.text()).toBe('0123456789');
  expect(f.reads[0].options?.onlyIf).toBeUndefined();
 });
 it('continues serving signed uploads without a user session', async () => {
  const f = await fixture();
  const key = 'users/u/uploads/input-image';
  const url = await signedMediaUrl(f.env, key);
  const response = await api(request => moderationMedia.serveUserMedia(request, f.env, key))(new Request(url), {});
  expect(response.status).toBe(200);
 });
 it('does not turn ordinary media signatures into result access', async () => {
  const f = await fixture({ status: 'completed', moderation_verdict: 'passed', result_keys: JSON.stringify([candidateKey]) });
  const url = await signedMediaUrl(f.env, candidateKey);
  expect((await api(request => moderationMedia.serveUserMedia(request, f.env, candidateKey))(new Request(url), {})).status).toBe(404);
 });
});

describe('purpose-bound moderation media URLs', () => {
 it('creates a URL bound to the job, exact key, ETag and expiration without exposing object paths', async () => {
  const expires = Math.floor(Date.now() / 1000) + 300;
  const url = await moderationMedia.createModerationMediaUrl({ APP_URL: 'https://example.test/path', MEDIA_SIGNING_SECRET: secret }, 'job', candidateKey, pinnedEtag, expires);
  expect(url).toBe(await moderationUrl({ expires }));
  expect(url).not.toContain(candidateKey);
  expect(url).not.toContain(pinnedEtag);
 });
 it('serves a pending candidate with conditional R2 access and range metadata', async () => {
  const f = await fixture();
  const response = await moderationGet(f, undefined, { range: 'bytes=2-4', cookie: 'external=secret', authorization: 'private-provider-token' });
  expect(response.status).toBe(206);
  expect(response.headers.get('Content-Range')).toBe('bytes 2-4/10');
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.text()).toBe('234');
  expect(f.reads[0].options?.onlyIf).toEqual({ etagMatches: pinnedEtag });
  const range = f.reads[0].options?.range as Headers;
  expect([...range.keys()]).toEqual(['range']);
 });
 for (const options of [{ purpose: 'user-media' }, { id: 'other' }, { key: 'users/u/results/job/different' }, { etag: 'different-etag' }]) {
  it(`rejects mismatched signature inputs ${JSON.stringify(options)}`, async () => {
   const f = await fixture();
   expect((await moderationGet(f, await moderationUrl(options))).status).toBe(404);
   expect(f.reads).toHaveLength(0);
  });
 }
 for (const offset of [-1, 0, 3601]) {
  it(`rejects an expiration outside the future one-hour window: ${offset}`, async () => {
   const f = await fixture();
   expect((await moderationGet(f, await moderationUrl({ expires: Math.floor(Date.now() / 1000) + offset }))).status).toBe(404);
  });
 }
 for (const query of ['', '?expires=not-a-number&signature=bad', '?expires=9999999999&signature=bad']) {
  it(`never falls back to a valid user cookie for invalid moderation URLs ${query}`, async () => {
   const f = await fixture();
   expect((await moderationGet(f, `https://example.test/api/moderation-media/job${query}`, f.cookies)).status).toBe(404);
   expect(f.reads).toHaveLength(0);
  });
 }
 for (const overrides of [
  { kind: 'music' }, { status: 'completed' }, { status: 'failed' }, { status: 'cancelled' },
  { stage: 'saving' }, { stage: 'manual_review' }, { moderation_verdict: 'passed' },
  { moderation_verdict: 'blocked' }, { moderation_verdict: 'manual' }, { moderation_verdict: null },
  { moderation_key: null }, { moderation_etag: null }, { moderation_key: 'users/other/results/job/candidate' },
 ]) {
  it(`rejects candidates outside the pending moderation stage ${JSON.stringify(overrides)}`, async () => {
   const f = await fixture(overrides);
   expect((await moderationGet(f)).status).toBe(404);
   expect(f.reads).toHaveLength(0);
  });
 }
 it('allows a candidate while its moderation submission is in flight', async () => {
  const f = await fixture({ stage: 'moderation_submitting' });
  expect((await moderationGet(f)).status).toBe(200);
 });
 for (const objectOptions of [{ etag: 'replaced-object' }, { missing: true }, { bodyless: true }]) {
  it(`does not serve missing or changed review bytes ${JSON.stringify(objectOptions)}`, async () => {
   const f = await fixture({}, objectOptions);
   expect((await moderationGet(f)).status).toBe(404);
  });
 }
 it('rejects malformed job IDs without accessing storage', async () => {
  const f = await fixture();
  expect((await moderationGet(f, undefined, undefined, '../job')).status).toBe(404);
  expect(f.reads).toHaveLength(0);
 });
 it('revokes a previously valid moderation URL immediately after approval', async () => {
  const f = await fixture();
  const url = await moderationUrl();
  expect((await moderationGet(f, url)).status).toBe(200);
  f.sqlite.exec("UPDATE generations SET moderation_verdict='passed' WHERE id='job'");
  expect((await moderationGet(f, url)).status).toBe(404);
 });
});
