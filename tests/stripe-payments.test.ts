import { afterEach, describe, expect, it, vi } from 'vitest';
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
afterEach(() => vi.restoreAllMocks());

describe('Stripe Checkout creation', () => {
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

  it.each([{ unit_amount: 991 }, { currency: 'eur' }, { livemode: true }, { type: 'recurring', recurring: { interval: 'month' } }, { active: false }])('rejects a mismatched fixed price before inserting an order: %j', async mismatch => {
    const { db, sqlite } = database(); checkoutApi(mismatch);
    await expect(createCheckout(env(db), user, 'starter')).rejects.toMatchObject({ status: 503 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 0 });
  });

  it.each(['https://checkout.stripe.com.evil.test/c/pay/cs_test_checkout123', 'http://checkout.stripe.com/c/pay/cs_test_checkout123', 'https://user@checkout.stripe.com/c/pay/cs_test_checkout123', 'https://checkout.stripe.com:8443/c/pay/cs_test_checkout123', 'https://checkout.stripe.com/c/pay/cs_test_other'])('rejects untrusted checkout redirects: %s', async url => {
    const { db, sqlite } = database(); checkoutApi({}, { url });
    await expect(createCheckout(env(db), user, 'starter')).rejects.toMatchObject({ status: 502 });
    expect(sqlite.prepare('SELECT checkout_id FROM orders').get()).toEqual({ checkout_id: null });
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
  it('rejects HTTP return origins before contacting Stripe', async () => {
    const { db, sqlite } = database(); const api = checkoutApi();
    await expect(createCheckout({ ...env(db), APP_URL: 'http://localhost:3000' }, user, 'starter')).rejects.toMatchObject({ status: 503 });
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
