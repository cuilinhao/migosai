import type Stripe from 'stripe';
import { creditPacks } from '../../content/pricing';
import type { User } from '../contracts';
import { isLocale, localizeHref } from '../i18n/routing';
import { appOrigin, database, type Env } from './env';
import { ApiError } from './errors';
import { stripeClient, stripeMode, stripeWebhookSecret } from './stripe';

function priceForPack(env: Env, packId: string): string {
  const price = env[`STRIPE_PRICE_${packId.toUpperCase()}` as keyof Env];
  if (typeof price !== 'string' || !/^price_[A-Za-z0-9]+$/.test(price)) {
    throw new ApiError(503, 'Stripe checkout is not configured for this credit pack.');
  }
  return price;
}

function checkoutUrl(value: unknown, sessionId: string, mode: 'test' | 'live'): string {
  if (typeof value !== 'string' || !new RegExp(`^cs_${mode}_[A-Za-z0-9]+$`).test(sessionId)) {
    throw new ApiError(502, 'The payment service returned an incomplete checkout.');
  }
  let url: URL;
  try { url = new URL(value); }
  catch { throw new ApiError(502, 'The payment service returned an invalid checkout address.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' ||
    url.username || url.password || url.port || url.pathname !== `/c/pay/${sessionId}`) {
    throw new ApiError(502, 'The payment service returned an invalid checkout address.');
  }
  return url.href;
}

export async function createStripeCheckout(env: Env, user: User, packId: unknown, requestedLocale: unknown = 'en') {
  const pack = creditPacks.find(item => item.id === packId);
  if (!pack) throw new ApiError(400, 'Unknown credit pack.');
  const locale = typeof requestedLocale === 'string' && isLocale(requestedLocale) ? requestedLocale : 'en';
  stripeWebhookSecret(env);
  const client = stripeClient(env);
  const mode = stripeMode(env);
  const priceId = priceForPack(env, pack.id);
  const origin = appOrigin(env);
  if (!origin.startsWith('https://')) throw new ApiError(503, 'Payment checkout requires a public HTTPS application URL.');
  let price;
  try { price = await client.prices.retrieve(priceId); }
  catch { throw new ApiError(502, 'Payment configuration could not be confirmed. Please try again later.'); }
  if (price.id !== priceId || !price.active || price.type !== 'one_time' || price.recurring ||
    price.livemode !== (mode === 'live') || price.currency !== 'usd' || price.unit_amount !== pack.amountCents) {
    throw new ApiError(503, 'Stripe price does not match this credit pack.');
  }
  const db = database(env);
  const orderId = crypto.randomUUID();
  await db.prepare(`INSERT INTO orders
    (id,user_id,pack_id,product_id,amount,currency,credits,provider,provider_mode)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(orderId, user.id, pack.id, priceId, pack.amountCents, 'USD', pack.credits, 'stripe', mode).run();
  const metadata = { app: 'migosai', orderId, userId: user.id, packId: pack.id, priceId, amount: String(pack.amountCents), currency: 'USD', credits: String(pack.credits), mode };
  const returnPath = `${origin}${localizeHref('/pricing', locale)}`;
  let session;
  try {
    session = await client.checkout.sessions.create({
      mode: 'payment', currency: 'usd', adaptive_pricing: { enabled: false },
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: orderId, customer_email: user.email, metadata,
      payment_intent_data: { metadata }, locale,
      success_url: `${returnPath}?checkout=completed&orderId=${encodeURIComponent(orderId)}`,
      cancel_url: `${returnPath}?checkout=cancelled&orderId=${encodeURIComponent(orderId)}`,
    }, { idempotencyKey: `stripe:${mode}:${orderId}` });
  } catch { throw new ApiError(502, 'Checkout creation could not be confirmed. Please try again later.'); }
  const url = checkoutUrl(session.url, session.id, mode);
  if (session.livemode !== (mode === 'live') || session.mode !== 'payment' ||
    session.client_reference_id !== orderId || session.amount_total !== pack.amountCents || session.currency !== 'usd' ||
    Object.entries(metadata).some(([key, value]) => session.metadata?.[key] !== value)) {
    throw new ApiError(502, 'Checkout does not match the recorded order.');
  }
  const result = await db.prepare(`UPDATE orders SET checkout_id=?
    WHERE id=? AND provider='stripe' AND provider_mode=? AND product_id=?
      AND status='pending' AND checkout_id IS NULL`)
    .bind(session.id, orderId, mode, priceId).run();
  if (result.meta.changes !== 1) throw new ApiError(503, 'Checkout could not be recorded.');
  return { checkoutUrl: url, orderId };
}

type StripeOrder = {
  id: string; user_id: string; pack_id: string; product_id: string;
  amount: number; currency: string; credits: number; checkout_id: string | null;
  provider_order_id: string | null; provider: string; provider_mode: string; status: string;
};

function matchesMetadata(metadata: Stripe.Metadata | null | undefined, order: StripeOrder): boolean {
  return !!metadata && metadata.app === 'migosai' && metadata.orderId === order.id && metadata.userId === order.user_id &&
    metadata.packId === order.pack_id && metadata.priceId === order.product_id &&
    metadata.amount === String(order.amount) && metadata.currency === order.currency &&
    metadata.credits === String(order.credits) && metadata.mode === order.provider_mode;
}

function objectId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id;
  return null;
}

function requireMatchingSession(session: Stripe.Checkout.Session, order: StripeOrder | null, env: Env): asserts order is StripeOrder {
  if (!order || order.provider !== 'stripe' || order.provider_mode !== stripeMode(env) ||
    !['pending', 'paid'].includes(order.status) || !/^price_[A-Za-z0-9]+$/.test(order.product_id) ||
    !Number.isSafeInteger(order.amount) || order.amount <= 0 ||
    !Number.isSafeInteger(order.credits) || order.credits <= 0 || order.currency !== 'USD' ||
    session.object !== 'checkout.session' || session.id !== order.checkout_id ||
    session.livemode !== (order.provider_mode === 'live') || session.mode !== 'payment' ||
    session.status !== 'complete' || session.payment_status !== 'paid' ||
    session.client_reference_id !== order.id || !matchesMetadata(session.metadata, order) ||
    session.amount_total !== order.amount || session.amount_subtotal !== order.amount ||
    session.currency !== order.currency.toLowerCase() ||
    !/^pi_[A-Za-z0-9]+$/.test(objectId(session.payment_intent) ?? '') ||
    (order.provider_order_id !== null && order.provider_order_id !== objectId(session.payment_intent))) {
    throw new ApiError(400, 'Payment does not match the recorded order.');
  }
}

async function confirmSession(env: Env, order: StripeOrder, eventSession: Stripe.Checkout.Session): Promise<string> {
  const client = stripeClient(env);
  let session: Stripe.Checkout.Session;
  try {
    session = await client.checkout.sessions.retrieve(order.checkout_id!, {
      expand: ['line_items.data.price', 'payment_intent'],
    });
  } catch { throw new ApiError(502, 'Payment confirmation is temporarily unavailable.'); }
  requireMatchingSession(session, order, env);
  const intent = session.payment_intent;
  const item = session.line_items?.data[0];
  const price = item?.price;
  if (!intent || typeof intent === 'string' || intent.id !== objectId(eventSession.payment_intent) ||
    intent.object !== 'payment_intent' || intent.status !== 'succeeded' ||
    intent.livemode !== (order.provider_mode === 'live') || intent.currency !== order.currency.toLowerCase() ||
    intent.amount !== order.amount || intent.amount_received !== order.amount || !matchesMetadata(intent.metadata, order) ||
    session.line_items?.has_more !== false || session.line_items.data.length !== 1 ||
    !item || item.quantity !== 1 || item.currency !== order.currency.toLowerCase() ||
    item.amount_subtotal !== order.amount || item.amount_total !== order.amount ||
    !price || price.id !== order.product_id || price.currency !== order.currency.toLowerCase() ||
    price.unit_amount !== order.amount || price.type !== 'one_time' || price.recurring ||
    price.livemode !== (order.provider_mode === 'live')) {
    throw new ApiError(400, 'Payment could not be confirmed against the recorded order.');
  }
  return intent.id;
}

const reviewTypes = new Set([
  'charge.refunded', 'refund.created', 'refund.updated', 'refund.failed',
  'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed',
]);

async function recordStripeReview(env: Env, event: Stripe.Event): Promise<void> {
  const db = database(env);
  const mode = stripeMode(env);
  const object = event.data.object as Stripe.Refund | Stripe.Charge | Stripe.Dispute;
  const paymentIntentId = objectId(object.payment_intent);
  if (!paymentIntentId || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) return;
  let linked = await db.prepare(`SELECT * FROM orders
    WHERE provider='stripe' AND provider_mode=? AND provider_order_id=? LIMIT 1`)
    .bind(mode, paymentIntentId).first<StripeOrder>();
  if (!linked) {
    // Refund/dispute metadata does not inherit our Checkout metadata. Resolve
    // ownership from Stripe's PaymentIntent, including before fulfillment.
    const client = stripeClient(env);
    let intent: Stripe.PaymentIntent;
    try { intent = await client.paymentIntents.retrieve(paymentIntentId); }
    catch { throw new ApiError(502, 'Payment review confirmation is temporarily unavailable.'); }
    if (intent.metadata?.app !== 'migosai') return;
    const orderId = intent.metadata.orderId;
    if (typeof orderId !== 'string' || !orderId) return;
    linked = await db.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first<StripeOrder>();
    if (!linked) return;
    if (linked.provider !== 'stripe' || linked.provider_mode !== mode ||
      !((linked.status === 'pending' && linked.provider_order_id === null) ||
        (linked.status === 'paid' && linked.provider_order_id === paymentIntentId)) || !linked.checkout_id ||
      !Number.isSafeInteger(linked.amount) || linked.amount <= 0 || linked.currency !== 'USD' ||
      !Number.isSafeInteger(linked.credits) || linked.credits <= 0 ||
      !/^price_[A-Za-z0-9]+$/.test(linked.product_id) ||
      intent.object !== 'payment_intent' || intent.id !== paymentIntentId || intent.livemode !== (mode === 'live') ||
      intent.amount !== linked.amount || intent.currency !== linked.currency.toLowerCase() ||
      !matchesMetadata(intent.metadata, linked)) {
      throw new ApiError(400, 'Payment review does not match the recorded order.');
    }
  }
  await db.prepare(`INSERT INTO webhook_events(id,event_type,order_id,review_required,note)
    VALUES(?,?,?,1,?) ON CONFLICT(id) DO NOTHING`)
    .bind(`stripe:${mode}:${event.id}`, event.type, linked.id,
      JSON.stringify({ message: 'Manual refund or dispute reconciliation required; credits unchanged.',
        paymentIntentId, objectId: object.id, amount: object.amount, currency: object.currency }))
    .run();
}

// Must only be called with an event verified by verifyStripeWebhook.
export async function applyStripeEvent(env: Env, event: Stripe.Event): Promise<void> {
  const mode = stripeMode(env);
  if (!event || event.object !== 'event' || !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
    event.livemode !== (mode === 'live') || event.account || !event.data?.object) {
    throw new ApiError(400, 'Invalid payment event.');
  }
  if (reviewTypes.has(event.type)) { await recordStripeReview(env, event); return; }
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return;
  const session = event.data.object as Stripe.Checkout.Session;
  // A completed Checkout can still await an asynchronous payment. Only a paid
  // notification may enter fulfillment; an old unpaid event never regresses it.
  if (session.payment_status !== 'paid') return;
  const db = database(env);
  // Session IDs are our durable ownership binding. A missing/changed app tag
  // cannot hide tampering on a Checkout already bound to a local Stripe order.
  const bound = typeof session.id === 'string' ? await db.prepare(
    "SELECT * FROM orders WHERE checkout_id=? AND provider='stripe'")
    .bind(session.id).first<StripeOrder>() : null;
  if (session.metadata?.app !== 'migosai' && !bound) return;
  const orderId = session.client_reference_id;
  if (typeof orderId !== 'string' || !orderId) throw new ApiError(400, 'Payment order reference is missing.');
  const order = bound ?? await db.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first<StripeOrder>();
  requireMatchingSession(session, order, env);
  const paymentIntentId = await confirmSession(env, order, session);
  const snapshot = `id=? AND provider='stripe' AND provider_mode=? AND user_id=? AND pack_id=?
    AND product_id=? AND amount=? AND currency=? AND credits=? AND checkout_id=?`;
  const bindings = [order.id, order.provider_mode, order.user_id, order.pack_id,
    order.product_id, order.amount, order.currency, order.credits, order.checkout_id];
  const results = await db.batch([
    db.prepare(`UPDATE orders SET status='paid',provider_order_id=? WHERE ${snapshot}
      AND ((status='pending' AND provider_order_id IS NULL) OR (status='paid' AND provider_order_id=?))`)
      .bind(paymentIntentId, ...bindings, paymentIntentId),
    db.prepare(`INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id)
      SELECT id||':payment',user_id,credits,'payment',id FROM orders
      WHERE ${snapshot} AND provider_order_id=? AND status='paid'
      ON CONFLICT(kind,reference_id) DO NOTHING`)
      .bind(...bindings, paymentIntentId),
    db.prepare(`INSERT INTO webhook_events(id,event_type,order_id)
      SELECT ?,?,id FROM orders WHERE ${snapshot} AND provider_order_id=? AND status='paid'
      ON CONFLICT(id) DO NOTHING`)
      .bind(`stripe:${mode}:${event.id}`, event.type, ...bindings, paymentIntentId),
  ]);
  if (results[0].meta.changes !== 1) throw new ApiError(409, 'Payment order changed before it could be credited.');
}
