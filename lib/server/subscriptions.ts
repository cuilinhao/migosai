import type Stripe from "stripe";
import { subscriptionPlans } from "../../content/pricing";
import type { User } from "../contracts";
import { isLocale, localizeHref } from "../i18n/routing";
import { appOrigin, database, type Env } from "./env";
import { ApiError } from "./errors";
import { stripeClient, stripeMode, stripeWebhookSecret } from "./stripe";
import { grantSubscriptionInvoice } from "./subscription-credits";

type SubscriptionRow = {
  id: string;
  user_id: string;
  provider_mode: "test" | "live";
  plan_id: string;
  billing_interval: "month" | "year";
  price_id: string;
  amount_cents: number;
  monthly_credits: number;
  customer_id: string | null;
  subscription_id: string | null;
  checkout_id: string | null;
  checkout_url: string | null;
  status: string;
  cancel_at_period_end: number;
  current_period_start: number | null;
  current_period_end: number | null;
  checkout_expires_at: number | null;
  checkout_return_path: string | null;
  created_at: number;
};
const openStates =
  "'pending','incomplete','active','trialing','past_due','unpaid','paused'";
const idOf = (value: unknown): string | null =>
  typeof value === "string"
    ? value
    : value && typeof value === "object" && "id" in value
      ? String(value.id)
      : null;
function reject(): never {
  throw new ApiError(400, "Subscription does not match the recorded purchase.");
}
async function stripeRequest<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      502,
      "Subscription service could not be confirmed. Please try again later.",
    );
  }
}
function expectedMetadata(row: SubscriptionRow) {
  return {
    app: "migosai",
    orderId: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    billingInterval: row.billing_interval,
    priceId: row.price_id,
    amount: String(row.amount_cents),
    credits: String(row.monthly_credits),
    mode: row.provider_mode,
  };
}
function metadataMatches(
  value: Stripe.Metadata | null | undefined,
  row: SubscriptionRow,
) {
  return (
    !!value &&
    Object.entries(expectedMetadata(row)).every(
      ([key, expected]) => value[key] === expected,
    )
  );
}
/** Extra administrator metadata changes future renewal allowances only. The
 * original purchase metadata remains the identity used to verify old orders.
 */
function renewalAllowance(
  row: SubscriptionRow,
  metadata: Stripe.Metadata,
  billingReason: Stripe.Invoice.BillingReason | null,
  periodStart: number,
): number | undefined {
  const credits = metadata.renewalCredits;
  const effectiveAt = metadata.renewalCreditsEffectiveAt;
  if (credits === undefined && effectiveAt === undefined) return undefined;
  if (
    !/^[1-9]\d*$/.test(credits ?? "") ||
    !/^[1-9]\d*$/.test(effectiveAt ?? "") ||
    !Number.isSafeInteger(Number(credits)) ||
    !Number.isSafeInteger(Number(effectiveAt))
  ) reject();
  if (
    row.billing_interval !== "month" ||
    billingReason !== "subscription_cycle" ||
    periodStart < Number(effectiveAt)
  ) return undefined;
  return Number(credits);
}
function paymentOrigin(env: Env) {
  const origin = appOrigin(env);
  if (stripeMode(env) === "live" && !origin.startsWith("https://"))
    throw new ApiError(
      503,
      "Payment checkout requires a public HTTPS application URL.",
    );
  return origin;
}
function hostedUrl(value: unknown, host: string) {
  if (typeof value !== "string")
    throw new ApiError(
      502,
      "Subscription service returned an invalid address.",
    );
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.port ||
    url.username ||
    url.password
  )
    throw new ApiError(
      502,
      "Subscription service returned an invalid address.",
    );
  return url.href;
}
function verifyPrice(
  price: Stripe.Price,
  row: SubscriptionRow,
  requireActive = true,
) {
  if (
    price.id !== row.price_id ||
    (requireActive && !price.active) ||
    price.livemode !== (row.provider_mode === "live") ||
    price.currency !== "usd" ||
    price.unit_amount !== row.amount_cents ||
    price.type !== "recurring" ||
    price.recurring?.interval !== row.billing_interval ||
    price.recurring.interval_count !== 1 ||
    price.recurring.usage_type !== "licensed"
  )
    reject();
}
function validateSubscription(sub: Stripe.Subscription, row: SubscriptionRow) {
  if (
    sub.livemode !== (row.provider_mode === "live") ||
    !/^sub_[A-Za-z0-9]+$/.test(sub.id) ||
    (row.subscription_id && sub.id !== row.subscription_id) ||
    idOf(sub.customer) !== row.customer_id ||
    !metadataMatches(sub.metadata, row) ||
    sub.items.has_more ||
    sub.items.data.length !== 1 ||
    sub.discounts.length
  )
    reject();
  const item = sub.items.data[0];
  if (item.quantity !== 1) reject();
  verifyPrice(item.price, row, false);
  if (
    !Number.isSafeInteger(item.current_period_start) ||
    !Number.isSafeInteger(item.current_period_end) ||
    item.current_period_end <= item.current_period_start
  )
    reject();
  return item;
}
type SubscriptionSync = {
  row: SubscriptionRow;
  sub: Stripe.Subscription;
  syncVersion: number;
};
async function readForSync(
  env: Env,
  row: SubscriptionRow,
  id: string,
): Promise<SubscriptionSync> {
  // Reserve before the remote read so a delayed response cannot undo a newer
  // cancellation or lifecycle update. A failed read is retried by Stripe.
  const reserved = await database(env)
    .prepare(
      "UPDATE subscriptions SET sync_version=sync_version+1 WHERE id=? AND user_id=? AND provider_mode=? AND (subscription_id IS NULL OR subscription_id=?) RETURNING sync_version",
    )
    .bind(row.id, row.user_id, row.provider_mode, id)
    .first<{ sync_version: number }>();
  if (!reserved) reject();
  const sub = await stripeRequest(() =>
    stripeClient(env).subscriptions.retrieve(id),
  );
  validateSubscription(sub, row);
  return { row, sub, syncVersion: reserved.sync_version };
}
async function bindAndSync(
  env: Env,
  { row, sub, syncVersion }: SubscriptionSync,
) {
  const item = validateSubscription(sub, row);
  // Portal can schedule period-end cancellation with cancel_at while leaving
  // cancel_at_period_end false. Both shapes mean the next renewal is canceled.
  const cancelAtPeriodEnd =
    sub.cancel_at_period_end || sub.cancel_at === item.current_period_end;
  await database(env)
    .prepare(
      `UPDATE subscriptions SET subscription_id=?,status=?,cancel_at_period_end=?,current_period_start=?,current_period_end=?,updated_at=unixepoch() WHERE id=? AND user_id=? AND provider_mode=? AND (subscription_id IS NULL OR subscription_id=?) AND sync_version=?`,
    )
    .bind(
      sub.id,
      sub.status,
      cancelAtPeriodEnd ? 1 : 0,
      item.current_period_start,
      item.current_period_end,
      row.id,
      row.user_id,
      row.provider_mode,
      sub.id,
      syncVersion,
    )
    .run();
  return item;
}
async function customerFor(env: Env, user: User) {
  const db = database(env),
    mode = stripeMode(env),
    client = stripeClient(env);
  const stored = await db
    .prepare(
      "SELECT customer_id FROM stripe_customers WHERE user_id=? AND provider_mode=?",
    )
    .bind(user.id, mode)
    .first<{ customer_id: string }>();
  const customer = await stripeRequest(() =>
    stored
      ? client.customers.retrieve(stored.customer_id)
      : client.customers.create(
          {
            email: user.email,
            name: user.name,
            metadata: { app: "migosai", userId: user.id, mode },
          },
          { idempotencyKey: `migosai:customer:${mode}:${user.id}` },
        ),
  );
  if ("deleted" in customer && customer.deleted)
    throw new ApiError(409, "Billing customer needs support review.");
  if (
    customer.livemode !== (mode === "live") ||
    customer.metadata?.app !== "migosai" ||
    customer.metadata.userId !== user.id ||
    customer.metadata.mode !== mode
  )
    reject();
  await db
    .prepare(
      "INSERT INTO stripe_customers(user_id,provider_mode,customer_id) VALUES(?,?,?) ON CONFLICT(user_id,provider_mode) DO NOTHING",
    )
    .bind(user.id, mode, customer.id)
    .run();
  return customer.id;
}
function validateSession(
  session: Stripe.Checkout.Session,
  row: SubscriptionRow,
) {
  if (
    !new RegExp(`^cs_${row.provider_mode}_[A-Za-z0-9]+$`).test(session.id) ||
    (row.checkout_id && session.id !== row.checkout_id) ||
    session.livemode !== (row.provider_mode === "live") ||
    session.mode !== "subscription" ||
    session.amount_total !== row.amount_cents ||
    session.currency !== "usd" ||
    session.total_details?.amount_discount !== 0 ||
    session.total_details?.amount_tax !== 0 ||
    session.client_reference_id !== row.id ||
    idOf(session.customer) !== row.customer_id ||
    !metadataMatches(session.metadata, row)
  )
    reject();
}
async function retireExpiredCheckout(
  db: D1Database,
  row: SubscriptionRow,
  session: Stripe.Checkout.Session,
) {
  validateSession(session, row);
  if (
    session.status !== "expired" ||
    session.payment_status !== "unpaid" ||
    session.subscription
  )
    throw new ApiError(
      409,
      "The previous checkout could not be closed. If you just paid, wait for confirmation; otherwise please retry.",
    );
  // Retire both records atomically, only while neither payment nor subscription
  // has completed. The version also fences any older subscription sync in flight.
  const results = await db.batch([
    db.prepare(
      "UPDATE subscriptions SET status='expired',sync_version=sync_version+1,updated_at=unixepoch() WHERE id=? AND user_id=? AND provider_mode=? AND status='pending' AND checkout_id=? AND subscription_id IS NULL AND EXISTS(SELECT 1 FROM orders WHERE id=? AND user_id=? AND provider_mode=? AND purchase_type='subscription' AND status='pending' AND checkout_id=?)",
    ).bind(row.id, row.user_id, row.provider_mode, row.checkout_id, row.id, row.user_id, row.provider_mode, row.checkout_id),
    db.prepare(
      "UPDATE orders SET status='cancelled' WHERE id=? AND user_id=? AND provider_mode=? AND purchase_type='subscription' AND status='pending' AND checkout_id=? AND EXISTS(SELECT 1 FROM subscriptions WHERE id=? AND user_id=? AND provider_mode=? AND status='expired' AND checkout_id=?)",
    ).bind(row.id, row.user_id, row.provider_mode, row.checkout_id, row.id, row.user_id, row.provider_mode, row.checkout_id),
  ]);
  if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1)
    throw new ApiError(
      409,
      "Your subscription checkout changed while switching plans. Please retry or check your payment status.",
    );
}
export async function createSubscriptionCheckout(
  env: Env,
  user: User,
  planId: unknown,
  interval: unknown,
  requestedLocale: unknown = "en",
): Promise<{ checkoutUrl: string; orderId: string }> {
  if (user.isGuest) throw new ApiError(401, "Please sign in to subscribe.");
  if (env.PAYMENT_PROVIDER !== "stripe")
    throw new ApiError(503, "Stripe subscriptions are not configured.");
  const plan = subscriptionPlans.find((plan) => plan.id === planId);
  if (!plan || (interval !== "month" && interval !== "year"))
    throw new ApiError(400, "Unknown subscription plan.");
  stripeWebhookSecret(env);
  const mode = stripeMode(env),
    origin = paymentOrigin(env),
    client = stripeClient(env),
    db = database(env);
  const locale =
    typeof requestedLocale === "string" && isLocale(requestedLocale)
      ? requestedLocale
      : "en";
  const key = `STRIPE_PRICE_${interval === "month" ? "MONTHLY" : "YEARLY"}_${plan.id.replaceAll("-", "_").toUpperCase()}`;
  const priceId = env[key as keyof Env];
  if (typeof priceId !== "string" || !/^price_[A-Za-z0-9]+$/.test(priceId))
    throw new ApiError(503, "This subscription plan is not configured.");
  const amount = interval === "month" ? plan.monthlyPriceCents : plan.yearlyPriceCents;
  const matchesRequestedPurchase = (stored: SubscriptionRow) =>
    stored.plan_id === plan.id && stored.billing_interval === interval &&
    stored.price_id === priceId && stored.amount_cents === amount &&
    stored.monthly_credits === plan.credits;
  let row = await db
    .prepare(
      `SELECT * FROM subscriptions WHERE user_id=? AND provider_mode=? AND status IN (${openStates})`,
    )
    .bind(user.id, mode)
    .first<SubscriptionRow>();
  if (row && row.status !== "pending")
    throw new ApiError(
      409,
      "You already have a subscription. Manage it from billing settings.",
    );
  if (row?.checkout_id) {
    let session = await stripeRequest(() =>
      client.checkout.sessions.retrieve(row!.checkout_id!),
    );
    validateSession(session, row);
    if (
      session.status === "open" &&
      !matchesRequestedPurchase(row)
    ) {
      try {
        session = await client.checkout.sessions.expire(
          row.checkout_id,
          {},
          { idempotencyKey: `migosai:subscription-expire:${mode}:${row.id}` },
        );
      } catch {
        throw new ApiError(
          502,
          "The previous checkout could not be closed. If you just paid, wait for confirmation; otherwise please retry.",
        );
      }
      await retireExpiredCheckout(db, row, session);
      row = null;
    } else if (session.status === "expired") {
      await retireExpiredCheckout(db, row, session);
      row = null;
    } else if (session.status === "complete") {
      throw new ApiError(409, "Your subscription payment is being confirmed.");
    } else if (session.status === "open") {
      return {
        checkoutUrl: hostedUrl(session.url, "checkout.stripe.com"),
        orderId: row.id,
      };
    } else reject();
  }
  if (
    row &&
    !row.checkout_id &&
    Math.floor(Date.now() / 1000) - row.created_at > 23 * 3600
  )
    throw new ApiError(
      409,
      "The previous checkout needs support review before another can be created.",
    );
  if (row && !matchesRequestedPurchase(row))
    throw new ApiError(409, "Another subscription checkout is pending.");
  if (!row) {
    const id = crypto.randomUUID();
    const candidate = {
      id,
      user_id: user.id,
      provider_mode: mode,
      plan_id: plan.id,
      billing_interval: interval,
      price_id: priceId,
      amount_cents: amount,
      monthly_credits: plan.credits,
    } as SubscriptionRow;
    verifyPrice(
      await stripeRequest(() => client.prices.retrieve(priceId)),
      candidate,
    );
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits,checkout_return_path) VALUES(?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            id,
            user.id,
            mode,
            plan.id,
            interval,
            priceId,
            amount,
            plan.credits,
            origin + localizeHref("/pricing", locale),
          ),
        db
          .prepare(
            `INSERT INTO orders(id,user_id,pack_id,product_id,amount,currency,credits,provider,provider_mode,purchase_type) VALUES(?,?,?,?,?,'USD',?,'stripe',?,'subscription')`,
          )
          .bind(id, user.id, plan.id, priceId, amount, plan.credits, mode),
      ]);
    } catch (error) {
      if (String(error).includes("UNIQUE"))
        throw new ApiError(
          409,
          "Another subscription checkout is pending. Please retry.",
        );
      throw error;
    }
    row = await db
      .prepare("SELECT * FROM subscriptions WHERE id=?")
      .bind(id)
      .first<SubscriptionRow>();
  }
  if (!row)
    throw new ApiError(503, "Subscription checkout could not be recorded.");
  const customerId = await customerFor(env, user);
  await db
    .prepare(
      "UPDATE subscriptions SET customer_id=? WHERE id=? AND status='pending'",
    )
    .bind(customerId, row.id)
    .run();
  row.customer_id = customerId;
  const path =
      row.checkout_return_path ?? origin + localizeHref("/pricing", locale),
    metadata = expectedMetadata(row);
  const storedLocale = new URL(path).pathname.split("/")[1];
  const checkoutLocale = isLocale(storedLocale) ? storedLocale : "en";
  const session = await stripeRequest(() =>
    client.checkout.sessions.create(
      {
        mode: "subscription",
        currency: "usd",
        adaptive_pricing: { enabled: false },
        customer: customerId,
        line_items: [{ price: row!.price_id, quantity: 1 }],
        metadata,
        subscription_data: { metadata },
        allow_promotion_codes: false,
        automatic_tax: { enabled: false },
        locale: checkoutLocale,
        client_reference_id: row!.id,
        success_url: `${path}?checkout=completed&orderId=${encodeURIComponent(row!.id)}`,
        cancel_url: `${path}?checkout=cancelled&orderId=${encodeURIComponent(row!.id)}`,
      },
      { idempotencyKey: `migosai:subscription:${mode}:${row!.id}` },
    ),
  );
  validateSession(session, row);
  const checkoutUrl = hostedUrl(session.url, "checkout.stripe.com");
  await db.batch([
    db
      .prepare(
        "UPDATE subscriptions SET checkout_id=?,checkout_url=?,checkout_expires_at=?,updated_at=unixepoch() WHERE id=? AND (checkout_id IS NULL OR checkout_id=?)",
      )
      .bind(session.id, checkoutUrl, session.expires_at, row.id, session.id),
    db
      .prepare(
        "UPDATE orders SET checkout_id=? WHERE id=? AND (checkout_id IS NULL OR checkout_id=?)",
      )
      .bind(session.id, row.id, session.id),
  ]);
  return { checkoutUrl, orderId: row.id };
}
async function ownedSubscription(
  env: Env,
  id: string,
): Promise<SubscriptionSync | null> {
  const db = database(env),
    mode = stripeMode(env),
    client = stripeClient(env);
  let row = await db
    .prepare(
      "SELECT * FROM subscriptions WHERE subscription_id=? AND provider_mode=?",
    )
    .bind(id, mode)
    .first<SubscriptionRow>();
  if (!row) {
    // The first read only discovers the local row. Fetch again after reserving
    // its version; this discovery snapshot must never be written as state.
    const sub = await stripeRequest(() => client.subscriptions.retrieve(id));
    if (sub.metadata?.app !== "migosai") return null;
    row = await db
      .prepare("SELECT * FROM subscriptions WHERE id=? AND provider_mode=?")
      .bind(sub.metadata.orderId ?? "", mode)
      .first<SubscriptionRow>();
    if (!row) reject();
  }
  return readForSync(env, row, id);
}
async function paidInvoice(env: Env, event: Stripe.Event) {
  const invoiceId = idOf(event.data.object);
  if (!invoiceId || !/^in_[A-Za-z0-9]+$/.test(invoiceId)) reject();
  const client = stripeClient(env),
    invoice = await stripeRequest(() => client.invoices.retrieve(invoiceId));
  const subscriptionId = idOf(
    invoice.parent?.subscription_details?.subscription,
  );
  if (!subscriptionId) return;
  const owned = await ownedSubscription(env, subscriptionId);
  if (!owned) return;
  const { row, sub } = owned;
  if (
    invoice.id !== invoiceId ||
    invoice.livemode !== (row.provider_mode === "live") ||
    idOf(invoice.customer) !== row.customer_id ||
    invoice.status !== "paid" ||
    invoice.currency !== "usd" ||
    invoice.amount_paid !== row.amount_cents ||
    invoice.amount_due !== row.amount_cents ||
    invoice.total !== row.amount_cents ||
    invoice.subtotal !== row.amount_cents ||
    invoice.amount_remaining !== 0 ||
    (invoice.amount_paid_off_stripe ?? 0) !== 0 ||
    invoice.discounts.length ||
    (invoice.total_discount_amounts ?? []).some((v) => v.amount !== 0) ||
    !["subscription_create", "subscription_cycle"].includes(
      invoice.billing_reason ?? "",
    )
  )
    reject();
  const lines = await stripeRequest(() =>
    client.invoices.listLineItems(invoiceId, { limit: 100 }),
  );
  if (lines.has_more || lines.data.length !== 1) reject();
  const line = lines.data[0];
  if (
    line.livemode !== (row.provider_mode === "live") ||
    line.currency !== "usd" ||
    line.quantity !== 1 ||
    line.amount !== row.amount_cents ||
    line.subtotal !== row.amount_cents ||
    idOf(line.pricing?.price_details?.price) !== row.price_id ||
    line.parent?.type !== "subscription_item_details" ||
    line.parent.subscription_item_details?.subscription !== sub.id ||
    line.parent.subscription_item_details.subscription_item !==
      sub.items.data[0].id ||
    line.parent.subscription_item_details.proration ||
    (line.discount_amounts ?? []).some((v) => v.amount !== 0) ||
    !Number.isSafeInteger(line.period.start) ||
    !Number.isSafeInteger(line.period.end) ||
    line.period.end <= line.period.start
  )
    reject();
  const payments = await stripeRequest(() =>
    client.invoicePayments.list({
      invoice: invoiceId,
      status: "paid",
      limit: 100,
    }),
  );
  if (payments.has_more || payments.data.length !== 1) reject();
  const payment = payments.data[0];
  if (
    idOf(payment.invoice) !== invoiceId ||
    payment.livemode !== (row.provider_mode === "live") ||
    payment.status !== "paid" ||
    payment.currency !== "usd" ||
    payment.amount_paid !== row.amount_cents ||
    payment.payment.type !== "payment_intent"
  )
    reject();
  const intentId = idOf(payment.payment.payment_intent);
  if (!intentId) reject();
  const intent = await stripeRequest(() =>
    client.paymentIntents.retrieve(intentId),
  );
  if (
    intent.id !== intentId ||
    intent.status !== "succeeded" ||
    intent.livemode !== (row.provider_mode === "live") ||
    idOf(intent.customer) !== row.customer_id ||
    intent.currency !== "usd" ||
    intent.amount !== row.amount_cents ||
    intent.amount_received !== row.amount_cents
  )
    reject();
  await bindAndSync(env, owned);
  await grantSubscriptionInvoice(database(env), {
    subscriptionId: row.id,
    userId: row.user_id,
    providerMode: row.provider_mode,
    invoiceId,
    periodStart: line.period.start,
    periodEnd: line.period.end,
    interval: row.billing_interval,
    monthlyCredits: row.monthly_credits,
    allowanceCredits: renewalAllowance(row, sub.metadata, invoice.billing_reason, line.period.start),
  });
  // The first Checkout order becomes paid only after the durable invoice grant.
  const db = database(env);
  await db.batch([
    db
      .prepare(
        "UPDATE orders SET status='paid',provider_order_id=? WHERE id=? AND purchase_type='subscription' AND status='pending'",
      )
      .bind(invoiceId, row.id),
    db
      .prepare(
        `INSERT INTO orders(id,user_id,pack_id,product_id,amount,currency,credits,provider,provider_mode,purchase_type,provider_order_id,status) SELECT ?,o.user_id,o.pack_id,o.product_id,o.amount,o.currency,i.monthly_credits,o.provider,o.provider_mode,'subscription',?,'paid' FROM orders o JOIN subscription_invoices i ON i.subscription_id=o.id AND i.user_id=o.user_id AND i.provider_mode=o.provider_mode AND i.invoice_id=? WHERE o.id=? AND o.status='paid' AND o.provider_order_id!=? ON CONFLICT(id) DO NOTHING`,
      )
      .bind(`${row.id}:${invoiceId}`, invoiceId, invoiceId, row.id, invoiceId),
    db
      .prepare(
        `INSERT INTO webhook_events(id,event_type,order_id) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING`,
      )
      .bind(`stripe:${row.provider_mode}:${event.id}`, event.type, row.id),
  ]);
}
async function reviewSubscriptionPayment(
  env: Env,
  event: Stripe.Event,
): Promise<boolean> {
  const db = database(env),
    mode = stripeMode(env);
  // Preserve the established one-time review path and avoid unnecessary API calls.
  if (
    !(await db
      .prepare("SELECT id FROM subscriptions WHERE provider_mode=? LIMIT 1")
      .bind(mode)
      .first())
  )
    return false;
  const object = event.data.object as
    | Stripe.Refund
    | Stripe.Charge
    | Stripe.Dispute;
  const intentId = idOf(object.payment_intent);
  if (!intentId) return false;
  const knownCreditOrder = await db
    .prepare(
      "SELECT id FROM orders WHERE provider_mode=? AND provider='stripe' AND purchase_type='credits' AND provider_order_id=?",
    )
    .bind(mode, intentId)
    .first();
  if (knownCreditOrder) return false;
  const client = stripeClient(env),
    payments = await stripeRequest(() =>
      client.invoicePayments.list({
        payment: { type: "payment_intent", payment_intent: intentId },
        limit: 100,
      }),
    );
  if (payments.has_more)
    throw new ApiError(503, "Payment review requires support.");
  const payment = payments.data.find(
    (p) =>
      p.payment.type === "payment_intent" &&
      idOf(p.payment.payment_intent) === intentId,
  );
  if (!payment) return false;
  const invoiceId = idOf(payment.invoice);
  if (!invoiceId) reject();
  const invoice = await stripeRequest(() =>
    client.invoices.retrieve(invoiceId),
  );
  const subId = idOf(invoice.parent?.subscription_details?.subscription);
  if (!subId) return false;
  const owned = await ownedSubscription(env, subId);
  if (!owned) return false;
  if (
    payment.livemode !== (mode === "live") ||
    invoice.livemode !== (mode === "live") ||
    idOf(invoice.customer) !== owned.row.customer_id
  )
    reject();
  await bindAndSync(env, owned);
  await db
    .prepare(
      "INSERT INTO webhook_events(id,event_type,order_id,review_required,note) VALUES(?,?,?,1,?) ON CONFLICT(id) DO NOTHING",
    )
    .bind(
      `stripe:${mode}:${event.id}`,
      event.type,
      owned.row.id,
      JSON.stringify({
        message:
          "Subscription refund or dispute requires manual review; credits unchanged.",
        invoiceId,
        paymentIntentId: intentId,
        objectId: object.id,
      }),
    )
    .run();
  return true;
}
export async function applySubscriptionEvent(
  env: Env,
  event: Stripe.Event,
): Promise<boolean> {
  const mode = stripeMode(env);
  if (
    event.livemode !== (mode === "live") ||
    event.account ||
    event.object !== "event" ||
    !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
    !event.data?.object
  )
    reject();
  if (
    [
      "charge.refunded",
      "refund.created",
      "refund.updated",
      "refund.failed",
      "charge.dispute.created",
      "charge.dispute.updated",
      "charge.dispute.closed",
    ].includes(event.type)
  )
    return reviewSubscriptionPayment(env, event);
  if (event.type === "invoice.paid") {
    await paidInvoice(env, event);
    return true;
  }
  if (event.type.startsWith("customer.subscription.")) {
    const id = idOf(event.data.object);
    if (!id || !/^sub_[A-Za-z0-9]+$/.test(id)) reject();
    const owned = await ownedSubscription(env, id);
    if (owned) await bindAndSync(env, owned);
    return true;
  }
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const incoming = event.data.object as Stripe.Checkout.Session;
    if (incoming.mode !== "subscription") return false;
    const db = database(env);
    const row =
      (await db
        .prepare(
          "SELECT * FROM subscriptions WHERE checkout_id=? AND provider_mode=?",
        )
        .bind(incoming.id, mode)
        .first<SubscriptionRow>()) ??
      (await db
        .prepare("SELECT * FROM subscriptions WHERE id=? AND provider_mode=?")
        .bind(incoming.metadata?.orderId ?? "", mode)
        .first<SubscriptionRow>());
    if (!row) {
      if (incoming.metadata?.app === "migosai") reject();
      return true;
    }
    const session = await stripeRequest(() =>
      stripeClient(env).checkout.sessions.retrieve(incoming.id),
    );
    validateSession(session, row);
    const id = idOf(session.subscription);
    if (id) {
      await bindAndSync(env, await readForSync(env, row, id));
    }
    return true;
  }
  // Failed invoices never grant a period. State is synchronized independently.
  return event.type.startsWith("invoice.");
}
async function latestSubscription(env: Env, userId: string) {
  return database(env)
    .prepare(
      `SELECT * FROM subscriptions WHERE user_id=? AND provider_mode=? ORDER BY CASE WHEN status IN (${openStates}) THEN 0 ELSE 1 END,created_at DESC,rowid DESC LIMIT 1`,
    )
    .bind(userId, stripeMode(env))
    .first<SubscriptionRow>();
}
async function reloadSubscription(env: Env, row: SubscriptionRow) {
  const current = await database(env)
    .prepare("SELECT * FROM subscriptions WHERE id=? AND user_id=? AND provider_mode=?")
    .bind(row.id, row.user_id, row.provider_mode)
    .first<SubscriptionRow>();
  if (!current) throw new ApiError(404, "No subscription is available to manage.");
  return current;
}
/** Account refreshes reconcile lifecycle only. Credits still require invoice.paid. */
async function refreshSubscription(env: Env, row: SubscriptionRow) {
  let checkoutUrl: string | null = null;
  if (row.subscription_id) {
    await bindAndSync(env, await readForSync(env, row, row.subscription_id));
  } else if (row.status === "pending" && row.checkout_id) {
    const session = await stripeRequest(() =>
      stripeClient(env).checkout.sessions.retrieve(row.checkout_id!),
    );
    validateSession(session, row);
    if (session.status === "complete") {
      const id = idOf(session.subscription);
      if (id) await bindAndSync(env, await readForSync(env, row, id));
    } else if (session.status === "expired") {
      try {
        await retireExpiredCheckout(database(env), row, session);
      } catch (error) {
        // Another refresh or a webhook may have already advanced this purchase.
        // Never retire over a newly bound subscription or a confirmed payment.
        const current = await reloadSubscription(env, row);
        if (!(error instanceof ApiError) || error.status !== 409 || current.status === "pending") throw error;
      }
    } else if (session.status === "open" && session.payment_status === "unpaid" && !session.subscription) {
      checkoutUrl = hostedUrl(session.url, "checkout.stripe.com");
    } else reject();
  }
  const current = await reloadSubscription(env, row);
  return { row: current, checkoutUrl: current.status === "pending" && !current.subscription_id ? checkoutUrl : null };
}
const cancellableStates = ["active", "trialing", "past_due"];
function canCancelRenewal(row: SubscriptionRow) {
  return !!row.subscription_id && !row.cancel_at_period_end && cancellableStates.includes(row.status);
}
export async function subscriptionStatus(env: Env, userId: string) {
  const latest = await latestSubscription(env, userId);
  if (!latest) return { subscription: null };
  const { row, checkoutUrl } = await refreshSubscription(env, latest);
  return {
    subscription: {
      id: row.id,
      planId: row.plan_id,
      billingInterval: row.billing_interval,
      status: row.status,
      canManage: !!row.subscription_id && !!row.customer_id,
      canCancel: !!checkoutUrl || canCancelRenewal(row),
      checkoutUrl,
      cancelAtPeriodEnd: !!row.cancel_at_period_end,
      currentPeriodStart: row.current_period_start
        ? new Date(row.current_period_start * 1000).toISOString()
        : null,
      currentPeriodEnd: row.current_period_end
        ? new Date(row.current_period_end * 1000).toISOString()
        : null,
    },
  };
}
async function portalForSubscription(env: Env, row: SubscriptionRow, locale?: unknown, cancel = false) {
  if (!row.subscription_id || !row.customer_id)
    throw new ApiError(409, "Your subscription payment is being confirmed.");
  const configId = env.STRIPE_PORTAL_CONFIGURATION;
  if (!configId || !/^bpc_[A-Za-z0-9]+$/.test(configId))
    throw new ApiError(503, "Subscription management is not configured.");
  const client = stripeClient(env),
    config = await stripeRequest(() => client.billingPortal.configurations.retrieve(configId));
  if (
    config.id !== configId ||
    !config.active ||
    config.livemode !== (row.provider_mode === "live") ||
    config.features.subscription_update.enabled ||
    !config.features.subscription_cancel.enabled ||
    config.features.subscription_cancel.mode !== "at_period_end" ||
    config.features.subscription_cancel.proration_behavior !== "none"
  )
    throw new ApiError(503, "Subscription management configuration is not supported.");
  const returnUrl = paymentOrigin(env) + localizeHref("/app/my-orders", typeof locale === "string" && isLocale(locale) ? locale : "en") + "#subscription";
  const session = await stripeRequest(() =>
    client.billingPortal.sessions.create({
      customer: row.customer_id!,
      configuration: configId,
      return_url: returnUrl,
      ...(cancel ? { flow_data: {
        type: "subscription_cancel" as const,
        subscription_cancel: { subscription: row.subscription_id! },
        after_completion: { type: "redirect" as const, redirect: { return_url: returnUrl } },
      } } : {}),
    }),
  );
  if (
    session.customer !== row.customer_id ||
    session.livemode !== (row.provider_mode === "live") ||
    idOf(session.configuration) !== configId
  ) reject();
  return { url: hostedUrl(session.url, "billing.stripe.com") };
}
export async function createSubscriptionPortal(env: Env, userId: string, locale?: unknown) {
  const latest = await latestSubscription(env, userId);
  if (!latest) throw new ApiError(404, "No subscription is available to manage.");
  const { row } = await refreshSubscription(env, latest);
  return portalForSubscription(env, row, locale);
}
export async function cancelSubscription(env: Env, userId: string, subscriptionId: string, locale?: unknown) {
  const latest = await latestSubscription(env, userId);
  if (!latest) throw new ApiError(404, "No subscription is available to manage.");
  if (latest.id !== subscriptionId)
    throw new ApiError(409, "The subscription has changed. Refresh and try again.");
  const { row, checkoutUrl } = await refreshSubscription(env, latest);
  if (row.subscription_id) {
    // Closing an unpaid checkout must not silently become canceling a purchase
    // that completed while the account page was open.
    if (!latest.subscription_id)
      throw new ApiError(409, "The subscription has changed. Refresh and try again.");
    if (row.cancel_at_period_end || ["canceled", "incomplete_expired"].includes(row.status))
      return { cancelled: true as const };
    if (!canCancelRenewal(row))
      throw new ApiError(409, "The subscription has changed. Refresh and try again.");
    return portalForSubscription(env, row, locale, true);
  }
  if (row.status === "expired") return { cancelled: true as const };
  if (!row.checkout_id)
    throw new ApiError(409, "Subscription checkout is still being prepared. Please try again.");
  if (!checkoutUrl)
    throw new ApiError(409, "Your subscription payment is being confirmed.");
  const session = await stripeRequest(() => stripeClient(env).checkout.sessions.expire(
    row.checkout_id!, {},
    { idempotencyKey: `migosai:subscription-expire:${row.provider_mode}:${row.id}` },
  ));
  await retireExpiredCheckout(database(env), row, session);
  return { cancelled: true as const };
}
