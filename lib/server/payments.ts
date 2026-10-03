import { isLocale, localizeHref } from '../i18n/routing';
import { creditPacks } from '../../content/pricing';
import { appOrigin, database, type Env } from './env';
import { ApiError } from './errors';
import { waffoClient, waffoMode, waffoStoreId, type WaffoEvent } from './waffo';
import type { User } from '../contracts';

type Order = {
  id: string; user_id: string; pack_id: string; product_id: string;
  amount: number; currency: string; credits: number; checkout_id: string | null;
  provider_order_id: string | null; provider: string; provider_mode: string;
  store_id: string | null; status: string;
};
type ConfirmedOrder = {
  id: string; storeId: string; testMode: boolean;
  status: string; buyerEmail: string; currency: string;
  orderMerchantExternalId: string | null;
  priceSnapshot: { total: string; currency: string } | null;
  onetimeProduct: { id: string } | null;
  payments: Array<{ id: string; status: string;
    amount: { amount: string; currency: string } | null }>;
};

function displayToCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

function minorUnitsToCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const cents = Number(value);
  return Number.isSafeInteger(cents) ? cents : null;
}

function productForPack(env: Env, packId: string): string {
  const product = env[`WAFFO_PRODUCT_${packId.toUpperCase()}` as keyof Env];
  if (typeof product !== 'string' || !/^PROD_[A-Za-z0-9]{22}$/.test(product)) {
    throw new ApiError(503, 'Checkout is not configured for this credit pack.');
  }
  return product;
}

function validatedCheckoutUrl(value: unknown, sessionId: unknown): string {
  if (typeof value !== 'string' || typeof sessionId !== 'string' ||
    !/^cs_[0-9a-f-]{36}$/i.test(sessionId)) {
    throw new ApiError(502, 'The payment service returned an incomplete checkout.');
  }
  let url: URL;
  try { url = new URL(value); }
  catch { throw new ApiError(502, 'The payment service returned an invalid checkout address.'); }
  if (url.protocol !== 'https:' ||
    !['checkout.waffo.ai', 'pancake.waffo.ai'].includes(url.hostname) ||
    url.username || url.password || url.port || !url.pathname.endsWith(`/${sessionId}`)) {
    throw new ApiError(502, 'The payment service returned an invalid checkout address.');
  }
  return url.href;
}

export async function createCheckout(env: Env, user: User, packId: unknown, requestedLocale: unknown = "en") {
  const locale = typeof requestedLocale === "string" && isLocale(requestedLocale) ? requestedLocale : "en";
  const pack = creditPacks.find(item => item.id === packId);
  if (!pack) throw new ApiError(400, 'Unknown credit pack.');
  const client = waffoClient(env);
  const mode = waffoMode(env);
  const storeId = waffoStoreId(env);
  const productId = productForPack(env, pack.id);
  const origin = appOrigin(env);
  if (!origin.startsWith('https://')) {
    throw new ApiError(503, 'Payment checkout requires a public HTTPS application URL.');
  }
  const db = database(env);
  const orderId = crypto.randomUUID();
  await db.prepare(`INSERT INTO orders
    (id,user_id,pack_id,product_id,amount,currency,credits,provider,provider_mode,store_id)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(orderId, user.id, pack.id, productId, pack.amountCents, 'USD', pack.credits,
      'waffo', mode, storeId).run();

  let session: Awaited<ReturnType<typeof client.checkout.createSession>>;
  try {
    session = await client.checkout.createSession({
      productId,
      currency: 'USD',
      buyerEmail: user.email,
      successUrl: `${origin}${localizeHref("/pricing", locale)}?checkout=completed&orderId=${encodeURIComponent(orderId)}`,
      metadata: { orderId, userId: user.id, packId: pack.id, productId },
      orderMerchantExternalId: orderId,
    }, { idempotencyKey: orderId });
  } catch {
    throw new ApiError(502, 'Checkout creation could not be confirmed. Please try again later.');
  }
  const url = validatedCheckoutUrl(session?.checkoutUrl, session?.sessionId);
  const updated = await db.prepare(`UPDATE orders SET checkout_id=?
    WHERE id=? AND provider='waffo' AND provider_mode=? AND store_id=?
      AND product_id=? AND status='pending' AND checkout_id IS NULL`)
    .bind(session.sessionId, orderId, mode, storeId, productId).run();
  if (updated.meta.changes !== 1) throw new ApiError(503, 'Checkout could not be recorded.');
  return { checkoutUrl: url, orderId };
}

function requireMatchingOrder(row: Order | null, event: WaffoEvent, env: Env): asserts row is Order {
  const data = event.data;
  const metadata = data?.orderMetadata;
  if (!row || row.provider !== 'waffo' || row.provider_mode !== waffoMode(env) ||
    row.store_id !== waffoStoreId(env) || row.store_id !== event.storeId ||
    !/^PROD_[A-Za-z0-9]{22}$/.test(row.product_id) || !row.pack_id ||
    !Number.isSafeInteger(row.amount) || row.amount <= 0 ||
    !Number.isSafeInteger(row.credits) || row.credits <= 0 ||
    row.currency !== 'USD' || !row.checkout_id ||
    !['pending', 'paid'].includes(row.status) ||
    (row.provider_order_id && row.provider_order_id !== data.orderId) ||
    data.orderStatus !== 'completed' || data.paymentStatus !== 'succeeded' ||
    data.currency !== row.currency ||
    data.orderMerchantExternalId !== row.id ||
    metadata?.orderId !== row.id || metadata?.userId !== row.user_id ||
    metadata?.packId !== row.pack_id || metadata?.productId !== row.product_id ||
    (data.chargedAmount !== undefined && displayToCents(data.chargedAmount) !== row.amount) ||
    displayToCents(data.listPrice?.total) !== row.amount ||
    data.paymentId !== event.eventId ||
    !data.buyerEmail?.trim()) {
    throw new ApiError(400, 'Payment does not match the recorded order.');
  }
}

async function confirmWaffoOrder(env: Env, row: Order, event: WaffoEvent): Promise<void> {
  const client = waffoClient(env);
  let result: { data?: { onetimeOrder: ConfirmedOrder | null } | null; errors?: unknown[] };
  try {
    result = await client.graphql.query<{ onetimeOrder: ConfirmedOrder | null }>({
      query: `query ($id: String!) {
        onetimeOrder(id: $id) {
          id storeId testMode status buyerEmail currency orderMerchantExternalId
          priceSnapshot { total currency }
          onetimeProduct { id }
          payments { id status amount { amount currency } }
        }
      }`,
      variables: { id: event.data.orderId },
    });
  } catch {
    throw new ApiError(502, 'Payment confirmation is temporarily unavailable.');
  }
  const confirmed = result.data?.onetimeOrder;
  if (result.errors?.length || !confirmed || confirmed.id !== event.data.orderId ||
    confirmed.storeId !== row.store_id || confirmed.testMode !== (row.provider_mode === 'test') ||
    confirmed.status !== 'completed' || confirmed.currency !== row.currency ||
    confirmed.buyerEmail?.trim().toLowerCase() !== event.data.buyerEmail?.trim().toLowerCase() ||
    confirmed.orderMerchantExternalId !== row.id ||
    confirmed.onetimeProduct?.id !== row.product_id ||
    confirmed.priceSnapshot?.currency !== row.currency ||
    displayToCents(confirmed.priceSnapshot.total) !== row.amount ||
    !confirmed.payments?.some(payment =>
      payment.id === event.data.paymentId && payment.status === 'succeeded' &&
      payment.amount?.currency === row.currency &&
      minorUnitsToCents(payment.amount.amount) === row.amount)) {
    throw new ApiError(400, 'Payment could not be confirmed against the recorded order.');
  }
}

export async function applyCheckout(env: Env, event: WaffoEvent): Promise<void> {
  if (event?.eventType !== 'order.completed' || event.mode !== waffoMode(env) ||
    event.storeId !== waffoStoreId(env) || typeof event.eventId !== 'string' ||
    typeof event.data?.orderId !== 'string' ||
    typeof event.data?.orderMerchantExternalId !== 'string') {
    throw new ApiError(400, 'Invalid payment event.');
  }
  const db = database(env);
  const row = await db.prepare('SELECT * FROM orders WHERE id=?')
    .bind(event.data.orderMerchantExternalId).first<Order>();
  requireMatchingOrder(row, event, env);
  await confirmWaffoOrder(env, row, event);

  const results = await db.batch([
    db.prepare(`UPDATE orders SET status='paid', provider_order_id=?
      WHERE id=? AND provider='waffo' AND provider_mode=? AND store_id=?
        AND user_id=? AND pack_id=? AND product_id=? AND amount=? AND currency=?
        AND credits=? AND checkout_id=?
        AND ((status='pending' AND provider_order_id IS NULL)
          OR (status='paid' AND provider_order_id=?))`)
      .bind(event.data.orderId, row.id, row.provider_mode, row.store_id,
        row.user_id, row.pack_id, row.product_id, row.amount, row.currency,
        row.credits, row.checkout_id, event.data.orderId),
    db.prepare(`INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id)
      SELECT id||':payment',user_id,credits,'payment',id FROM orders
      WHERE id=? AND provider='waffo' AND provider_mode=? AND store_id=?
        AND user_id=? AND pack_id=? AND product_id=? AND amount=? AND currency=?
        AND credits=? AND checkout_id=? AND provider_order_id=? AND status='paid'
      ON CONFLICT(kind,reference_id) DO NOTHING`)
      .bind(row.id, row.provider_mode, row.store_id, row.user_id, row.pack_id,
        row.product_id, row.amount, row.currency, row.credits, row.checkout_id,
        event.data.orderId),
    db.prepare(`INSERT INTO webhook_events(id,event_type,order_id)
      SELECT ?,?,id FROM orders WHERE id=? AND provider='waffo'
        AND provider_mode=? AND store_id=? AND provider_order_id=? AND status='paid'
      ON CONFLICT(id) DO NOTHING`)
      .bind(`waffo:${event.mode}:${event.eventType}:${event.eventId}`,
        event.eventType, row.id, row.provider_mode, row.store_id, event.data.orderId),
  ]);
  if (results[0].meta.changes !== 1) {
    throw new ApiError(409, 'Payment order changed before it could be credited.');
  }
}

export async function recordReviewEvent(db: D1Database, event: WaffoEvent): Promise<void> {
  if (event.eventType !== 'refund.succeeded' && event.eventType !== 'refund.failed') return;
  const externalId = typeof event.data.orderMerchantExternalId === 'string' &&
    event.data.orderMerchantExternalId ? event.data.orderMerchantExternalId : null;
  const providerOrderId = typeof event.data.orderId === 'string' ? event.data.orderId : null;
  const linked = await db.prepare(`SELECT id FROM orders
    WHERE provider='waffo' AND provider_mode=? AND store_id=?
      AND ((provider_order_id=? AND (? IS NULL OR id=?))
        OR (id=? AND provider_order_id IS NULL))
    LIMIT 1`)
    .bind(event.mode, event.storeId, providerOrderId, externalId, externalId, externalId)
    .first<{ id: string }>();
  await db.prepare(`INSERT INTO webhook_events(id,event_type,order_id,review_required,note)
    VALUES(?,?,?,1,?) ON CONFLICT(id) DO NOTHING`)
    .bind(`waffo:${event.mode}:${event.eventType}:${event.eventId}`,
      event.eventType, linked?.id ?? null,
      JSON.stringify({ message: 'Manual refund reconciliation required; credits unchanged.',
        refundId: event.eventId, providerOrderId, orderMerchantExternalId: externalId,
        paymentId: event.data.paymentId,
        refundedAmount: event.data.refundedAmount, currency: event.data.currency }))
    .run();
}
