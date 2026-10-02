import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fileURLToPath } from 'node:url';

// Keep fetch and its Request validation inside workerd. Only the external
// network is replaced; D1 and R2 use isolated, non-persistent local bindings.
const root = fileURLToPath(new URL('../', import.meta.url));
let worker;
let upstreamStatus = 200;
let requests = [];
const redirectStatuses = [301, 302, 303, 307, 308];

beforeAll(async () => {
  const bundled = await build({
    stdin: {
      resolveDir: root,
      contents: `
        import { providerRequest } from './lib/server/provider';
        import { createCheckout } from './lib/server/payments';
        import { storeProviderMedia } from './lib/server/media';
        export default { async fetch(request, env) {
          const path = new URL(request.url).pathname;
          try {
            if (path === '/provider-post') return Response.json(await providerRequest(env, '/v1/music/generations', { model: 'suno', version: 'v6' }));
            if (path === '/provider-get') return Response.json(await providerRequest(env, '/v1/music/tasks/test-task'));
            if (path === '/checkout') return Response.json(await createCheckout(env, { id: 'test-user', name: 'Test', email: 'test@example.invalid' }, 'starter'));
            if (path === '/media') {
              const key = await storeProviderMedia(env, 'https://media.example.invalid/video.mp4', 'test-result', 'video');
              const object = await env.MEDIA.get(key);
              return Response.json({ key, bytes: Array.from(new Uint8Array(await object.arrayBuffer())), contentType: object.httpMetadata.contentType });
            }
            return new Response('Not found', { status: 404 });
          } catch (error) {
            return Response.json({ error: error.message, uncertain: error.uncertain, transientQuery: error.transientQuery }, { status: error.status || 502 });
          }
        }};
      `,
    },
    bundle: true,
    platform: 'browser',
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
    cf: false,
    d1Databases: ['DB'],
    r2Buckets: ['MEDIA'],
    bindings: {
      APP_URL: 'https://app.example.invalid',
      APIMART_API_KEY: 'test-provider-key',
      APIMART_MEDIA_HOSTS: 'media.example.invalid',
      CREEM_API_KEY: 'test-checkout-key',
      CREEM_MODE: 'test',
      CREEM_PRODUCT_STARTER: 'test-product',
    },
    outboundService: async (request) => {
      const url = new URL(request.url);
      requests.push({ host: url.hostname, method: request.method, authorization: request.headers.get('authorization'), apiKey: request.headers.get('x-api-key') });
      // No fallback fetch: even a broken redirect policy cannot reach the internet.
      if (!['api.apimart.ai', 'test-api.creem.io', 'media.example.invalid'].includes(url.hostname)) return new Response('Blocked external destination', { status: 403 });
      if (upstreamStatus !== 200) return new Response('Do not follow this response', { status: upstreamStatus, headers: { location: 'https://untrusted.example.invalid/capture' } });
      if (url.hostname === 'api.apimart.ai') return Response.json({ code: 200, data: request.method === 'POST' ? [{ task_id: 'test-task' }] : { id: 'test-task', status: 'processing' } });
      if (url.hostname === 'test-api.creem.io') return Response.json({ id: 'test-checkout', checkout_url: 'https://checkout.creem.io/test-checkout' });
      return new Response(new Uint8Array([0, 1, 2, 3]), { headers: { 'content-type': 'video/mp4', 'content-length': '4' } });
    },
  }));
  const db = await worker.getD1Database('DB');
  await db.exec('CREATE TABLE orders(id TEXT PRIMARY KEY,user_id TEXT,pack_id TEXT,product_id TEXT,amount INTEGER,currency TEXT,credits INTEGER,checkout_id TEXT)');
}, 30000);

afterAll(async () => { await worker?.dispose(); });
beforeEach(() => { upstreamStatus = 200; requests = []; });

async function call(path) {
  const response = await worker.dispatchFetch('https://app.example.invalid' + path);
  return { status: response.status, body: await response.json() };
}

describe('production outbound requests in workerd', () => {
  it('submits a provider request instead of failing Request construction', async () => {
    expect(await call('/provider-post')).toEqual({ status: 200, body: [{ task_id: 'test-task' }] });
    expect(requests).toEqual([{ host: 'api.apimart.ai', method: 'POST', authorization: 'Bearer test-provider-key', apiKey: null }]);
  });

  it('queries a provider task through the real workerd fetch', async () => {
    expect(await call('/provider-get')).toEqual({ status: 200, body: { id: 'test-task', status: 'processing' } });
    expect(requests).toHaveLength(1);
  });

  it('creates a checkout and saves its provider ID in real local D1', async () => {
    const result = await call('/checkout');
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.checkoutUrl).toBe('https://checkout.creem.io/test-checkout');
    const db = await worker.getD1Database('DB');
    expect(await db.prepare('SELECT checkout_id FROM orders WHERE id=?').bind(result.body.orderId).first()).toEqual({ checkout_id: 'test-checkout' });
    expect(requests).toEqual([{ host: 'test-api.creem.io', method: 'POST', authorization: null, apiKey: 'test-checkout-key' }]);
  });

  it('downloads approved media and commits its bytes to real local R2', async () => {
    expect(await call('/media')).toEqual({ status: 200, body: { key: 'test-result', bytes: [0, 1, 2, 3], contentType: 'video/mp4' } });
    expect(requests).toHaveLength(1);
  });

  it('treats provider POST redirects as ambiguous without forwarding credentials', async () => {
    for (const status of redirectStatuses) {
      upstreamStatus = status; requests = [];
      const result = await call('/provider-post');
      expect(result.status).toBe(502);
      expect(result.body).toMatchObject({ uncertain: true, transientQuery: false });
      expect(requests.map(r => r.host)).toEqual(['api.apimart.ai']);
    }
  });

  it('keeps provider GET redirects retryable without following them', async () => {
    for (const status of redirectStatuses) {
      upstreamStatus = status; requests = [];
      const result = await call('/provider-get');
      expect(result.status).toBe(502);
      expect(result.body).toMatchObject({ uncertain: false, transientQuery: true });
      expect(requests.map(r => r.host)).toEqual(['api.apimart.ai']);
    }
  });

  it('rejects checkout redirects without sending the API key to their destination', async () => {
    for (const status of redirectStatuses) {
      upstreamStatus = status; requests = [];
      expect((await call('/checkout')).status).toBe(502);
      expect(requests.map(r => r.host)).toEqual(['test-api.creem.io']);
    }
  });

  it('rejects media redirects instead of bypassing the hostname allowlist', async () => {
    for (const status of redirectStatuses) {
      upstreamStatus = status; requests = [];
      await (await worker.getR2Bucket('MEDIA')).delete('test-result');
      expect((await call('/media')).status).toBe(502);
      expect(requests.map(r => r.host)).toEqual(['media.example.invalid']);
      expect(await (await worker.getR2Bucket('MEDIA')).head('test-result')).toBeNull();
    }
  });
});
