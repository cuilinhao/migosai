import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Production fetch, authentication, D1, R2 and crypto run inside workerd.
// Only the external network is stubbed; all storage is local and non-persistent.
const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://app.example.invalid';
const key = 'users/u/results/job/candidate';
const otherKey = 'users/u/results/job/other-candidate';
const bytes = new Uint8Array([0, 1, 2, 3, 127, 128, 200, 253, 254, 255]);
const token = 'x'.repeat(43);
const ownerHeaders = { cookie: `migos_session=${token}` };
const idempotencyKey = 'migosai-video-moderation-job';
let worker, db, bucket, etag;
let upstreamStatus = 202;
let requests = [];

beforeAll(async () => {
  const bundled = await build({
    stdin: {
      resolveDir: root,
      contents: `
        import { createVideoModeration, getVideoModeration } from './lib/server/seeapi';
        import { createModerationMediaUrl, serveModerationMedia, serveUserMedia } from './lib/server/moderation-media';
        export default { async fetch(request, env) {
          const path = new URL(request.url).pathname;
          try {
            if (path === '/test/submit') return Response.json(await createVideoModeration(env, await request.text(), '${idempotencyKey}'));
            if (path === '/test/poll') return Response.json(await getVideoModeration(env, 'task_safety'));
            if (path === '/test/sign') {
              const input = await request.json();
              return Response.json({ url: await createModerationMediaUrl(env, input.id, input.key, input.etag, input.expires) });
            }
            if (path.startsWith('/api/moderation-media/')) return await serveModerationMedia(request, env, path.slice('/api/moderation-media/'.length));
            if (path.startsWith('/api/media/')) return await serveUserMedia(request, env, path.slice('/api/media/'.length));
            return new Response('Not found', { status: 404 });
          } catch (error) {
            return Response.json({ error: error.message, retryable: error.retryable }, { status: error.status || 502 });
          }
        }};
      `,
    },
    bundle: true,
    platform: 'browser',
    external: ['node:crypto'],
    format: 'esm',
    write: false,
    plugins: [{
      name: 'unused-next-context',
      setup(builder) {
        builder.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({ path: 'context', namespace: 'test-context' }));
        builder.onLoad({ filter: /.*/, namespace: 'test-context' }, () => ({ contents: 'export function getCloudflareContext() { throw new Error("Not used by these direct production functions"); }' }));
      },
    }],
  });
  worker = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: '2026-10-01',
    compatibilityFlags: ['nodejs_compat'],
    cf: false,
    d1Databases: ['DB'],
    r2Buckets: ['MEDIA'],
    bindings: {
      APP_URL: origin,
      SEEAPI_API_KEY: 'test-seeapi-key',
      MEDIA_SIGNING_SECRET: 'local-moderation-signing-secret-for-tests',
    },
    outboundService: async (request) => {
      const url = new URL(request.url);
      requests.push({
        url: request.url,
        method: request.method,
        authorization: request.headers.get('authorization'),
        idempotencyKey: request.headers.get('idempotency-key'),
        userAgent: request.headers.get('user-agent'),
        contentType: request.headers.get('content-type'),
        body: await request.text(),
      });
      // No fallback fetch: even a redirect-policy regression cannot reach the internet.
      if (url.hostname !== 'api.seeapi.com') return new Response('Blocked external destination', { status: 403 });
      if (upstreamStatus !== 202) return new Response('Do not follow', { status: upstreamStatus, headers: { location: 'https://untrusted.example.invalid/capture' } });
      return Response.json({ id: 'task_safety', object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status: 'queued', result: null, error: null }, { status: 202 });
    },
  }));
  db = await worker.getD1Database('DB');
  bucket = await worker.getR2Bucket('MEDIA');
  await db.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,picture TEXT,credits INTEGER);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);
    CREATE TABLE generations(id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,status TEXT,stage TEXT,result_keys TEXT);
  `);
  await db.exec(readFileSync(new URL('../migrations/0003_video_moderation.sql', import.meta.url), 'utf8'));
  for (const [id, sessionToken] of [['u', token], ['other', 'y'.repeat(43)]]) {
    await db.prepare('INSERT INTO users(id,name,email,credits) VALUES(?,?,?,100)').bind(id, id, `${id}@example.invalid`).run();
    await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+3600)').bind(createHash('sha256').update(sessionToken).digest('hex'), id).run();
  }
}, 30000);

afterAll(async () => { await worker?.dispose(); });
beforeEach(async () => {
  upstreamStatus = 202;
  requests = [];
  await db.exec('DELETE FROM generations');
  await bucket.delete([key, otherKey]);
  etag = (await bucket.put(key, bytes, { httpMetadata: { contentType: 'video/mp4' } })).etag;
  await db.prepare("INSERT INTO generations(id,user_id,kind,status,stage,result_keys,moderation_verdict,moderation_key,moderation_etag) VALUES('job','u','video','reviewing','moderation_polling',?,'pending',?,?)")
    .bind(JSON.stringify([key]), key, etag).run();
});

async function updateJob(values) {
  await db.prepare(`UPDATE generations SET ${Object.keys(values).map(column => `${column}=?`).join(',')} WHERE id='job'`).bind(...Object.values(values)).run();
}

async function sign(overrides = {}) {
  const response = await worker.dispatchFetch(`${origin}/test/sign`, {
    method: 'POST',
    body: JSON.stringify({ id: 'job', key, etag, expires: Math.floor(Date.now() / 1000) + 300, ...overrides }),
  });
  expect(response.status).toBe(200);
  return (await response.json()).url;
}

async function media(url, headers) {
  const response = await worker.dispatchFetch(url, { headers });
  return { status: response.status, headers: Object.fromEntries(response.headers), bytes: [...new Uint8Array(await response.arrayBuffer())] };
}

describe('video moderation in real workerd', () => {
  it('submits the exact persisted body with fixed Bearer, idempotency key and honest user agent', async () => {
    const rawBody = '{ "model": "video-nsfw-filter", "input": { "num_frames": 32, "video_url": "https://app.example.invalid/fixed?expires=123&signature=test" } }\n';
    const response = await worker.dispatchFetch(`${origin}/test/submit`, { method: 'POST', body: rawBody });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'task_safety' });
    expect(requests).toEqual([{
      url: 'https://api.seeapi.com/v1/inferences', method: 'POST',
      authorization: 'Bearer test-seeapi-key', idempotencyKey,
      userAgent: 'MigosAI-Moderation/1.0 (+https://migosai.design)',
      contentType: 'application/json', body: rawBody,
    }]);
  });

  it('rejects submission and polling redirects without forwarding credentials or body', async () => {
    for (const status of [301, 302, 303, 307, 308]) {
      for (const path of ['/test/submit', '/test/poll']) {
        upstreamStatus = status;
        requests = [];
        const response = await worker.dispatchFetch(origin + path, path.endsWith('submit') ? { method: 'POST', body: '{"private":"signed-url"}' } : {});
        expect(response.status).toBe(502);
        expect(await response.json()).toMatchObject({ retryable: false });
        expect(requests.map(request => new URL(request.url).hostname)).toEqual(['api.seeapi.com']);
      }
    }
  });

  it('serves signed pending R2 bytes and Range responses, without cookie fallback', async () => {
    const url = await sign();
    const full = await media(url);
    expect(full.status).toBe(200);
    expect(full.bytes).toEqual([...bytes]);
    expect(full.headers).toMatchObject({ 'content-type': 'video/mp4', 'content-length': '10', 'cache-control': 'private, no-store' });
    const range = await media(url, { range: 'bytes=2-5', authorization: 'private-provider-token', cookie: 'provider=private' });
    expect(range.status).toBe(206);
    expect(range.bytes).toEqual([...bytes.slice(2, 6)]);
    expect(range.headers).toMatchObject({ 'content-range': 'bytes 2-5/10', 'content-length': '4', 'accept-ranges': 'bytes' });
    for (const query of ['', '?expires=invalid&signature=bad']) {
      expect((await media(`${origin}/api/moderation-media/job${query}`, ownerHeaders)).status).toBe(404);
    }
    await updateJob({ stage: 'moderation_submitting' });
    expect((await media(url)).bytes).toEqual([...bytes]);
    expect(requests).toEqual([]);
  });

  it('binds review access to the pending job, exact candidate and actual R2 ETag', async () => {
    const url = await sign();
    for (const mismatchedUrl of [await sign({ key: otherKey }), await sign({ etag: 'different-etag' }), url.replace('/job?', '/other-job?')]) {
      expect((await media(mismatchedUrl)).status).toBe(404);
    }
    for (const overrides of [{ user_id: 'other' }, { stage: 'manual_review' }, { kind: 'music' }]) {
      await updateJob({ user_id: 'u', stage: 'moderation_polling', kind: 'video', ...overrides });
      expect((await media(url)).status).toBe(404);
    }
    await updateJob({ user_id: 'u', stage: 'moderation_polling', kind: 'video' });
    const replaced = await bucket.put(key, new Uint8Array([99, 98, 97]), { httpMetadata: { contentType: 'video/mp4' } });
    expect(replaced.etag).not.toBe(etag);
    expect((await media(url)).status).toBe(404);
  });

  it('immediately revokes the same valid moderation URL after approval or rejection', async () => {
    const url = await sign();
    for (const verdict of ['passed', 'blocked']) {
      await updateJob({ status: 'reviewing', stage: 'moderation_polling', moderation_verdict: 'pending' });
      expect((await media(url)).status).toBe(200);
      await updateJob({ moderation_verdict: verdict });
      expect((await media(url, ownerHeaders)).status).toBe(404);
    }
  });

  it('releases only a completed, passed, exactly pinned result to its authenticated owner', async () => {
    const url = `${origin}/api/media/${key}`;
    const approved = { status: 'completed', stage: 'terminal', moderation_verdict: 'passed', moderation_key: key, moderation_etag: etag, result_keys: JSON.stringify([key]) };
    // A guessed path stays private even if a stale result_keys entry already exists.
    expect((await media(url, ownerHeaders)).status).toBe(404);
    for (const overrides of [
      { status: 'reviewing' }, { moderation_verdict: 'pending' }, { moderation_verdict: 'blocked' },
      { moderation_verdict: null }, { result_keys: JSON.stringify([otherKey]) },
      { moderation_key: otherKey }, { moderation_etag: null }, { moderation_etag: 'different-etag' },
    ]) {
      await updateJob({ ...approved, ...overrides });
      expect((await media(url, ownerHeaders)).status).toBe(404);
    }
    await updateJob(approved);
    expect((await media(url)).status).toBe(404);
    expect((await media(url, { cookie: `migos_session=${'y'.repeat(43)}` })).status).toBe(404);
    const full = await media(url, ownerHeaders);
    expect(full.status).toBe(200);
    expect(full.bytes).toEqual([...bytes]);
    const range = await media(url, { ...ownerHeaders, range: 'bytes=6-9' });
    expect(range.status).toBe(206);
    expect(range.bytes).toEqual([...bytes.slice(6)]);
    expect(range.headers['content-range']).toBe('bytes 6-9/10');
    await bucket.put(key, new Uint8Array([99, 98, 97]));
    expect((await media(url, ownerHeaders)).status).toBe(404);
    expect(requests).toEqual([]);
  });
});
