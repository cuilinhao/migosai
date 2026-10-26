import type Stripe from "stripe";
import { subscriptionPlans } from "../../content/pricing";
import type { User } from "../contracts";
import { isLocale, localizeHref } from "../i18n/routing";
import { appOrigin, database, type Env } from "./env";
import { ApiError } from "./errors";
import { stripeClient, stripeMode, stripeWebhookSecret } from "./stripe";
import { grantSubscriptionInvoice, grantSubscriptionChange } from "./subscription-credits";

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
type PlanTerms = Pick<SubscriptionRow, "plan_id" | "price_id" | "billing_interval" | "amount_cents" | "monthly_credits" | "provider_mode">;
async function termsForPrice(env: Env, row: SubscriptionRow, priceId: string): Promise<PlanTerms> {
  if (priceId === row.price_id) return row;
  const terms = await database(env).prepare("SELECT plan_id,price_id,billing_interval,amount_cents,monthly_credits FROM subscription_plan_prices WHERE subscription_id=? AND price_id=?")
    .bind(row.id, priceId).first<Omit<PlanTerms, "provider_mode">>();
  if (!terms) reject();
  return { ...terms, provider_mode: row.provider_mode };
}
function validateSubscription(sub: Stripe.Subscription, row: SubscriptionRow, terms: PlanTerms = row) {
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
  verifyPrice(item.price, { ...row, ...terms }, false);
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
  terms: PlanTerms;
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
  const terms = await termsForPrice(env, row, sub.items?.data?.[0]?.price?.id ?? "");
  validateSubscription(sub, row, terms);
  return { row, sub, terms, syncVersion: reserved.sync_version };
}
async function bindAndSync(
  env: Env,
  { row, sub, terms, syncVersion }: SubscriptionSync,
) {
  const item = validateSubscription(sub, row, terms);
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
async function verifyInvoicePayment(env: Env, row: SubscriptionRow, invoice: Stripe.Invoice) {
  const amount = invoice.amount_paid, client = stripeClient(env);
  const startingBalance = invoice.starting_balance ?? 0, endingBalance = invoice.ending_balance ?? 0;
  if (![startingBalance, endingBalance].every(value => Number.isSafeInteger(value) && value >= 0)
    || endingBalance >= 50 || invoice.total + startingBalance !== amount + endingBalance) reject();
  // Stripe carries sub-minimum USD charges forward as debt. Require its
  // invoice-linked balance transactions; a credit or out-of-band payment is
  // never treated as cash merely because an invoice says "paid".
  if (startingBalance || endingBalance) {
    let cursor: string | undefined, applied = !startingBalance, deferred = !endingBalance;
    for (let page = 0; page < 10 && (!applied || !deferred); page++) {
      const transactions = await stripeRequest(() => client.customers.listBalanceTransactions(row.customer_id!, { limit: 100, ...(cursor ? { starting_after: cursor } : {}) }));
      for (const transaction of transactions.data) {
        if (idOf(transaction.invoice) !== invoice.id) continue;
        if (transaction.livemode !== (row.provider_mode === "live") || transaction.currency !== "usd" || idOf(transaction.customer) !== row.customer_id) reject();
        if (transaction.type === "applied_to_invoice" && transaction.amount === -startingBalance) applied = true;
        if (transaction.type === "invoice_too_small" && transaction.amount === endingBalance && transaction.ending_balance === endingBalance) deferred = true;
      }
      if (!transactions.has_more) break;
      cursor = transactions.data.at(-1)?.id;
      if (!cursor) reject();
    }
    if (!applied || !deferred) reject();
  }
  const payments = await stripeRequest(() => client.invoicePayments.list({ invoice: invoice.id, status: "paid", limit: 100 }));
  if (payments.has_more) reject();
  if (amount === 0) {
    if (payments.data.length) reject();
    return;
  }
  if (payments.data.length !== 1) reject();
  const payment = payments.data[0];
  if (idOf(payment.invoice) !== invoice.id || payment.livemode !== (row.provider_mode === "live") || payment.status !== "paid"
    || payment.currency !== "usd" || payment.amount_paid !== amount || payment.payment.type !== "payment_intent") reject();
  const intentId = idOf(payment.payment.payment_intent);
  if (!intentId) reject();
  const intent = await stripeRequest(() => client.paymentIntents.retrieve(intentId));
  if (intent.id !== intentId || intent.status !== "succeeded" || intent.livemode !== (row.provider_mode === "live")
    || idOf(intent.customer) !== row.customer_id || intent.currency !== "usd" || intent.amount !== amount || intent.amount_received !== amount) reject();
}
async function paidInvoice(env: Env, event: Stripe.Event) {
  const invoiceId = idOf(event.data.object);
  if (!invoiceId || !/^in_[A-Za-z0-9]+$/.test(invoiceId)) reject();
  const client = stripeClient(env), invoice = await stripeRequest(() => client.invoices.retrieve(invoiceId));
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
  if (!subscriptionId) return;
  const owned = await ownedSubscription(env, subscriptionId);
  if (!owned) return;
  const { row, sub } = owned;
  if (invoice.id !== invoiceId || invoice.livemode !== (row.provider_mode === "live") || idOf(invoice.customer) !== row.customer_id
    || invoice.status !== "paid" || invoice.currency !== "usd" || !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid < 0
    || invoice.amount_due !== invoice.amount_paid || invoice.total !== invoice.subtotal
    || invoice.amount_remaining !== 0 || (invoice.amount_paid_off_stripe ?? 0) !== 0 || invoice.discounts.length
    || (invoice.total_discount_amounts ?? []).some(v => v.amount !== 0)
    || !["subscription_create", "subscription_cycle", "subscription_update"].includes(invoice.billing_reason ?? "")) reject();
  const lines = await stripeRequest(() => client.invoices.listLineItems(invoiceId, { limit: 100 }));
  if (lines.has_more || !lines.data.length || lines.data.length > 2) reject();
  const verified: { line: Stripe.InvoiceLineItem; terms: PlanTerms }[] = [];
  for (const line of lines.data) {
    if (line.livemode !== (row.provider_mode === "live") || line.currency !== "usd" || line.quantity !== 1
      || !Number.isSafeInteger(line.amount) || line.subtotal !== line.amount
      || line.parent?.type !== "subscription_item_details" || line.parent.subscription_item_details?.subscription !== sub.id
      || line.parent.subscription_item_details.subscription_item !== sub.items.data[0].id
      || (line.discount_amounts ?? []).some(v => v.amount !== 0)
      || !Number.isSafeInteger(line.period.start) || !Number.isSafeInteger(line.period.end) || line.period.end <= line.period.start) reject();
    const terms = await termsForPrice(env, row, idOf(line.pricing?.price_details?.price) ?? "");
    if (Math.abs(line.amount) > terms.amount_cents) reject();
    verified.push({ line, terms });
  }
  if (verified.reduce((sum, value) => sum + value.line.amount, 0) !== invoice.total) reject();
  await verifyInvoicePayment(env, row, invoice);
  const db = database(env);
  let orderTerms: PlanTerms;
  let orderCredits: number;
  if (invoice.billing_reason === "subscription_update") {
    // Stripe can round a valid unused-time credit to zero. Its credited-items
    // reference, rather than its numeric sign alone, identifies that line.
    const isCredit = (value: typeof verified[number]) => value.line.amount < 0 || (value.line.amount === 0 && !!value.line.parent?.subscription_item_details?.proration_details?.credited_items);
    const charge = verified.find(v => !isCredit(v));
    const credit = verified.find(isCredit);
    if (!charge || (verified.length === 2 && !credit)) reject();
    const { line, terms } = charge;
    const resetPeriod = !line.parent!.subscription_item_details!.proration;
    const previous = credit?.terms ?? row;
    if (previous.price_id === terms.price_id) reject();
    if (credit && (!credit.line.parent!.subscription_item_details!.proration || credit.line.period.start !== line.period.start
      || credit.terms.price_id === terms.price_id)) reject();
    if (!resetPeriod) {
      if (!credit || credit.line.period.end !== line.period.end || previous.billing_interval !== terms.billing_interval
        || previous.monthly_credits > terms.monthly_credits || previous.amount_cents >= terms.amount_cents) reject();
    } else if (line.amount !== terms.amount_cents || (credit && credit.line.period.end > line.period.end)) reject();
    await grantSubscriptionChange(db, {
      subscriptionId: row.id, userId: row.user_id, providerMode: row.provider_mode, invoiceId,
      periodStart: line.period.start, periodEnd: line.period.end, fromPriceId: previous.price_id, toPriceId: terms.price_id,
      fromMonthlyCredits: previous.monthly_credits, toMonthlyCredits: terms.monthly_credits, interval: terms.billing_interval, resetPeriod,
    });
    orderTerms = terms;
    const prefix = `${row.provider_mode}:${invoiceId}:change:`;
    const added = await db.prepare("SELECT COALESCE(SUM(amount),0) AS credits FROM credit_ledger WHERE kind='subscription_grant' AND user_id=? AND substr(reference_id,1,?)=?")
      .bind(row.user_id, prefix.length, prefix).first<{ credits: number }>();
    orderCredits = resetPeriod ? terms.monthly_credits : (added?.credits ?? 0);
  } else {
    if (verified.length !== 1) reject();
    const { line, terms } = verified[0];
    if (line.parent!.subscription_item_details!.proration || line.amount !== terms.amount_cents) reject();
    await grantSubscriptionInvoice(db, {
      subscriptionId: row.id, userId: row.user_id, providerMode: row.provider_mode, invoiceId,
      periodStart: line.period.start, periodEnd: line.period.end, interval: terms.billing_interval,
      monthlyCredits: terms.monthly_credits, priceId: terms.price_id,
      allowanceCredits: terms.price_id === row.price_id ? renewalAllowance(row, sub.metadata, invoice.billing_reason, line.period.start) : undefined,
    });
    orderTerms = terms;
    const granted = await db.prepare("SELECT monthly_credits FROM subscription_invoices WHERE provider_mode=? AND invoice_id=?")
      .bind(row.provider_mode, invoiceId).first<{ monthly_credits: number }>();
    orderCredits = granted?.monthly_credits ?? terms.monthly_credits;
  }
  await bindAndSync(env, owned);
  await db.batch([
    db.prepare("UPDATE orders SET status='paid',provider_order_id=? WHERE id=? AND purchase_type='subscription' AND status='pending' AND product_id=? AND ?='subscription_create'")
      .bind(invoiceId, row.id, orderTerms.price_id, invoice.billing_reason),
    db.prepare(`INSERT INTO orders(id,user_id,pack_id,product_id,amount,currency,credits,provider,provider_mode,purchase_type,provider_order_id,status)
      SELECT ?,?,?,?,?, 'USD',?,'stripe',?,'subscription',?,'paid' WHERE NOT EXISTS(SELECT 1 FROM orders WHERE id=? AND provider_order_id=?) ON CONFLICT(id) DO NOTHING`)
      .bind(`${row.id}:${invoiceId}`, row.user_id, orderTerms.plan_id, orderTerms.price_id, invoice.amount_paid, orderCredits, row.provider_mode, invoiceId, row.id, invoiceId),
    db.prepare("INSERT INTO webhook_events(id,event_type,order_id) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING")
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
  let synced: SubscriptionSync | null = null;
  if (row.subscription_id) {
    synced = await readForSync(env, row, row.subscription_id);
    await bindAndSync(env, synced);
  } else if (row.status === "pending" && row.checkout_id) {
    const session = await stripeRequest(() =>
      stripeClient(env).checkout.sessions.retrieve(row.checkout_id!),
    );
    validateSession(session, row);
    if (session.status === "complete") {
      const id = idOf(session.subscription);
      if (id) { synced = await readForSync(env, row, id); await bindAndSync(env, synced); }
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
  return { row: current, synced, checkoutUrl: current.status === "pending" && !current.subscription_id ? checkoutUrl : null };
}
const cancellableStates = ["active", "trialing", "past_due"];
function canCancelRenewal(row: SubscriptionRow) {
  return !!row.subscription_id && !row.cancel_at_period_end && cancellableStates.includes(row.status);
}
export async function subscriptionStatus(env: Env, userId: string) {
  const latest = await latestSubscription(env, userId);
  if (!latest) return { subscription: null };
  const { row, checkoutUrl, synced } = await refreshSubscription(env, latest);
  const latestInvoice = idOf(synced?.sub.latest_invoice);
  const creditsPending = !!latestInvoice && !(await database(env).prepare(
    "SELECT 1 AS granted FROM subscription_invoices WHERE subscription_id=? AND provider_mode=? AND invoice_id=? UNION ALL SELECT 1 AS granted FROM subscription_change_invoices WHERE subscription_id=? AND provider_mode=? AND invoice_id=? LIMIT 1",
  ).bind(row.id, row.provider_mode, latestInvoice, row.id, row.provider_mode, latestInvoice).first());
  return {
    subscription: {
      id: row.id,
      planId: synced?.terms.plan_id ?? row.plan_id,
      billingInterval: synced?.terms.billing_interval ?? row.billing_interval,
      status: row.status,
      canManage: !!row.subscription_id && !!row.customer_id,
      canCancel: !!checkoutUrl || canCancelRenewal(row),
      canChange: !!env.STRIPE_SUBSCRIPTION_CHANGE_CONFIGURATION && !!synced && canChangePlan(row, synced.sub),
      creditsPending,
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
function canChangePlan(row: SubscriptionRow, sub: Stripe.Subscription) {
  return !!row.subscription_id && !!row.customer_id && !row.cancel_at_period_end
    && row.status === "active" && !sub.pending_update && !sub.schedule
    && sub.metadata.renewalCredits === undefined && sub.metadata.renewalCreditsEffectiveAt === undefined;
}
/** A confirmation URL only: Stripe performs the change after the customer confirms. */
export async function createSubscriptionChange(env: Env, userId: string, subscriptionId: string, planId: unknown, interval: unknown, locale?: unknown) {
  const plan = subscriptionPlans.find(plan => plan.id === planId);
  if (!plan || (interval !== "month" && interval !== "year")) throw new ApiError(400, "Unknown subscription plan.");
  const latest = await latestSubscription(env, userId);
  if (!latest || latest.id !== subscriptionId) throw new ApiError(409, "The subscription has changed. Refresh and try again.");
  const { row, synced } = await refreshSubscription(env, latest);
  if (!synced || !canChangePlan(row, synced.sub)) throw new ApiError(409, "Manage your existing payment or scheduled change before changing plans.");
  if (synced.terms.plan_id === plan.id && synced.terms.billing_interval === interval) throw new ApiError(409, "This is already your current plan.");
  const key = `STRIPE_PRICE_${interval === "month" ? "MONTHLY" : "YEARLY"}_${plan.id.replaceAll("-", "_").toUpperCase()}`;
  const priceId = env[key as keyof Env];
  if (typeof priceId !== "string" || !/^price_[A-Za-z0-9]+$/.test(priceId)) throw new ApiError(503, "This subscription plan is not configured.");
  const client = stripeClient(env);
  const target: PlanTerms = { plan_id: plan.id, billing_interval: interval, price_id: priceId, amount_cents: interval === "month" ? plan.monthlyPriceCents : plan.yearlyPriceCents, monthly_credits: plan.credits, provider_mode: row.provider_mode };
  // Legacy plans with more credits at a lower price cannot use immediate credit reductions.
  if (interval === synced.terms.billing_interval && target.amount_cents >= synced.terms.amount_cents && target.monthly_credits < synced.terms.monthly_credits)
    throw new ApiError(409, "This legacy plan change requires support.");
  const targetPrice = await stripeRequest(() => client.prices.retrieve(priceId));
  verifyPrice(targetPrice, { ...row, ...target });
  const configId = env.STRIPE_SUBSCRIPTION_CHANGE_CONFIGURATION;
  if (!configId || !/^bpc_[A-Za-z0-9]+$/.test(configId)) throw new ApiError(503, "Subscription changes are not configured.");
  const config = await stripeRequest(() => client.billingPortal.configurations.retrieve(configId, { expand: ["features.subscription_update.products"] }));
  const update = config.features.subscription_update;
  const conditions = update.schedule_at_period_end?.conditions?.map(condition => condition.type) ?? [];
  if (config.id !== configId || !config.active || config.livemode !== (row.provider_mode === "live") || !update.enabled
    || update.default_allowed_updates.length !== 1 || update.default_allowed_updates[0] !== "price"
    || update.proration_behavior !== "always_invoice" || update.billing_cycle_anchor !== "unchanged"
    || conditions.length !== 2 || !conditions.includes("decreasing_item_amount") || !conditions.includes("shortening_interval")
    || !update.products?.some(product => product.product === idOf(targetPrice.product) && product.prices.includes(priceId) && !product.adjustable_quantity?.enabled))
    throw new ApiError(503, "Subscription change configuration is not supported.");
  await database(env).prepare("INSERT INTO subscription_plan_prices(subscription_id,price_id,plan_id,billing_interval,amount_cents,monthly_credits) VALUES(?,?,?,?,?,?) ON CONFLICT(subscription_id,price_id) DO NOTHING")
    .bind(row.id, priceId, target.plan_id, target.billing_interval, target.amount_cents, target.monthly_credits).run();
  const saved = await termsForPrice(env, row, priceId);
  if (saved.plan_id !== target.plan_id || saved.billing_interval !== target.billing_interval || saved.amount_cents !== target.amount_cents || saved.monthly_credits !== target.monthly_credits) reject();
  const returnUrl = paymentOrigin(env) + localizeHref("/pricing", typeof locale === "string" && isLocale(locale) ? locale : "en") + "?subscription=updated";
  const session = await stripeRequest(() => client.billingPortal.sessions.create({
    customer: row.customer_id!, configuration: configId, return_url: returnUrl,
    flow_data: { type: "subscription_update_confirm", subscription_update_confirm: { subscription: row.subscription_id!, items: [{ id: synced.sub.items.data[0].id, price: priceId, quantity: 1 }] }, after_completion: { type: "redirect", redirect: { return_url: returnUrl } } },
  }));
  if (session.customer !== row.customer_id || session.livemode !== (row.provider_mode === "live") || idOf(session.configuration) !== configId) reject();
  return { url: hostedUrl(session.url, "billing.stripe.com") };
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
