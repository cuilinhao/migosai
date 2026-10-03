import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { applyCheckout, createCheckout, recordReviewEvent } from '../lib/server/payments';
import type { WaffoEvent } from '../lib/server/waffo';

const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const productId = 'PROD_1234567890123456789012';
const storeId = 'STO_1234567890123456789012';
function env(db: D1Database) { return { ...jobEnv(db), WAFFO_MERCHANT_ID: 'MER_1234567890123456789012', WAFFO_PRIVATE_KEY: pem, WAFFO_MODE: 'test', WAFFO_STORE_ID: storeId, WAFFO_PRODUCT_STARTER: productId }; }
function event(): WaffoEvent { return {
  id: 'PAY_1234567890123456789012', eventId: 'PAY_1234567890123456789012', eventType: 'order.completed',
  timestamp: new Date().toISOString(), storeId, storeName: 'Store', mode: 'test', data: {
    orderId: 'ORD_1234567890123456789012', orderStatus: 'completed', buyerEmail: 'a@b.c', currency: 'USD',
    orderMerchantExternalId: 'local-order', orderMetadata: { orderId: 'local-order', userId: 'u', packId: 'starter', productId },
    chargedAmount: '9.90', listPrice: { total: '9.90', subtotal: '9.90', taxAmount: '0.00' },
    amount: '9.90', taxAmount: '0.00', productName: 'Starter',
    paymentId: 'PAY_1234567890123456789012', paymentStatus: 'succeeded',
  },
}; }
function pending(sqlite: ReturnType<typeof database>['sqlite']) {
  sqlite.prepare(`INSERT INTO orders (id,user_id,pack_id,product_id,amount,currency,credits,checkout_id,provider,provider_mode,store_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run('local-order', 'u', 'starter', productId, 990, 'USD', 300, 'cs_550e8400-e29b-41d4-a716-446655440000', 'waffo', 'test', storeId);
}
function graphql(paymentCents = '990') { return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
  const body = JSON.parse(String(init?.body));
  if (!String(_url).endsWith('/v1/graphql') || !body.query.includes('onetimeOrder(')) throw Error('Unexpected request');
  return Response.json({ data: { onetimeOrder: {
    id: 'ORD_1234567890123456789012', storeId, testMode: true,
    status: 'completed', buyerEmail: 'a@b.c', currency: 'USD',
    orderMerchantExternalId: 'local-order', priceSnapshot: { total: '9.90', currency: 'USD' },
    onetimeProduct: { id: productId }, payments: [{ id: 'PAY_1234567890123456789012', status: 'succeeded', amount: { amount: paymentCents, currency: 'USD' } }],
  } } });
}); }

describe('Waffo payment accounting', () => {
  it('requires an HTTPS success return address before creating an order', async () => {
    const { db, sqlite } = database();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected request'));
    try {
      await expect(createCheckout({ ...env(db), APP_URL: 'http://127.0.0.1:3000' },
        { id: 'u', email: 'a@b.c', name: 'Test' }, 'starter')).rejects.toMatchObject({ status: 503 });
      expect(sqlite.prepare('SELECT count(*) AS n FROM orders').get()).toMatchObject({ n: 0 });
      expect(fetcher).not.toHaveBeenCalled();
    } finally { fetcher.mockRestore(); }
  });

  it('rejects redirect responses even when they contain a checkout data envelope', async () => {
    const { db, sqlite } = database();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: {
      sessionId: 'cs_550e8400-e29b-41d4-a716-446655440000',
      checkoutUrl: 'https://checkout.waffo.ai/store/checkout/cs_550e8400-e29b-41d4-a716-446655440000',
    } }, { status: 303 }));
    try {
      await expect(createCheckout(env(db), { id: 'u', email: 'a@b.c', name: 'Test' }, 'starter')).rejects.toThrow();
      expect(sqlite.prepare('SELECT checkout_id FROM orders').get()).toMatchObject({ checkout_id: null });
    } finally { fetcher.mockRestore(); }
  });

  it('records hosted session and provider binding', async () => {
    const { db, sqlite } = database(); let sent: any;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      expect(String(url)).toBe('https://api.waffo.ai/v1/actions/checkout/create-session');
      expect(init?.redirect).toBe('manual'); sent = JSON.parse(String(init?.body));
      return Response.json({ data: { sessionId: 'cs_550e8400-e29b-41d4-a716-446655440000', checkoutUrl: 'https://checkout.waffo.ai/store/checkout/cs_550e8400-e29b-41d4-a716-446655440000', expiresAt: new Date(Date.now() + 60_000).toISOString() } });
    });
    try {
      const result = await createCheckout(env(db), { id: 'u', email: 'a@b.c', name: 'Test' }, 'starter');
      expect(sent).toMatchObject({ productId, currency: 'USD', orderMerchantExternalId: result.orderId, metadata: { orderId: result.orderId, userId: 'u', packId: 'starter', productId } });
      expect(new URL(sent.successUrl).searchParams.get('orderId')).toBe(result.orderId);
      expect(sqlite.prepare('SELECT checkout_id,provider,provider_mode,store_id FROM orders WHERE id=?').get(result.orderId))
        .toMatchObject({ checkout_id: 'cs_550e8400-e29b-41d4-a716-446655440000', provider: 'waffo', provider_mode: 'test', store_id: storeId });
    } finally { fetcher.mockRestore(); }
  });

  it.each(['ko', 'ja', 'fr', 'es', 'zh-TW', '//evil.example'])('returns checkout to the validated language %s', async (locale) => {
    const { db } = database(); let successUrl = '';
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      successUrl = JSON.parse(String(init?.body)).successUrl;
      return Response.json({ data: { sessionId: 'cs_550e8400-e29b-41d4-a716-446655440000', checkoutUrl: 'https://checkout.waffo.ai/store/checkout/cs_550e8400-e29b-41d4-a716-446655440000', expiresAt: new Date(Date.now() + 60_000).toISOString() } });
    });
    try {
      await createCheckout(env(db), { id: 'u', email: 'a@b.c', name: 'Test' }, 'starter', locale);
      const url = new URL(successUrl);
      expect(url.origin).toBe(new URL(env(db).APP_URL!).origin);
      expect(url.pathname).toBe(locale.startsWith('//') ? '/pricing' : `/${locale}/pricing`);
      expect(url.searchParams.get('checkout')).toBe('completed');
    } finally { fetcher.mockRestore(); }
  });

  it('credits a confirmed order once across duplicate deliveries', async () => {
    const { db, sqlite } = database(); pending(sqlite); const fetcher = graphql();
    try {
      await applyCheckout(env(db), event()); await applyCheckout(env(db), event());
      await applyCheckout(env(db), { ...event(), id: 'PAY_alternate' });
      expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toMatchObject({ credits: 400 });
      expect(sqlite.prepare("SELECT count(*) AS n FROM credit_ledger WHERE kind='payment'").get()).toMatchObject({ n: 1 });
    } finally { fetcher.mockRestore(); }
  });

  it('honors the saved checkout product after the current pack configuration changes', async () => {
    const { db, sqlite } = database(); pending(sqlite);
    const fetcher = graphql();
    try {
      await applyCheckout({ ...env(db), WAFFO_PRODUCT_STARTER: 'PROD_9999999999999999999999' }, event());
      expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toMatchObject({ credits: 400 });
    } finally { fetcher.mockRestore(); }
  });

  it('uses the confirmed Payment minor-unit amount when webhook chargedAmount is absent', async () => {
    const { db, sqlite } = database(); pending(sqlite); const incoming = event();
    delete incoming.data.chargedAmount;
    const fetcher = graphql();
    try {
      await applyCheckout(env(db), incoming);
      expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toMatchObject({ credits: 400 });
    } finally { fetcher.mockRestore(); }
  });

  it('rejects a paid Payment whose actual minor-unit amount differs from the pack price', async () => {
    const { db, sqlite } = database(); pending(sqlite); const fetcher = graphql('1');
    try {
      await expect(applyCheckout(env(db), event())).rejects.toThrow();
      expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toMatchObject({ credits: 100 });
    } finally { fetcher.mockRestore(); }
  });

  it.each(['amount', 'metadata', 'mode', 'store', 'legacy', 'unbound'])(
    'rejects %s mismatch without credit', async field => {
      const { db, sqlite } = database(); pending(sqlite); const incoming = event();
      if (field === 'amount') incoming.data.chargedAmount = '0.01';
      if (field === 'metadata') incoming.data.orderMetadata!.userId = 'other';
      if (field === 'mode') incoming.mode = 'prod';
      if (field === 'store') incoming.storeId = 'STO_other';
      if (field === 'legacy') sqlite.exec("UPDATE orders SET provider='creem',provider_mode='legacy' WHERE id='local-order'");
      if (field === 'unbound') sqlite.exec("UPDATE orders SET checkout_id=NULL WHERE id='local-order'");
      const fetcher = graphql();
      try { await expect(applyCheckout(env(db), incoming)).rejects.toThrow(); expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toMatchObject({ credits: 100 }); }
      finally { fetcher.mockRestore(); }
    },
  );

  it('fails closed if GraphQL cannot confirm the paid product', async () => {
    const { db, sqlite } = database(); pending(sqlite);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: { onetimeOrder: null } }));
    try { await expect(applyCheckout(env(db), event())).rejects.toThrow(); expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toMatchObject({ credits: 100 }); }
    finally { fetcher.mockRestore(); }
  });

  it('does not credit when the local binding changes between lookup and D1 batch', async () => {
    const { db, sqlite } = database(); pending(sqlite);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      sqlite.exec("UPDATE orders SET product_id='PROD_changed' WHERE id='local-order'");
      return Response.json({ data: { onetimeOrder: {
        id: 'ORD_1234567890123456789012', storeId, testMode: true,
        status: 'completed', buyerEmail: 'a@b.c', currency: 'USD',
        orderMerchantExternalId: 'local-order', priceSnapshot: { total: '9.90', currency: 'USD' },
        onetimeProduct: { id: productId },
        payments: [{ id: 'PAY_1234567890123456789012', status: 'succeeded', amount: { amount: '990', currency: 'USD' } }],
      } } });
    });
    try {
      await expect(applyCheckout(env(db), event())).rejects.toThrow();
      expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toMatchObject({ credits: 100 });
      expect(sqlite.prepare('SELECT status FROM orders WHERE id=?').get('local-order')).toMatchObject({ status: 'pending' });
    } finally { fetcher.mockRestore(); }
  });

  it('records a successful refund for manual review without changing credits', async () => {
    const { db, sqlite } = database(); pending(sqlite);
    sqlite.exec("UPDATE orders SET status='paid',provider_order_id='ORD_1234567890123456789012' WHERE id='local-order'");
    const refund = event();
    refund.id = 'REF_1234567890123456789012';
    refund.eventId = refund.id;
    refund.eventType = 'refund.succeeded';
    refund.data.refundedAmount = '9.90';
    await recordReviewEvent(db, refund);
    await recordReviewEvent(db, refund);
    expect(sqlite.prepare('SELECT credits FROM users WHERE id=?').get('u')).toMatchObject({ credits: 100 });
    expect(sqlite.prepare('SELECT event_type,review_required,order_id,note FROM webhook_events').get())
      .toMatchObject({ event_type: 'refund.succeeded', review_required: 1, order_id: 'local-order' });
    expect(sqlite.prepare('SELECT count(*) AS n FROM webhook_events').get()).toMatchObject({ n: 1 });
  });

  it('leaves unknown refund order linkage null for manual reconciliation', async () => {
    const { db, sqlite } = database();
    const refund = event(); refund.eventType = 'refund.succeeded';
    refund.data.orderMerchantExternalId = 'unknown-local-order';
    await recordReviewEvent(db, refund);
    expect(sqlite.prepare('SELECT order_id FROM webhook_events').get()).toMatchObject({ order_id: null });
  });
});
