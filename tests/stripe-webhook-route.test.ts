import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { POST } from '../app/api/webhooks/stripe/route';
const bindings = vi.hoisted(() => ({ current: {} }));
vi.mock('../lib/server/env', async importOriginal => ({ ...await importOriginal<typeof import('../lib/server/env')>(), getEnv: async () => bindings.current }));
const secret = 'whsec_fixtureOnly123';
function signature(raw: string) { const time = Math.floor(Date.now() / 1000); return `t=${time},v1=${createHmac('sha256', secret).update(`${time}.${raw}`).digest('hex')}`; }
function body() { return JSON.stringify({ id: 'evt_route123', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: 'cs_test_unpaid123', object: 'checkout.session', payment_status: 'unpaid' } } }, null, 2); }
beforeEach(() => { bindings.current = { ...jobEnv(database().db), STRIPE_MODE: 'test', STRIPE_WEBHOOK_SECRET: secret }; });
afterEach(() => vi.restoreAllMocks());
describe('Stripe webhook HTTP boundary', () => {
  it('verifies original JSON whitespace before acknowledging unpaid events', async () => {
    const raw = body();
    const response = await POST(new Request('https://example.test/api/webhooks/stripe', { method: 'POST', body: raw, headers: { 'stripe-signature': signature(raw) } }), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });
  it('rejects unsigned requests', async () => {
    expect((await POST(new Request('https://example.test/api/webhooks/stripe', { method: 'POST', body: body() }), {})).status).toBe(401);
  });
  it.each([true, false])('limits both declared and streamed body bytes (declared=%s)', async declared => {
    const raw = 'x'.repeat(256 * 1024 + 1);
    const response = await POST(new Request('https://example.test/api/webhooks/stripe', { method: 'POST', body: raw, headers: { 'stripe-signature': signature(raw), ...(declared ? { 'content-length': String(raw.length) } : {}) } }), {});
    expect(response.status).toBe(413);
  });
});
