import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Run the real Stripe SDK, fetch, SubtleCrypto, route and D1 ledger triggers in
// workerd. Only api.stripe.com is simulated; no external request can escape.
const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://app.example.invalid';
const secret = 'whsec_workerFixture123';
const priceId = 'price_worker123';
const sessionId = 'cs_test_worker123';
let worker, db, metadata, requests, upstreamStatus;
const price = () => ({ id: priceId, object: 'price', active: true, livemode: false, currency: 'usd', unit_amount: 990, type: 'one_time', recurring: null, product: 'prod_worker123' });
const paid = () => ({ id: sessionId, object: 'checkout.session', livemode: false, mode: 'payment', status: 'complete', payment_status: 'paid', client_reference_id: metadata.orderId, metadata, amount_total: 990, amount_subtotal: 990, currency: 'usd', payment_intent: 'pi_worker123' });
const confirmed = () => ({ ...paid(), payment_intent: { id: 'pi_worker123', object: 'payment_intent', livemode: false, status: 'succeeded', currency: 'usd', amount: 990, amount_received: 990, metadata }, line_items: { object: 'list', has_more: false, data: [{ id: 'li_worker123', object: 'item', quantity: 1, amount_total: 990, amount_subtotal: 990, currency: 'usd', price: price() }] } });

beforeAll(async () => {
  const bundled = await build({
    stdin: { resolveDir: root, contents: `
      import { createCheckout } from './lib/server/payments';
      import { reserveGeneration } from './lib/server/billing';
      import { POST } from './app/api/webhooks/stripe/route';
      export default { async fetch(request, env) {
        globalThis.testEnv = env;
        try {
          const path = new URL(request.url).pathname;
          if (path === '/checkout') return Response.json(await createCheckout(env, {id:'u',email:'a@b.c',name:'Test'}, 'starter', 'ja'));
          if (path === '/spend') return Response.json(await reserveGeneration(env.DB, 'u', 'spend', 'video', {}, 400));
          if (path === '/api/webhooks/stripe') return POST(request, {});
          return new Response('Not found', {status:404});
        } catch(error) { return Response.json({error:error.message}, {status:error.status || 503}); }
      }};
    ` },
    bundle: true, platform: 'browser', format: 'esm', write: false,
    external: ['node:crypto'],
    plugins: [{ name: 'worker-context', setup(builder) {
      builder.onResolve({ filter: /^crypto$/ }, () => ({ path: 'node:crypto', external: true }));
      builder.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({ path: 'context', namespace: 'test-context' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-context' }, () => ({ contents: 'export function getCloudflareContext() {return {env:globalThis.testEnv};}' }));
    } }],
  });
  worker = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundled.outputFiles[0].text, compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'], cf: false,
    d1Databases: ['DB'],
    bindings: { APP_URL: origin, PAYMENT_PROVIDER: 'stripe', STRIPE_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_workerFixture123', STRIPE_WEBHOOK_SECRET: secret, STRIPE_PRICE_STARTER: priceId },
    outboundService: async request => {
      const url = new URL(request.url);
      requests.push({ host: url.hostname, path: url.pathname, method: request.method, authorization: request.headers.get('authorization'), idempotency: request.headers.get('idempotency-key') });
      if (url.hostname !== 'api.stripe.com') return new Response('Blocked unexpected external destination', { status: 403 });
      if (upstreamStatus !== 200) return new Response('No redirect', { status: upstreamStatus, headers: { location: 'https://untrusted.example.invalid/capture' } });
      if (url.pathname === `/v1/prices/${priceId}`) return Response.json(price());
      if (url.pathname === '/v1/checkout/sessions' && request.method === 'POST') {
        const body = new URLSearchParams(await request.text());
        metadata = Object.fromEntries([...body].filter(([key]) => key.startsWith('metadata[')).map(([key, value]) => [key.slice(9, -1), value]));
        return Response.json({ ...paid(), status: 'open', payment_status: 'unpaid', url: `https://checkout.stripe.com/c/pay/${sessionId}` });
      }
      if (url.pathname === `/v1/checkout/sessions/${sessionId}`) return Response.json(confirmed());
      return new Response('Unexpected Stripe request', { status: 400 });
    },
  }));
  db = await worker.getD1Database('DB');
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
    // D1 exec accepts one statement per line; keep complete trigger bodies together.
    const sql = readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/CREATE TRIGGER[\s\S]*?END;/g, statement => statement.replace(/\s+/g, ' '));
    await db.exec(sql);
  }
  await db.exec("INSERT INTO users(id,email,name,credits) VALUES('u','a@b.c','Test',100)");
}, 30000);
afterAll(async () => { await worker?.dispose(); });
beforeEach(async () => {
  metadata = null; requests = []; upstreamStatus = 200;
  await db.batch(['DELETE FROM webhook_events', 'DELETE FROM credit_ledger', 'DELETE FROM generations', 'DELETE FROM orders', 'UPDATE users SET credits=100'].map(sql => db.prepare(sql)));
});
async function checkout() { return worker.dispatchFetch(origin + '/checkout'); }
async function webhook(id = 'evt_worker123', timestamp = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify({ id, object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: paid() } });
  const signature = `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')}`;
  return worker.dispatchFetch(origin + '/api/webhooks/stripe', { method: 'POST', body: raw, headers: { 'stripe-signature': signature } });
}

describe('Stripe Checkout and accounting in workerd', () => {
  it('creates Checkout and verifies signatures, then settles concurrent events once after credits are spent', async () => {
    const response = await checkout();
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.checkoutUrl).toBe(`https://checkout.stripe.com/c/pay/${sessionId}`);
    expect(requests).toEqual([
      { host: 'api.stripe.com', path: `/v1/prices/${priceId}`, method: 'GET', authorization: 'Bearer sk_test_workerFixture123', idempotency: null },
      { host: 'api.stripe.com', path: '/v1/checkout/sessions', method: 'POST', authorization: 'Bearer sk_test_workerFixture123', idempotency: `stripe:test:${result.orderId}` },
    ]);
    expect((await webhook()).status).toBe(200);
    expect(await db.prepare("SELECT credits FROM users WHERE id='u'").first()).toEqual({ credits: 400 });
    expect((await worker.dispatchFetch(origin + '/spend')).status).toBe(200);
    const duplicates = await Promise.all(Array.from({ length: 6 }, (_, index) => webhook(`evt_worker${index}`)));
    expect(duplicates.map(response => response.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(await db.prepare("SELECT credits FROM users WHERE id='u'").first()).toEqual({ credits: 0 });
    expect(await db.prepare("SELECT count(*) AS n FROM credit_ledger WHERE kind='payment'").first()).toEqual({ n: 1 });
  });
  it('rejects stale signed requests without granting credits', async () => {
    expect((await checkout()).status).toBe(200);
    expect((await webhook('evt_stale123', Math.floor(Date.now() / 1000) - 301)).status).toBe(401);
    expect(await db.prepare("SELECT credits FROM users WHERE id='u'").first()).toEqual({ credits: 100 });
  });
  it('never follows API redirects with the account credential', async () => {
    for (const status of [301, 302, 303, 307, 308]) {
      upstreamStatus = status; requests = [];
      const response = await checkout();
      expect(response.status).toBe(502);
      expect(requests.map(request => request.host)).toEqual(['api.stripe.com']);
      expect(await db.prepare('SELECT count(*) AS n FROM orders').first()).toEqual({ n: 0 });
    }
  });
});
