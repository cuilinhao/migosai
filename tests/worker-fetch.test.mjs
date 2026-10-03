import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fileURLToPath } from 'node:url';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';

// Keep fetch and its Request validation inside workerd. Only the external
// network is replaced; D1 and R2 use isolated, non-persistent local bindings.
const root = fileURLToPath(new URL('../', import.meta.url));
let worker;
let upstreamStatus = 200;
let requests = [];
let checkoutPublicKey;
const redirectStatuses = [301, 302, 303, 307, 308];
const checkoutMerchantId = 'MER_1234567890123456789012';
const checkoutStoreId = 'STO_1234567890123456789012';
const checkoutProductId = 'PROD_1234567890123456789012';
const checkoutSessionId = 'cs_550e8400-e29b-41d4-a716-446655440000';
const checkoutUrl = `https://checkout.waffo.ai/test-store/checkout/${checkoutSessionId}`;
const checkoutResponse = () => ({ data: { sessionId: checkoutSessionId, checkoutUrl, expiresAt: new Date(Date.now() + 2700000).toISOString() } });

beforeAll(async () => {
  // Ephemeral test credentials exercise the production SDK signing path without
  // storing or transmitting a real merchant's private key.
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  checkoutPublicKey = keys.publicKey;
  const bundled = await build({
    stdin: {
      resolveDir: root,
      contents: `
        import { providerRequest } from './lib/server/provider';
        import { createKieVideo, getKieVideo } from './lib/server/kie';
        import { createCheckout } from './lib/server/payments';
        import { storeProviderMedia } from './lib/server/media';
        export default { async fetch(request, env) {
          const path = new URL(request.url).pathname;
          try {
            if (path === '/provider-post') return Response.json(await providerRequest(env, '/v1/music/generations', { model: 'suno', version: 'v6' }));
            if (path === '/provider-get') return Response.json(await providerRequest(env, '/v1/music/tasks/test-task'));
            if (path === '/kie-post') return Response.json({ taskId: await createKieVideo(env, { duration: 5, resolution: '480p', aspect: '9:16', mode: 'pet' }, ['https://app.example.invalid/left', 'https://app.example.invalid/right']) });
            if (path === '/kie-get') return Response.json(await getKieVideo(env, 'kie-test-task'));
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
    external: ['node:crypto'],
    write: false,
    plugins: [{
      name: 'worker-server-imports',
      setup(builder) {
        builder.onResolve({ filter: /^crypto$/ }, () => ({ path: 'node:crypto', external: true }));
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
      APP_URL: 'https://app.example.invalid',
      APIMART_API_KEY: 'test-provider-key',
      APIMART_MEDIA_HOSTS: 'media.example.invalid',
      KIE_API_KEY: 'test-kie-key',
      KIE_MEDIA_HOSTS: 'media.example.invalid',
      WAFFO_MERCHANT_ID: checkoutMerchantId,
      WAFFO_PRIVATE_KEY: keys.privateKey,
      WAFFO_MODE: 'test',
      WAFFO_STORE_ID: checkoutStoreId,
      WAFFO_PRODUCT_STARTER: checkoutProductId,
    },
    outboundService: async (request) => {
      const url = new URL(request.url);
      const recorded = { host: url.hostname, method: request.method, authorization: request.headers.get('authorization'), apiKey: request.headers.get('x-api-key') };
      if (url.hostname === 'api.waffo.ai') {
        Object.assign(recorded, {
          path: url.pathname,
          merchantId: request.headers.get('x-merchant-id'),
          timestamp: request.headers.get('x-timestamp'),
          signature: request.headers.get('x-signature'),
          idempotencyKey: request.headers.get('x-idempotency-key'),
          body: await request.text(),
        });
      }
      requests.push(recorded);
      // No fallback fetch: even a broken redirect policy cannot reach the internet.
      if (!['api.apimart.ai', 'api.kie.ai', 'api.waffo.ai', 'media.example.invalid'].includes(url.hostname)) return new Response('Blocked external destination', { status: 403 });
      if (upstreamStatus !== 200) {
        const init = { status: upstreamStatus, headers: { location: 'https://untrusted.example.invalid/capture' } };
        // A valid-looking body must not make the SDK accept a failed HTTP status.
        if (url.hostname === 'api.waffo.ai') return Response.json(checkoutResponse(), init);
        return new Response('Do not follow this response', init);
      }
      if (url.hostname === 'api.apimart.ai') return Response.json({ code: 200, data: request.method === 'POST' ? [{ task_id: 'test-task' }] : { id: 'test-task', status: 'processing' } });
      if (url.hostname === 'api.kie.ai') return Response.json({ code: 200, msg: 'success', data: request.method === 'POST' ? { taskId: 'kie-test-task' } : { taskId: 'kie-test-task', model: 'bytedance/seedance-2', state: 'generating', resultJson: null } });
      if (url.hostname === 'api.waffo.ai') return Response.json(checkoutResponse());
      return new Response(new Uint8Array([0, 1, 2, 3]), { headers: { 'content-type': 'video/mp4', 'content-length': '4' } });
    },
  }));
  const db = await worker.getD1Database('DB');
  await db.exec("CREATE TABLE orders(id TEXT PRIMARY KEY,user_id TEXT,pack_id TEXT,product_id TEXT,amount INTEGER,currency TEXT,credits INTEGER,checkout_id TEXT,provider TEXT,provider_mode TEXT,store_id TEXT,status TEXT NOT NULL DEFAULT 'pending')");
}, 30000);

afterAll(async () => { await worker?.dispose(); });
beforeEach(() => { upstreamStatus = 200; requests = []; });

async function call(path) {
  const response = await worker.dispatchFetch('https://app.example.invalid' + path);
  return { status: response.status, body: await response.json() };
}

describe('production outbound requests in workerd', () => {
  it('submits and polls Kie through the real workerd fetch with only its own credential', async () => {
    expect(await call('/kie-post')).toEqual({ status: 200, body: { taskId: 'kie-test-task' } });
    expect(await call('/kie-get')).toMatchObject({ status: 200, body: { status: 'processing' } });
    expect(requests).toEqual([
      { host: 'api.kie.ai', method: 'POST', authorization: 'Bearer test-kie-key', apiKey: null },
      { host: 'api.kie.ai', method: 'GET', authorization: 'Bearer test-kie-key', apiKey: null },
    ]);
  });

  it('never follows Kie redirects with the secret or a signed reference URL', async () => {
    for (const status of redirectStatuses) for (const path of ['/kie-post', '/kie-get']) {
      upstreamStatus = status; requests = [];
      const result = await call(path);
      expect(result.status).toBe(502);
      expect(result.body).toMatchObject(path === '/kie-post' ? { uncertain: true, transientQuery: false } : { uncertain: false, transientQuery: true });
      expect(requests.map(request => request.host)).toEqual(['api.kie.ai']);
    }
  });

  it('submits a provider request instead of failing Request construction', async () => {
    expect(await call('/provider-post')).toEqual({ status: 200, body: [{ task_id: 'test-task' }] });
    expect(requests).toEqual([{ host: 'api.apimart.ai', method: 'POST', authorization: 'Bearer test-provider-key', apiKey: null }]);
  });

  it('queries a provider task through the real workerd fetch', async () => {
    expect(await call('/provider-get')).toEqual({ status: 200, body: { id: 'test-task', status: 'processing' } });
    expect(requests).toHaveLength(1);
  });

  it('creates an RSA-signed Waffo checkout and saves its session in real local D1', async () => {
    const result = await call('/checkout');
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.checkoutUrl).toBe(checkoutUrl);
    const db = await worker.getD1Database('DB');
    expect(await db.prepare('SELECT checkout_id,provider,provider_mode,store_id FROM orders WHERE id=?').bind(result.body.orderId).first()).toEqual({
      checkout_id: checkoutSessionId,
      provider: 'waffo',
      provider_mode: 'test',
      store_id: checkoutStoreId,
    });
    expect(requests).toHaveLength(1);
    const request = requests[0];
    expect(request).toMatchObject({ host: 'api.waffo.ai', path: '/v1/actions/checkout/create-session', method: 'POST', authorization: null, apiKey: null, merchantId: checkoutMerchantId, idempotencyKey: result.body.orderId });
    expect(request.timestamp).toMatch(/^\d+$/);
    expect(request.signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
    const bodyHash = createHash('sha256').update(request.body).digest('base64');
    const canonical = `${request.method}\n${request.path}\n${request.timestamp}\n${bodyHash}`;
    expect(verify('sha256', Buffer.from(canonical), checkoutPublicKey, Buffer.from(request.signature, 'base64'))).toBe(true);
    expect(JSON.parse(request.body)).toMatchObject({
      productId: checkoutProductId,
      currency: 'USD',
      buyerEmail: 'test@example.invalid',
      successUrl: `https://app.example.invalid/pricing?checkout=completed&orderId=${result.body.orderId}`,
      orderMerchantExternalId: result.body.orderId,
      metadata: { orderId: result.body.orderId, userId: 'test-user', packId: 'starter', productId: checkoutProductId },
    });
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

  it('rejects checkout redirects without forwarding Waffo signatures to their destination', async () => {
    for (const status of redirectStatuses) {
      upstreamStatus = status; requests = [];
      expect((await call('/checkout')).status).toBe(502);
      expect(requests.map(r => r.host)).toEqual(['api.waffo.ai']);
      expect(requests[0].signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
    }
  });

  it('rejects failed checkout HTTP statuses even with a success-shaped response body', async () => {
    for (const status of [400, 401, 403, 429, 500, 503]) {
      upstreamStatus = status; requests = [];
      expect((await call('/checkout')).status).toBe(502);
      expect(requests.map(r => r.host)).toEqual(['api.waffo.ai']);
      const db = await worker.getD1Database('DB');
      expect(await db.prepare('SELECT checkout_id FROM orders WHERE id=?').bind(requests[0].idempotencyKey).first()).toEqual({ checkout_id: null });
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
