import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { createCheckout } from '../lib/server/payments';
import type { Env } from '../lib/server/env';

const priceId = 'price_starter123';
const sessionId = 'cs_test_checkout123';
const user = { id: 'u', email: 'a@b.c', name: 'Test' };
const checkoutUrl = `https://checkout.stripe.com/c/pay/${sessionId}#safe`;
function env(db: D1Database): Env { return { ...jobEnv(db), PAYMENT_PROVIDER: 'stripe', STRIPE_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_fixtureOnly123', STRIPE_WEBHOOK_SECRET: 'whsec_fixtureOnly123', STRIPE_PRICE_STARTER: priceId } as Env; }
function price(overrides = {}) { return { id: priceId, object: 'price', active: true, livemode: false, currency: 'usd', unit_amount: 990, type: 'one_time', recurring: null, product: 'prod_starter123', ...overrides }; }
function checkoutFixture(params: URLSearchParams, overrides = {}) { return { id: sessionId, object: 'checkout.session', livemode: false, mode: 'payment', status: 'open', payment_status: 'unpaid', amount_total: 990, currency: 'usd', url: checkoutUrl, client_reference_id: params.get('client_reference_id'), metadata: Object.fromEntries(Array.from(params).filter(([key]) => key.startsWith('metadata[')).map(([key, value]) => [key.slice(9, -1), value])), ...overrides }; }
function checkoutApi(priceOverrides = {}, sessionOverrides = {}) {
  let sent = new URLSearchParams();
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== 'https://api.stripe.com' || init?.redirect !== 'manual') throw Error('Unsafe outbound request');
    if (url.pathname === `/v1/prices/${priceId}`) return Response.json(price(priceOverrides));
    if (url.pathname === '/v1/checkout/sessions' && init?.method === 'POST') {
      sent = new URLSearchParams(String(init.body));
      return Response.json(checkoutFixture(sent, sessionOverrides));
    }
    throw Error('Unexpected Stripe request');
  });
  return { fetcher, sent: () => sent };
}
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-25T00:00:00Z')); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Stripe Black Friday credit packs', () => {
  it.each([
    ['starter', 990, 360], ['creator', 2990, 1140], ['pro', 4990, 1920], ['business', 9990, 3960],
  ] as const)('quotes and freezes the %s pack at its original amount', async (packId, amount, credits) => {
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z')); const { db, sqlite } = database();
    const configuredPrice = `price_${packId}123`;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).includes('/v1/prices/')) return Response.json(price({ id: configuredPrice, unit_amount: amount }));
      return Response.json(checkoutFixture(new URLSearchParams(String(init?.body)), { amount_total: amount }));
    });
    await createCheckout({ ...env(db), [`STRIPE_PRICE_${packId.toUpperCase()}`]: configuredPrice }, user, packId, 'en', credits);
    expect(sqlite.prepare('SELECT amount,credits,product_id FROM orders').get()).toEqual({ amount, credits, product_id: configuredPrice });
  });
  it('freezes bonus credits and displays the total without discounting the Stripe price', async () => {
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
    const { db, sqlite } = database(); const api = checkoutApi();
    await createCheckout(env(db), user, 'starter', 'en', 360);
    expect(sqlite.prepare('SELECT amount,credits,status FROM orders').get()).toEqual({ amount: 990, credits: 360, status: 'pending' });
    for (const prefix of ['metadata', 'payment_intent_data[metadata]']) {
      expect(api.sent().get(`${prefix}[credits]`)).toBe('360');
      expect(api.sent().get(`${prefix}[baseCredits]`)).toBe('300');
      expect(api.sent().get(`${prefix}[bonusCredits]`)).toBe('60');
      expect(api.sent().get(`${prefix}[campaignId]`)).toBe('black-friday-2026');
    }
    expect(api.sent().get('line_items[0][price]')).toBe(priceId);
    expect(api.sent().get('custom_text[submit][message]')).toContain('360');
    expect(api.sent().get('custom_text[submit][message]')).toContain('60');
    expect(balance(sqlite)).toEqual({ credits: 100 });
  });
  it('does not show promotional checkout text outside the campaign', async () => {
    const { db } = database(); const api = checkoutApi();
    await createCheckout(env(db), user, 'starter', 'en', 300);
    expect(api.sent().get('custom_text[submit][message]')).toBeNull();
  });
  it.each([0, -1, 1.5, '360', null, Number.MAX_SAFE_INTEGER + 1])('rejects invalid expected credits %j before creating a payment', async expected => {
    const { db, sqlite } = database(); const api = checkoutApi();
    await expect(createCheckout(env(db), user, 'starter', 'en', expected)).rejects.toMatchObject({ status: 400 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 0 });
    expect(api.fetcher).not.toHaveBeenCalled();
  });
  it.each([['2026-11-27T00:00:00Z', 300], ['2026-12-02T00:00:00Z', 360]])('rejects a stale displayed offer at %s', async (date, expected) => {
    vi.setSystemTime(new Date(date)); const { db, sqlite } = database(); const api = checkoutApi();
    await expect(createCheckout(env(db), user, 'starter', 'en', expected)).rejects.toMatchObject({ status: 409, message: 'This credit pack offer has changed. Refresh pricing before you check out.' });
    expect(sqlite.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 0 });
    expect(api.fetcher).not.toHaveBeenCalled();
  });
  it.each([
    ['2026-11-19T23:59:59Z', '2026-11-20T00:00:01Z', 300],
    ['2026-12-01T23:59:59Z', '2026-12-02T00:00:01Z', 360],
  ])('honors the creation snapshot from %s when paid at %s and never grants twice', async (created, paid, credits) => {
    vi.setSystemTime(new Date(created)); const { db, sqlite } = database(); const api = checkoutApi();
    const order = await createCheckout(env(db), user, 'starter');
    const snapshot = Object.fromEntries([...api.sent()].filter(([key]) => key.startsWith('metadata[')).map(([key, value]) => [key.slice(9, -1), value]));
    api.fetcher.mockRestore(); vi.setSystemTime(new Date(paid));
    const paidCheckout = paidSession({ client_reference_id: order.orderId, metadata: snapshot });
    const confirmed = confirmedSession({ ...paidCheckout, payment_intent: { ...confirmedSession().payment_intent, metadata: snapshot } });
    confirmApi(confirmed);
    await applyEvent(env(db), event(paidCheckout));
    expect(balance(sqlite)).toEqual({ credits: 100 + credits });
    await reserveGeneration(db, 'u', 'consume-campaign', 'video', {}, 100 + credits);
    await applyEvent(env(db), event(paidCheckout));
    await applyEvent(env(db), event(paidCheckout, { id: 'evt_later123', type: 'checkout.session.async_payment_succeeded' }));
    expect(balance(sqlite)).toEqual({ credits: 0 });
    expect(sqlite.prepare("SELECT amount FROM credit_ledger WHERE kind='payment'").all()).toEqual([{ amount: credits }]);
  });
  it.each(['baseCredits', 'bonusCredits', 'campaignId'])('rejects altered offer %s before offering checkout', async field => {
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z')); const { db, sqlite } = database();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).includes('/v1/prices/')) return Response.json(price());
      const result = checkoutFixture(new URLSearchParams(String(init?.body)));
      result.metadata[field] = 'altered'; return Response.json(result);
    });
    await expect(createCheckout(env(db), user, 'starter')).rejects.toMatchObject({ status: 502 });
    expect(sqlite.prepare('SELECT checkout_id FROM orders').get()).toEqual({ checkout_id: null });
    fetcher.mockRestore();
  });
  it.each(['credits', 'baseCredits', 'bonusCredits', 'campaignId'])('rejects altered paid offer metadata %s without granting credits', async field => {
    const { db, sqlite } = database(); pending(sqlite);
    sqlite.prepare('UPDATE orders SET credits=360').run();
    const snapshot = { ...metadata, credits: '360', baseCredits: '300', bonusCredits: '60', campaignId: 'black-friday-2026', [field]: 'altered' };
    const paid = paidSession({ metadata: snapshot });
    confirmApi(confirmedSession({ metadata: snapshot, payment_intent: { ...confirmedSession().payment_intent, metadata: snapshot } }));
    await expect(applyEvent(env(db), event(paid))).rejects.toMatchObject({ status: 400 });
    assertUnpaid(sqlite);
  });
  it('offers the bonus again on a separate purchase by the same customer', async () => {
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z')); const { db, sqlite } = database();
    const firstApi = checkoutApi(); await createCheckout(env(db), user, 'starter'); firstApi.fetcher.mockRestore();
    checkoutApi({}, { id: 'cs_test_second123' }); await createCheckout(env(db), user, 'starter');
    expect(sqlite.prepare('SELECT amount,credits FROM orders').all()).toEqual([{ amount: 990, credits: 360 }, { amount: 990, credits: 360 }]);
  });
});

describe('Stripe Checkout creation', () => {
  it('omits the guest placeholder email and keeps the wallet ownership and immutable credit quote', async () => {
    const { db, sqlite } = database();
    sqlite.prepare('UPDATE users SET credits=0 WHERE id=?').run('u');
    const api = checkoutApi();
    const guest = { ...user, email: 'guest-id@guest.invalid', isGuest: true };
    const result = await createCheckout(env(db), guest, 'starter', 'en', 300);
    expect(api.sent().has('customer_email')).toBe(false);
    expect(api.sent().has('customer')).toBe(false);
    expect(api.sent().get('metadata[userId]')).toBe('u');
    expect(api.sent().get('payment_intent_data[metadata][userId]')).toBe('u');
    expect(api.sent().get('metadata[credits]')).toBe('300');
    expect(api.sent().get('metadata[amount]')).toBe('990');
    expect(sqlite.prepare('SELECT user_id,amount,credits,status FROM orders WHERE id=?').get(result.orderId))
      .toEqual({ user_id: 'u', amount: 990, credits: 300, status: 'pending' });
    expect(balance(sqlite)).toEqual({ credits: 0 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM credit_ledger').get()).toEqual({ n: 0 });
  });

  it('credits a guest only after verified payment and preserves ownership through duplicate callbacks and spending', async () => {
    const { db, sqlite } = database();
    sqlite.prepare('UPDATE users SET credits=0 WHERE id=?').run('u');
    const api = checkoutApi();
    const guest = { ...user, email: 'guest-id@guest.invalid', isGuest: true };
    const order = await createCheckout(env(db), guest, 'starter', 'en', 300);
    const snapshot = Object.fromEntries([...api.sent()].filter(([key]) => key.startsWith('metadata[')).map(([key, value]) => [key.slice(9, -1), value]));
    api.fetcher.mockRestore();
    const paid = paidSession({ client_reference_id: order.orderId, metadata: snapshot, customer_details: { email: 'existing-account@example.test' } });
    await applyEvent(env(db), event({ ...paid, payment_status: 'unpaid' }));
    expect(balance(sqlite)).toEqual({ credits: 0 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM credit_ledger').get()).toEqual({ n: 0 });
    confirmApi(confirmedSession({ ...paid, payment_intent: { ...confirmedSession().payment_intent, metadata: snapshot } }));
    await applyEvent(env(db), event(paid));
    expect(balance(sqlite)).toEqual({ credits: 300 });
    await reserveGeneration(db, 'u', 'guest-generation', 'video', {}, 15);
    await applyEvent(env(db), event(paid));
    await applyEvent(env(db), event(paid, { id: 'evt_guestRetry123', type: 'checkout.session.async_payment_succeeded' }));
    expect(balance(sqlite)).toEqual({ credits: 285 });
    expect(sqlite.prepare("SELECT user_id,amount FROM credit_ledger WHERE kind='payment'").all()).toEqual([{ user_id: 'u', amount: 300 }]);
    expect(sqlite.prepare('SELECT user_id,amount,credits,status FROM orders WHERE id=?').get(order.orderId))
      .toEqual({ user_id: 'u', amount: 990, credits: 300, status: 'paid' });
  });

  it.each([
    ['starter', 990, 300], ['creator', 2990, 950], ['pro', 4990, 1600], ['business', 9990, 3300],
  ] as const)('freezes the approved %s pack credits and amount for a new purchase', async (packId, amount, credits) => {
    const { db, sqlite } = database();
    const configuredPrice = `price_${packId}123`;
    let sent = new URLSearchParams();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === `/v1/prices/${configuredPrice}`) return Response.json(price({ id: configuredPrice, unit_amount: amount }));
      if (url.pathname !== '/v1/checkout/sessions') throw Error('Unexpected Stripe request');
      sent = new URLSearchParams(String(init?.body));
      return Response.json(checkoutFixture(sent, { amount_total: amount }));
    });
    const checkout = await createCheckout({ ...env(db), [`STRIPE_PRICE_${packId.toUpperCase()}`]: configuredPrice }, user, packId, 'en', credits);
    expect(sqlite.prepare('SELECT amount,credits,status FROM orders WHERE id=?').get(checkout.orderId))
      .toEqual({ amount, credits, status: 'pending' });
    expect(sent.get('metadata[credits]')).toBe(String(credits));
    expect(sent.get('metadata[baseCredits]')).toBe(String(credits));
    expect(sent.get('metadata[bonusCredits]')).toBe('0');
  });

  it('binds one-time checkout and the immutable price/credit snapshot to the authenticated user', async () => {
    const { db, sqlite } = database();
    const api = checkoutApi();
    const result = await createCheckout(env(db), user, 'starter', 'zh-TW');
    expect(result).toEqual({ checkoutUrl, orderId: expect.any(String) });
    expect(sqlite.prepare('SELECT * FROM orders').get()).toMatchObject({ id: result.orderId, user_id: 'u', pack_id: 'starter', product_id: priceId, amount: 990, currency: 'USD', credits: 300, checkout_id: sessionId, provider: 'stripe', provider_mode: 'test', status: 'pending' });
    const sent = api.sent();
    expect(sent.get('mode')).toBe('payment');
    expect(sent.get('line_items[0][price]')).toBe(priceId);
    expect(sent.get('line_items[0][quantity]')).toBe('1');
    expect(sent.get('client_reference_id')).toBe(result.orderId);
    expect(sent.get('metadata[app]')).toBe('migosai');
    expect(sent.get('payment_intent_data[metadata][app]')).toBe('migosai');
    expect(sent.get('metadata[userId]')).toBe('u');
    expect(sent.get('metadata[credits]')).toBe('300');
    expect(sent.get('payment_intent_data[metadata][orderId]')).toBe(result.orderId);
    expect(sent.get('success_url')).toBe(`https://example.test/zh-TW/pricing?checkout=completed&orderId=${result.orderId}`);
    expect(sent.get('cancel_url')).toBe(`https://example.test/zh-TW/pricing?checkout=cancelled&orderId=${result.orderId}`);
    expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toEqual({ credits: 100 });
  });

  it.each([
    ['test', 'c'], ['live', 'c'], ['test', 'f'], ['live', 'f'],
    ['test', 'g'], ['live', 'g'], ['test', 'opaque'], ['live', 'opaque'],
  ] as const)('accepts Stripe-hosted checkout in %s mode with the %s route without changing the session or fragment', async (mode, route) => {
    const { db, sqlite } = database();
    const id = `cs_${mode}_checkout123`;
    // Stripe owns the URL shape; its API contract does not derive it from id.
    const path = route === 'opaque' ? '/checkout/opaqueFixture123' : `/${route}/pay/${id}`;
    const url = `https://checkout.stripe.com${path}?locale=en#fid=fixture%2Fvalue`;
    checkoutApi({ livemode: mode === 'live' }, { id, url, livemode: mode === 'live' });
    const result = await createCheckout({ ...env(db), STRIPE_MODE: mode, STRIPE_SECRET_KEY: `sk_${mode}_fixtureOnly123` }, user, 'starter');
    expect(result.checkoutUrl).toBe(url);
    expect(sqlite.prepare('SELECT checkout_id,provider_mode,status FROM orders').get()).toEqual({ checkout_id: id, provider_mode: mode, status: 'pending' });
    expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toEqual({ credits: 100 });
  });

  it.each([{ unit_amount: 991 }, { currency: 'eur' }, { livemode: true }, { type: 'recurring', recurring: { interval: 'month' } }, { active: false }])('rejects a mismatched fixed price before inserting an order: %j', async mismatch => {
    const { db, sqlite } = database(); checkoutApi(mismatch);
    await expect(createCheckout(env(db), user, 'starter')).rejects.toMatchObject({ status: 503 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 0 });
  });

  it.each(['https://checkout.stripe.com.evil.test/c/pay/cs_test_checkout123', 'http://checkout.stripe.com/c/pay/cs_test_checkout123', 'https://user@checkout.stripe.com/c/pay/cs_test_checkout123', 'https://checkout.stripe.com:8443/c/pay/cs_test_checkout123'])('rejects untrusted checkout redirects: %s', async url => {
    const { db, sqlite } = database(); checkoutApi({}, { url });
    await expect(createCheckout(env(db), user, 'starter')).rejects.toMatchObject({ status: 502 });
    expect(sqlite.prepare('SELECT checkout_id FROM orders').get()).toEqual({ checkout_id: null });
  });

  it.each([
    'https://checkout.stripe.com.evil.test/f/pay/cs_test_checkout123',
    'http://checkout.stripe.com/f/pay/cs_test_checkout123',
    'https://user@checkout.stripe.com/f/pay/cs_test_checkout123',
    'https://checkout.stripe.com:8443/f/pay/cs_test_checkout123',
  ])('rejects unsafe f/pay redirects: %s', async url => {
    const { db, sqlite } = database(); checkoutApi({}, { url });
    await expect(createCheckout(env(db), user, 'starter')).rejects.toMatchObject({ status: 502 });
    expect(sqlite.prepare('SELECT checkout_id FROM orders').get()).toEqual({ checkout_id: null });
  });

  it.each([{ id: 'cs_live_wrongmode' }, { id: 'invalid' }, { amount_total: 1 }, { metadata: {} }])('still rejects an invalid session even when Stripe supplies a trusted URL: %j', async mismatch => {
    const { db, sqlite } = database();
    checkoutApi({}, { ...mismatch, url: 'https://checkout.stripe.com/checkout/opaqueFixture123' });
    await expect(createCheckout(env(db), user, 'starter')).rejects.toMatchObject({ status: 502 });
    expect(sqlite.prepare('SELECT checkout_id FROM orders').get()).toEqual({ checkout_id: null });
    expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toEqual({ credits: 100 });
  });

  it('does not fall back to another provider when Stripe configuration is absent', async () => {
    const { db, sqlite } = database();
    await expect(createCheckout({ ...env(db), STRIPE_PRICE_STARTER: undefined }, user, 'starter')).rejects.toMatchObject({ status: 503 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 0 });
  });
});

import Stripe from 'stripe';
import { createHmac } from 'node:crypto';
import { verifyStripeWebhook as verifyWebhook } from '../lib/server/stripe';
import { applyStripeEvent as applyEvent } from '../lib/server/stripe-payments';
import { reserveGeneration } from '../lib/server/billing';
// These calls exercise the public boundaries; only Stripe's external HTTP is replaced.
const metadata = { app: 'migosai', orderId: 'local-order', userId: 'u', packId: 'starter', priceId, amount: '990', currency: 'USD', credits: '300', mode: 'test' };
function paidSession(overrides: Record<string, any> = {}) {
  return { id: sessionId, object: 'checkout.session', livemode: false, mode: 'payment', status: 'complete', payment_status: 'paid', client_reference_id: 'local-order', metadata: { ...metadata }, amount_total: 990, amount_subtotal: 990, currency: 'usd', payment_intent: 'pi_fixture123', ...overrides };
}
function confirmedSession(overrides: Record<string, any> = {}) {
  return { ...paidSession(), payment_intent: { id: 'pi_fixture123', object: 'payment_intent', livemode: false, status: 'succeeded', amount: 990, amount_received: 990, currency: 'usd', metadata: { ...metadata } },
    line_items: { object: 'list', has_more: false, data: [{ id: 'li_fixture123', object: 'item', quantity: 1, amount_total: 990, amount_subtotal: 990, currency: 'usd', price: price() }] }, ...overrides };
}
function event(session = paidSession(), overrides: Record<string, any> = {}): Stripe.Event {
  return { id: 'evt_fixture123', object: 'event', type: 'checkout.session.completed', livemode: false, created: Math.floor(Date.now() / 1000), data: { object: session }, ...overrides } as unknown as Stripe.Event;
}
function signature(raw: string, time = Math.floor(Date.now() / 1000), secret = 'whsec_fixtureOnly123') {
  return `t=${time},v1=${createHmac('sha256', secret).update(`${time}.${raw}`).digest('hex')}`;
}
function pending(sqlite: ReturnType<typeof database>['sqlite']) {
  sqlite.prepare(`INSERT INTO orders(id,user_id,pack_id,product_id,amount,currency,credits,checkout_id,provider,provider_mode) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run('local-order', 'u', 'starter', priceId, 990, 'USD', 300, sessionId, 'stripe', 'test');
}
function confirmApi(confirmed = confirmedSession()) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== 'https://api.stripe.com' || init?.redirect !== 'manual') throw Error('Unsafe Stripe retrieval');
    if (url.pathname === '/v1/payment_intents/pi_fixture123') return Response.json(confirmed.payment_intent);
    if (url.pathname !== `/v1/checkout/sessions/${sessionId}`) throw Error('Unexpected Stripe retrieval');
    expect(url.searchParams.get('expand[0]')).toBe('line_items.data.price');
    expect(url.searchParams.get('expand[1]')).toBe('payment_intent');
    return Response.json(confirmed);
  });
}
function balance(sqlite: ReturnType<typeof database>['sqlite']) { return sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u'); }
function assertUnpaid(sqlite: ReturnType<typeof database>['sqlite']) {
  expect(balance(sqlite)).toEqual({ credits: 100 });
  expect(sqlite.prepare('SELECT count(*) AS n FROM credit_ledger').get()).toEqual({ n: 0 });
  expect(sqlite.prepare('SELECT status FROM orders').get()).toEqual({ status: 'pending' });
}

describe('Stripe raw webhook signatures', () => {
  it('verifies the exact raw bytes using a valid rotating signature', async () => {
    const { db } = database(); const raw = JSON.stringify(event());
    expect(await verifyWebhook(new TextEncoder().encode(raw), `${signature(raw)},v1=${'0'.repeat(64)}`, env(db))).toMatchObject({ id: 'evt_fixture123' });
  });
  it.each(['wrong-secret', 'changed-body', 'missing-header', 'old-timestamp', 'future-timestamp'])('rejects %s', async mode => {
    const { db } = database(); const raw = JSON.stringify(event());
    const timestamp = Math.floor(Date.now() / 1000) + (mode === 'old-timestamp' ? -301 : mode === 'future-timestamp' ? 301 : 0);
    const header = mode === 'missing-header' ? null : signature(raw, timestamp, mode === 'wrong-secret' ? 'whsec_other' : undefined);
    await expect(verifyWebhook(mode === 'changed-body' ? raw + ' ' : raw, header, env(db))).rejects.toMatchObject({ status: 401 });
  });
  it.each([{ livemode: true }, { account: 'acct_other123' }])('rejects a valid signature from the wrong mode or connected account: %j', async fields => {
    const { db } = database(); const raw = JSON.stringify(event(paidSession(), fields));
    await expect(verifyWebhook(raw, signature(raw), env(db))).rejects.toMatchObject({ status: 400 });
  });
});

describe('Stripe payment accounting', () => {
  it.each([
    ['creator', 2990, 1200, 1200, 0],
    ['pro', 4990, 2200, 2200, 0],
    ['business', 9990, 5000, 5000, 0],
    ['creator', 2990, 1440, 1200, 240],
    ['business', 9990, 6000, 5000, 1000],
  ] as const)('fulfills the saved historical %s order with %i cents and %i credits without requoting', async (packId, amount, credits, baseCredits, bonusCredits) => {
    const { db, sqlite } = database();
    const historicalPriceId = `price_historical${packId}`;
    const snapshot = { ...metadata, packId, priceId: historicalPriceId, amount: String(amount), credits: String(credits),
      baseCredits: String(baseCredits), bonusCredits: String(bonusCredits), ...(bonusCredits ? { campaignId: 'black-friday-2026' } : {}) };
    sqlite.prepare("INSERT INTO orders(id,user_id,pack_id,product_id,amount,currency,credits,checkout_id,provider,provider_mode) VALUES('local-order','u',?,?,?,'USD',?,?,'stripe','test')")
      .run(packId, historicalPriceId, amount, credits, sessionId);
    const paid = paidSession({ amount_total: amount, amount_subtotal: amount, metadata: snapshot });
    confirmApi(confirmedSession({ ...paid,
      payment_intent: { ...confirmedSession().payment_intent, amount, amount_received: amount, metadata: snapshot },
      line_items: { object: 'list', has_more: false, data: [{ id: 'li_fixture123', object: 'item', quantity: 1,
        amount_total: amount, amount_subtotal: amount, currency: 'usd', price: price({ id: historicalPriceId, unit_amount: amount, active: false }) }] },
    }));
    await applyEvent(env(db), event(paid));
    expect(balance(sqlite)).toEqual({ credits: 100 + credits });
    await reserveGeneration(db, 'u', 'spend-historical', 'video', {}, 100 + credits);
    await applyEvent(env(db), event(paid, { id: 'evt_historicalReplay' }));
    expect(balance(sqlite)).toEqual({ credits: 0 });
    expect(sqlite.prepare("SELECT amount FROM credit_ledger WHERE kind='payment'").all()).toEqual([{ amount: credits }]);
    expect(sqlite.prepare('SELECT amount,credits,status FROM orders').get()).toEqual({ amount, credits, status: 'paid' });
  });

  it('credits once after confirmed payment, even with duplicate and reordered events after consumption', async () => {
    const { db, sqlite } = database(); pending(sqlite); confirmApi();
    await applyEvent(env(db), event());
    expect(balance(sqlite)).toEqual({ credits: 400 });
    await reserveGeneration(db, 'u', 'spend-all', 'video', {}, 400);
    await applyEvent(env(db), event());
    await applyEvent(env(db), event(paidSession(), { id: 'evt_async123', type: 'checkout.session.async_payment_succeeded' }));
    await applyEvent(env(db), event(paidSession({ payment_status: 'unpaid' }), { id: 'evt_old123' }));
    expect(balance(sqlite)).toEqual({ credits: 0 });
    expect(sqlite.prepare("SELECT count(*) AS n FROM credit_ledger WHERE kind='payment'").get()).toEqual({ n: 1 });
    expect(sqlite.prepare('SELECT status,provider_order_id FROM orders').get()).toEqual({ status: 'paid', provider_order_id: 'pi_fixture123' });
  });
  it('uses the recorded price and credit snapshot when checkout configuration has changed', async () => {
    const { db, sqlite } = database(); pending(sqlite); confirmApi();
    await applyEvent({ ...env(db), STRIPE_PRICE_STARTER: 'price_replaced999', PAYMENT_PROVIDER: 'waffo' }, event());
    expect(balance(sqlite)).toEqual({ credits: 400 });
  });
  it.each(['unpaid', 'no_payment_required'])('never grants credits for payment_status=%s', async payment_status => {
    const { db, sqlite } = database(); pending(sqlite);
    await applyEvent(env(db), event(paidSession({ payment_status })));
    assertUnpaid(sqlite);
  });
  it('does not settle on unrelated, expired or failed events', async () => {
    const { db, sqlite } = database(); pending(sqlite);
    for (const type of ['payment_intent.succeeded', 'checkout.session.expired', 'checkout.session.async_payment_failed']) {
      await applyEvent(env(db), event(paidSession(), { type }));
    }
    assertUnpaid(sqlite);
  });
  it.each([
    { metadata: { ...metadata, orderId: 'another-order' } },
    { metadata: { ...metadata, userId: 'other-user' } },
    { metadata: { ...metadata, packId: 'business' } },
    { metadata: { ...metadata, credits: '5000' } },
    { metadata: { ...metadata, priceId: 'price_other' } },
    { client_reference_id: 'another-order' }, { amount_total: 99 }, { currency: 'eur' },
    { livemode: true }, { id: 'cs_test_other123' }, { mode: 'subscription' }, { status: 'open' },
  ])('rejects mismatched event fields without crediting: %j', async fields => {
    const { db, sqlite } = database(); pending(sqlite); confirmApi();
    await expect(applyEvent(env(db), event(paidSession(fields)))).rejects.toMatchObject({ status: 400 });
    assertUnpaid(sqlite);
  });
  it.each([
    { metadata: { ...metadata, userId: 'other-user' } }, { amount_total: 99 }, { currency: 'eur' }, { livemode: true },
    { payment_status: 'unpaid' }, { payment_intent: 'pi_fixture123' },
    { payment_intent: { ...confirmedSession().payment_intent, id: 'pi_other123' } },
    { payment_intent: { ...confirmedSession().payment_intent, amount_received: 900 } },
    { payment_intent: { ...confirmedSession().payment_intent, status: 'processing' } },
    { line_items: { ...confirmedSession().line_items, has_more: true } },
    { line_items: { object: 'list', has_more: false, data: [{ ...confirmedSession().line_items.data[0], quantity: 2 }] } },
    { line_items: { object: 'list', has_more: false, data: [{ ...confirmedSession().line_items.data[0], price: price({ id: 'price_other' }) }] } },
  ])('rejects inconsistent server retrieval despite a valid payment event: %j', async fields => {
    const { db, sqlite } = database(); pending(sqlite); confirmApi(confirmedSession(fields));
    await expect(applyEvent(env(db), event())).rejects.toMatchObject({ status: 400 });
    assertUnpaid(sqlite);
  });
  it.each([['provider', 'waffo'], ['provider_mode', 'live'], ['credits', 5000], ['amount', 9], ['product_id', 'price_other']])('rejects mismatched persisted %s', async (field, value) => {
    const { db, sqlite } = database(); pending(sqlite); confirmApi();
    sqlite.prepare(`UPDATE orders SET ${field}=?`).run(value);
    await expect(applyEvent(env(db), event())).rejects.toMatchObject({ status: 400 });
    assertUnpaid(sqlite);
  });
  it('does not credit when server confirmation fails and permits a later valid retry', async () => {
    const { db, sqlite } = database(); pending(sqlite);
    const offline = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('network offline'));
    await expect(applyEvent(env(db), event())).rejects.toMatchObject({ status: 502 });
    assertUnpaid(sqlite); offline.mockRestore(); confirmApi();
    await applyEvent(env(db), event()); expect(balance(sqlite)).toEqual({ credits: 400 });
  });
  it('does not credit if the database order changes between confirmation and the atomic batch', async () => {
    const { db, sqlite } = database(); pending(sqlite);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      sqlite.prepare('UPDATE orders SET credits=5000').run();
      return Response.json(confirmedSession());
    });
    await expect(applyEvent(env(db), event())).rejects.toMatchObject({ status: 409 });
    assertUnpaid(sqlite);
  });
  it('records refunds and disputes for manual review without changing the spent balance, including events before fulfillment', async () => {
    const { db, sqlite } = database(); pending(sqlite); confirmApi();
    const refund = event({ id: 're_fixture123', object: 'refund', payment_intent: 'pi_fixture123', amount: 990, currency: 'usd' } as any, { id: 'evt_refund123', type: 'refund.created' });
    await applyEvent(env(db), refund);
    assertUnpaid(sqlite);
    await applyEvent(env(db), event());
    await reserveGeneration(db, 'u', 'spend-all', 'video', {}, 400);
    await applyEvent(env(db), refund);
    await applyEvent(env(db), event({ id: 'dp_fixture123', object: 'dispute', payment_intent: 'pi_fixture123' } as any, { id: 'evt_dispute123', type: 'charge.dispute.created' }));
    expect(balance(sqlite)).toEqual({ credits: 0 });
    expect(sqlite.prepare('SELECT order_id,review_required FROM webhook_events WHERE review_required=1').all()).toEqual([{ order_id: 'local-order', review_required: 1 }, { order_id: 'local-order', review_required: 1 }]);
  });
});

describe('Stripe checkout readiness and failures', () => {
  it.each(['', undefined, 'invalid'])('refuses to collect payment without a configured webhook signing secret: %j', async secret => {
    const { db, sqlite } = database(); const api = checkoutApi();
    await expect(createCheckout({ ...env(db), STRIPE_WEBHOOK_SECRET: secret }, user, 'starter')).rejects.toMatchObject({ status: 503 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 0 });
    expect(api.fetcher).not.toHaveBeenCalled();
  });
  it('rejects altered creation metadata before offering a session to the buyer', async () => {
    const { db, sqlite } = database(); checkoutApi({}, { metadata: { ...metadata, userId: 'another-user' } });
    await expect(createCheckout(env(db), user, 'starter')).rejects.toMatchObject({ status: 502 });
    expect(sqlite.prepare('SELECT checkout_id FROM orders').get()).toEqual({ checkout_id: null });
  });
  it('retains an uncredited pending order if the session response is lost', async () => {
    const { db, sqlite } = database();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      if (String(input).includes('/v1/prices/')) return Response.json(price());
      throw Error('connection lost');
    });
    await expect(createCheckout(env(db), user, 'starter')).rejects.toMatchObject({ status: 502 });
    assertUnpaid(sqlite);
    expect(sqlite.prepare('SELECT checkout_id FROM orders').get()).toEqual({ checkout_id: null });
  });
  it.each(['payment-provider-typo', 'Stripe'])('refuses unsupported provider values instead of falling back: %s', async provider => {
    const { db, sqlite } = database();
    await expect(createCheckout({ ...env(db), PAYMENT_PROVIDER: provider }, user, 'starter')).rejects.toMatchObject({ status: 503 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 0 });
  });
  it.each([
    ['test', 'http://localhost:3000'],
    ['test', 'http://127.0.0.1:3000'],
    ['test', 'https://example.test'],
    ['live', 'https://example.test'],
  ] as const)('creates %s checkout with return origin %s', async (mode, origin) => {
    const { db, sqlite } = database();
    const id = `cs_${mode}_checkout123`;
    const api = checkoutApi({ livemode: mode === 'live' }, { id, livemode: mode === 'live' });
    const result = await createCheckout({ ...env(db), STRIPE_MODE: mode, STRIPE_SECRET_KEY: `sk_${mode}_fixtureOnly123`, APP_URL: origin }, user, 'starter');
    expect(result).toEqual({ checkoutUrl, orderId: expect.any(String) });
    expect(api.sent().get('success_url')).toBe(`${origin}/pricing?checkout=completed&orderId=${result.orderId}`);
    expect(api.sent().get('cancel_url')).toBe(`${origin}/pricing?checkout=cancelled&orderId=${result.orderId}`);
    expect(sqlite.prepare('SELECT checkout_id,provider_mode,status FROM orders').get()).toEqual({ checkout_id: id, provider_mode: mode, status: 'pending' });
    expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toEqual({ credits: 100 });
  });
  it.each([
    ['live', 'http://localhost:3000'],
    ['live', 'http://127.0.0.1:3000'],
    ['test', 'http://example.test'],
    ['live', 'http://example.test'],
    ['test', 'http://localhost.example.test:3000'],
    ['test', 'http://127.0.0.2:3000'],
  ] as const)('rejects %s checkout with HTTP return origin %s before contacting Stripe', async (mode, origin) => {
    const { db, sqlite } = database(); const api = checkoutApi();
    await expect(createCheckout({ ...env(db), STRIPE_MODE: mode, STRIPE_SECRET_KEY: `sk_${mode}_fixtureOnly123`, APP_URL: origin }, user, 'starter')).rejects.toMatchObject({ status: 503 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 0 });
    expect(api.fetcher).not.toHaveBeenCalled();
  });
  it.each([{ STRIPE_SECRET_KEY: 'sk_live_fixtureOnly123' }, { STRIPE_MODE: 'prod' }])('rejects credential/mode disagreement: %j', async overrides => {
    const { db, sqlite } = database(); const api = checkoutApi();
    await expect(createCheckout({ ...env(db), ...overrides }, user, 'starter')).rejects.toMatchObject({ status: 503 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 0 });
    expect(api.fetcher).not.toHaveBeenCalled();
  });
});

function refundEvent(overrides: Record<string, unknown> = {}, type = 'refund.created') {
  return event({ id: 're_shared123', object: 'refund', payment_intent: 'pi_fixture123', amount: 990, currency: 'usd', ...overrides } as any, { id: 'evt_shared123', type });
}
function intentApi(overrides: Record<string, unknown> = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.href !== 'https://api.stripe.com/v1/payment_intents/pi_fixture123' || init?.redirect !== 'manual') throw Error('Unexpected PaymentIntent lookup');
    return Response.json({ ...confirmedSession().payment_intent, ...overrides });
  });
}
function assertNoEvents(sqlite: ReturnType<typeof database>['sqlite']) {
  expect(sqlite.prepare('SELECT count(*) AS n FROM webhook_events').get()).toEqual({ n: 0 });
}

describe('Stripe shared-account ownership', () => {
  it.each([{}, { app: 'another-app' }])('acknowledges an unrelated paid Checkout without metadata ownership: %j', async foreignMetadata => {
    const { db, sqlite } = database(); pending(sqlite);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('must not contact Stripe'));
    for (const clientReference of [null, 'foreign-order', 'local-order']) {
      await expect(applyEvent(env(db), event(paidSession({ id: 'cs_test_foreign123', metadata: foreignMetadata, client_reference_id: clientReference })))).resolves.toBeUndefined();
    }
    assertUnpaid(sqlite); assertNoEvents(sqlite); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([undefined, 'another-app'])('rejects an app marker changed on a locally bound Checkout: %j', async app => {
    const { db, sqlite } = database(); pending(sqlite); confirmApi();
    await expect(applyEvent(env(db), event(paidSession({ metadata: { ...metadata, app } })))).rejects.toMatchObject({ status: 400 });
    assertUnpaid(sqlite); assertNoEvents(sqlite);
  });
  it('rejects an app marker changed on the retrieved PaymentIntent', async () => {
    const { db, sqlite } = database(); pending(sqlite);
    confirmApi(confirmedSession({ payment_intent: { ...confirmedSession().payment_intent, metadata: { ...metadata, app: 'another-app' } } }));
    await expect(applyEvent(env(db), event())).rejects.toMatchObject({ status: 400 });
    assertUnpaid(sqlite); assertNoEvents(sqlite);
  });
  it.each([{}, { app: 'another-app' }])('does not create refund/dispute review noise for another app: %j', async foreignMetadata => {
    const { db, sqlite } = database(); pending(sqlite); intentApi({ metadata: foreignMetadata });
    for (const type of ['refund.created', 'charge.refunded', 'charge.dispute.created']) {
      await applyEvent(env(db), refundEvent({ metadata: { ...metadata } }, type));
    }
    assertUnpaid(sqlite); assertNoEvents(sqlite);
  });
  it('ignores unrelated review events that have no PaymentIntent', async () => {
    const { db, sqlite } = database(); pending(sqlite);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('must not contact Stripe'));
    await applyEvent(env(db), refundEvent({ payment_intent: null }));
    assertUnpaid(sqlite); assertNoEvents(sqlite); expect(fetcher).not.toHaveBeenCalled();
  });
  it('ignores a tagged PaymentIntent without a corresponding local order', async () => {
    const { db, sqlite } = database(); pending(sqlite); intentApi({ metadata: { ...metadata, orderId: 'other-installation-order' } });
    await applyEvent(env(db), refundEvent());
    assertUnpaid(sqlite); assertNoEvents(sqlite);
  });
  it('links a refund before fulfillment only after retrieving the owned PaymentIntent snapshot', async () => {
    const { db, sqlite } = database(); pending(sqlite); const fetcher = intentApi();
    await applyEvent(env(db), refundEvent({ metadata: { app: 'untrusted-object-tag' } }));
    await applyEvent(env(db), refundEvent());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sqlite.prepare('SELECT order_id,review_required FROM webhook_events').all()).toEqual([{ order_id: 'local-order', review_required: 1 }]);
    assertUnpaid(sqlite);
  });
  it.each([
    { metadata: { ...metadata, userId: 'other-user' } }, { metadata: { ...metadata, credits: '5000' } },
    { metadata: { ...metadata, priceId: 'price_other' } }, { metadata: { ...metadata, mode: 'live' } },
    { amount: 9 }, { currency: 'eur' }, { livemode: true }, { id: 'pi_other123' },
  ])('does not attach a review to a pending order with a conflicting PaymentIntent: %j', async fields => {
    const { db, sqlite } = database(); pending(sqlite); intentApi(fields);
    await expect(applyEvent(env(db), refundEvent())).rejects.toMatchObject({ status: 400 });
    assertUnpaid(sqlite); assertNoEvents(sqlite);
  });
  it('preserves retries when resolving review ownership is temporarily unavailable', async () => {
    const { db, sqlite } = database(); pending(sqlite);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('offline'));
    await expect(applyEvent(env(db), refundEvent())).rejects.toMatchObject({ status: 502 });
    assertUnpaid(sqlite); assertNoEvents(sqlite);
  });
  it('records a locally bound payment refund even when unrelated object metadata has changed', async () => {
    const { db, sqlite } = database(); pending(sqlite); const fetcher = confirmApi();
    await applyEvent(env(db), event()); fetcher.mockClear();
    await applyEvent(env(db), refundEvent({ metadata: { app: 'another-app' } }));
    expect(sqlite.prepare('SELECT order_id,review_required FROM webhook_events WHERE review_required=1').all()).toEqual([{ order_id: 'local-order', review_required: 1 }]);
    expect(fetcher).not.toHaveBeenCalled(); expect(balance(sqlite)).toEqual({ credits: 400 });
  });
});

describe('Stripe fixed currency selection', () => {
  it('pins Checkout to USD even if a fixed Price has manually configured local currencies', async () => {
    const { db } = database();
    const api = checkoutApi({ currency_options: { usd: { unit_amount: 990 }, eur: { unit_amount: 920 } } });
    await createCheckout(env(db), user, 'starter');
    expect(api.sent().get('currency')).toBe('usd');
  });
  it('disables dashboard-dependent adaptive currency presentation for the advertised USD purchase', async () => {
    const { db } = database(); const api = checkoutApi();
    await createCheckout(env(db), user, 'starter');
    expect(api.sent().get('adaptive_pricing[enabled]')).toBe('false');
  });
});

describe('Stripe ownership edge cases', () => {
  it.each([null, 'foreign-order'])('rejects a locally bound Checkout with both ownership marker and client reference tampered: %j', async clientReference => {
    const { db, sqlite } = database(); pending(sqlite);
    await expect(applyEvent(env(db), event(paidSession({ metadata: { app: 'another-app' }, client_reference_id: clientReference })))).rejects.toMatchObject({ status: 400 });
    assertUnpaid(sqlite); assertNoEvents(sqlite);
  });
  it('records review if fulfillment binds the same PaymentIntent while its ownership is being retrieved', async () => {
    const { db, sqlite } = database(); pending(sqlite);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      if (String(input) !== 'https://api.stripe.com/v1/payment_intents/pi_fixture123') throw Error('Unexpected request');
      sqlite.prepare("UPDATE orders SET status='paid',provider_order_id='pi_fixture123' WHERE id='local-order'").run();
      sqlite.prepare("INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id) VALUES('local-order:payment','u',300,'payment','local-order')").run();
      return Response.json(confirmedSession().payment_intent);
    });
    await applyEvent(env(db), refundEvent());
    expect(sqlite.prepare('SELECT order_id,review_required FROM webhook_events').all()).toEqual([{ order_id: 'local-order', review_required: 1 }]);
    expect(balance(sqlite)).toEqual({ credits: 400 });
  });
});
