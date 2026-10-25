import { afterEach, describe, expect, it, vi } from "vitest";
import { database, jobEnv } from "./helpers";
import {
  createSubscriptionCheckout,
  applySubscriptionEvent,
  subscriptionStatus,
  createSubscriptionPortal,
} from "../lib/server/subscriptions";
import type { Env } from "../lib/server/env";
const user = { id: "u", email: "a@b.c", name: "Test" };
const priceId = "price_monthlyLite";
const customerId = "cus_subscription123";
const subId = "sub_subscription123";
const sessionId = "cs_test_subscription123";
const invoiceId = "in_subscription123";
const start = Math.floor(Date.now() / 1000) - 60;
const end = start + 31 * 86400;
const baseEnv = (db: D1Database) =>
  ({
    ...jobEnv(db),
    PAYMENT_PROVIDER: "stripe",
    STRIPE_MODE: "test",
    STRIPE_SECRET_KEY: "sk_test_fixtureOnly123",
    STRIPE_WEBHOOK_SECRET: "whsec_fixtureOnly123",
    STRIPE_PRICE_MONTHLY_LITE: priceId,
    STRIPE_PORTAL_CONFIGURATION: "bpc_fixture123",
  }) as Env;
const price = {
  id: priceId,
  object: "price",
  active: true,
  type: "recurring",
  currency: "usd",
  unit_amount: 1490,
  livemode: false,
  recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
};
let metadata: Record<string, string> = {};
function subscription(overrides = {}) {
  return {
    id: subId,
    object: "subscription",
    customer: customerId,
    livemode: false,
    status: "active",
    metadata,
    discounts: [],
    cancel_at_period_end: false,
    items: {
      data: [
        {
          id: "si_fixture123",
          quantity: 1,
          price,
          current_period_start: start,
          current_period_end: end,
        },
      ],
      has_more: false,
    },
    ...overrides,
  };
}
function invoice(overrides = {}) {
  return {
    id: invoiceId,
    object: "invoice",
    livemode: false,
    customer: customerId,
    status: "paid",
    currency: "usd",
    amount_due: 1490,
    amount_paid: 1490,
    amount_remaining: 0,
    amount_paid_off_stripe: 0,
    total: 1490,
    subtotal: 1490,
    discounts: [],
    total_discount_amounts: [],
    billing_reason: "subscription_create",
    parent: {
      type: "subscription_details",
      subscription_details: { subscription: subId, metadata },
    },
    ...overrides,
  };
}
function line(overrides = {}) {
  return {
    id: "il_fixture123",
    object: "line_item",
    livemode: false,
    amount: 1490,
    subtotal: 1490,
    currency: "usd",
    quantity: 1,
    discount_amounts: [],
    period: { start, end },
    pricing: { type: "price_details", price_details: { price: priceId } },
    parent: {
      type: "subscription_item_details",
      subscription_item_details: {
        subscription: subId,
        subscription_item: "si_fixture123",
        proration: false,
      },
    },
    ...overrides,
  };
}
function stripeApi(
  options: {
    invoice?: Record<string, unknown>;
    sub?: Record<string, unknown>;
    line?: Record<string, unknown>;
    payment?: Record<string, unknown>;
    intent?: Record<string, unknown>;
    session?: Record<string, unknown>;
    expireSession?: Record<string, unknown>;
    createSession?: Record<string, unknown>;
    config?: Record<string, unknown>;
    portal?: Record<string, unknown>;
    price?: Record<string, unknown>;
    failCreateOnce?: boolean;
    failExpire?: boolean;
    beforeExpireResponse?: () => void;
  } = {},
) {
  let sent = new URLSearchParams();
  const checkoutRequests: string[] = [];
  const expireRequests: { id: string; idempotencyKey: string | null }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== "https://api.stripe.com" || init?.redirect !== "manual")
      throw Error("Unexpected destination");
    const body = new URLSearchParams(String(init?.body ?? ""));
    if (
      url.pathname === `/v1/prices/${priceId}` ||
      url.pathname === `/v1/prices/${options.price?.id}`
    )
      return Response.json({ ...price, ...options.price });
    if (url.pathname === "/v1/customers")
      return Response.json({
        id: customerId,
        object: "customer",
        livemode: false,
        metadata: { app: "migosai", userId: "u", mode: "test" },
      });
    if (url.pathname === `/v1/customers/${customerId}`)
      return Response.json({
        id: customerId,
        object: "customer",
        livemode: false,
        metadata: { app: "migosai", userId: "u", mode: "test" },
      });
    if (url.pathname === "/v1/checkout/sessions" && init?.method === "POST") {
      sent = body;
      checkoutRequests.push(body.toString());
      if (options.failCreateOnce && checkoutRequests.length === 1)
        throw Error("Checkout response lost");
      metadata = Object.fromEntries(
        [...body]
          .filter(([k]) => k.startsWith("subscription_data[metadata]["))
          .map(([k, v]) => [k.slice(28, -1), v]),
      );
      return Response.json({
        id: sessionId,
        object: "checkout.session",
        url: `https://checkout.stripe.com/c/pay/${sessionId}`,
        mode: "subscription",
        amount_total: options.price?.unit_amount ?? price.unit_amount,
        currency: "usd",
        total_details: { amount_discount: 0, amount_tax: 0 },
        livemode: false,
        status: "open",
        expires_at: Math.floor(Date.now() / 1000) + 1800,
        customer: customerId,
        subscription: null,
        client_reference_id: body.get("client_reference_id"),
        metadata: Object.fromEntries(
          [...body]
            .filter(([k]) => k.startsWith("metadata["))
            .map(([k, v]) => [k.slice(9, -1), v]),
        ),
        ...options.createSession,
      });
    }
    const existingSession = {
        id: sessionId,
        url: `https://checkout.stripe.com/c/pay/${sessionId}`,
        mode: "subscription",
        amount_total: options.price?.unit_amount ?? price.unit_amount,
        currency: "usd",
        total_details: { amount_discount: 0, amount_tax: 0 },
        livemode: false,
        status: "open",
        payment_status: "unpaid",
        subscription: null,
        customer: customerId,
        client_reference_id: metadata.orderId,
        metadata,
        expires_at: Math.floor(Date.now() / 1000) + 1800,
        ...options.session,
      };
    if (url.pathname === `/v1/checkout/sessions/${sessionId}`)
      return Response.json(existingSession);
    if (url.pathname === `/v1/checkout/sessions/${sessionId}/expire` && init?.method === "POST") {
      expireRequests.push({
        id: sessionId,
        idempotencyKey: new Headers(init.headers).get("idempotency-key"),
      });
      if (options.failExpire) throw Error("Stripe expiration unavailable");
      options.beforeExpireResponse?.();
      return Response.json({ ...existingSession, status: "expired", url: null, subscription: null, ...options.expireSession });
    }
    if (url.pathname === `/v1/subscriptions/${subId}`)
      return Response.json(subscription(options.sub));
    if (url.pathname === `/v1/invoices/${invoiceId}`)
      return Response.json(invoice(options.invoice));
    if (url.pathname === `/v1/invoices/${invoiceId}/lines`)
      return Response.json({
        object: "list",
        data: [line(options.line)],
        has_more: false,
      });
    if (url.pathname === "/v1/invoice_payments")
      return Response.json({
        object: "list",
        data: [
          {
            id: "inpay_fixture123",
            invoice: invoiceId,
            livemode: false,
            status: "paid",
            currency: "usd",
            amount_paid: 1490,
            payment: {
              type: "payment_intent",
              payment_intent: "pi_subscription123",
            },
            ...options.payment,
          },
        ],
        has_more: false,
      });
    if (url.pathname === "/v1/payment_intents/pi_subscription123")
      return Response.json({
        id: "pi_subscription123",
        object: "payment_intent",
        status: "succeeded",
        livemode: false,
        customer: customerId,
        amount: 1490,
        amount_received: 1490,
        currency: "usd",
        ...options.intent,
      });
    if (url.pathname === "/v1/billing_portal/configurations/bpc_fixture123")
      return Response.json({
        id: "bpc_fixture123",
        active: true,
        livemode: false,
        features: {
          subscription_update: { enabled: false },
          subscription_cancel: {
            enabled: true,
            mode: "at_period_end",
            proration_behavior: "none",
          },
        },
        ...options.config,
      });
    if (url.pathname === "/v1/billing_portal/sessions")
      return Response.json({
        id: "bps_fixture123",
        customer: customerId,
        livemode: false,
        configuration: "bpc_fixture123",
        url: "https://billing.stripe.com/p/session/fixture",
        ...options.portal,
      });
    throw Error(`Unexpected Stripe path ${url.pathname}`);
  });
  return { sent: () => sent, checkoutRequests, expireRequests };
}
afterEach(() => {
  vi.restoreAllMocks();
  metadata = {};
});
const event = (
  type = "invoice.paid",
  object: unknown = { id: invoiceId, object: "invoice" },
) =>
  ({
    id: "evt_subscription123",
    object: "event",
    livemode: false,
    type,
    data: { object },
  }) as any;
async function setup(options: Parameters<typeof stripeApi>[0] = {}) {
  const { db, sqlite } = database();
  const api = stripeApi(options);
  const env = baseEnv(db);
  env.STRIPE_PRICE_YEARLY_LITE = priceId;
  const checkout = await createSubscriptionCheckout(
    env,
    user,
    "lite",
    options.price ? "year" : "month",
    "en",
  );
  return { db, sqlite, api, env, checkout };
}

describe("guest subscription boundary", () => {
  it("requires a registered account before accessing Stripe or storing a recurring order", async () => {
    const { db, sqlite } = database();
    const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected Stripe request"));
    const guest = { id: "u", email: "guest-id@guest.invalid", name: "Guest", isGuest: true };
    await expect(createSubscriptionCheckout(baseEnv(db), guest, "lite", "month")).rejects.toMatchObject({ status: 401, message: "Please sign in to subscribe." });
    expect(fetcher).not.toHaveBeenCalled();
    expect(sqlite.prepare("SELECT count(*) AS n FROM subscriptions").get()).toEqual({ n: 0 });
    expect(sqlite.prepare("SELECT count(*) AS n FROM orders").get()).toEqual({ n: 0 });
  });
});

describe("Stripe subscriptions", () => {
  it.each([
    { amount: 759, credits: 550, storedPrice: priceId },
    { amount: 1490, credits: 750, storedPrice: priceId },
    { amount: 1490, credits: 550, storedPrice: "price_earlierLite" },
  ])("closes an unpaid same-plan checkout whose stored quote changed: %j", async ({ amount, credits, storedPrice }) => {
    const { env, sqlite, checkout } = await setup();
    sqlite.prepare("UPDATE subscriptions SET amount_cents=?,monthly_credits=?,price_id=? WHERE id=?").run(amount, credits, storedPrice, checkout.orderId);
    sqlite.prepare("UPDATE orders SET amount=?,credits=?,product_id=? WHERE id=?").run(amount, credits, storedPrice, checkout.orderId);
    metadata = { ...metadata, amount: String(amount), credits: String(credits), priceId: storedPrice };
    const api = stripeApi({ session: { amount_total: amount }, createSession: { id: "cs_test_repriced123", url: "https://checkout.stripe.com/c/pay/cs_test_repriced123" } });
    const replacement = await createSubscriptionCheckout(env, user, "lite", "month", "en");
    expect(replacement.orderId).not.toBe(checkout.orderId);
    expect(api.expireRequests).toHaveLength(1);
    expect(sqlite.prepare("SELECT status FROM subscriptions WHERE id=?").get(checkout.orderId)).toEqual({ status: "expired" });
    expect(sqlite.prepare("SELECT status FROM orders WHERE id=?").get(checkout.orderId)).toEqual({ status: "cancelled" });
    expect(sqlite.prepare("SELECT amount,credits,status FROM orders WHERE id=?").get(replacement.orderId)).toEqual({ amount: 1490, credits: 550, status: "pending" });
  });

  it("does not recover an older unbound checkout with a changed quote", async () => {
    const { db, sqlite } = database();
    const env = baseEnv(db);
    stripeApi({ failCreateOnce: true });
    await expect(createSubscriptionCheckout(env, user, "lite", "month", "en")).rejects.toMatchObject({ status: 502 });
    sqlite.prepare("UPDATE subscriptions SET amount_cents=759,monthly_credits=750").run();
    sqlite.prepare("UPDATE orders SET amount=759,credits=750").run();
    const api = stripeApi({ createSession: { amount_total: 759 } });
    await expect(createSubscriptionCheckout(env, user, "lite", "month", "en")).rejects.toMatchObject({ status: 409 });
    expect(api.checkoutRequests).toHaveLength(0);
    expect(sqlite.prepare("SELECT amount,credits,status,checkout_id FROM orders").get()).toEqual({ amount: 759, credits: 750, status: "pending", checkout_id: null });
  });

  it.each([
    ["lite", "month", 759, 750],
    ["lite", "year", 7308, 750],
    ["elite-15000", "month", 11999, 15000],
    ["elite-60000", "year", 323988, 60000],
  ] as const)("renews historical %s/%s from its stored price and credits after the catalogue changes", async (planId, interval, amount, credits) => {
    const { db, sqlite } = database();
    const env = baseEnv(db);
    // The current checkout configuration intentionally points elsewhere; neither
    // fulfillment nor a retired Elite subscription needs its old env variable.
    env.STRIPE_PRICE_MONTHLY_LITE = "price_newMonthlyLite";
    env.STRIPE_PRICE_YEARLY_LITE = "price_newYearlyLite";
    const historicalPriceId = "price_historical123";
    const periodEnd = interval === "year"
      ? Math.floor(new Date(new Date(start * 1000).setUTCFullYear(new Date(start * 1000).getUTCFullYear() + 1)).getTime() / 1000)
      : end;
    metadata = { app: "migosai", orderId: "historical-subscription", userId: "u", planId, billingInterval: interval,
      priceId: historicalPriceId, amount: String(amount), credits: String(credits), mode: "test" };
    sqlite.prepare("INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits,customer_id,subscription_id,status) VALUES('historical-subscription','u','test',?,?,?,?,?,?,?,'active')")
      .run(planId, interval, historicalPriceId, amount, credits, customerId, subId);
    sqlite.prepare("INSERT INTO orders(id,user_id,pack_id,product_id,amount,currency,credits,provider,provider_mode,purchase_type,provider_order_id,status) VALUES('historical-subscription','u',?,?,?,'USD',?,'stripe','test','subscription','in_original123','paid')")
      .run(planId, historicalPriceId, amount, credits);
    stripeApi({
      sub: { items: { has_more: false, data: [{ id: "si_fixture123", quantity: 1,
        price: { ...price, id: historicalPriceId, unit_amount: amount, active: false, recurring: { interval, interval_count: 1, usage_type: "licensed" } },
        current_period_start: start, current_period_end: periodEnd }] } },
      invoice: { amount_due: amount, amount_paid: amount, total: amount, subtotal: amount, billing_reason: "subscription_cycle" },
      line: { amount, subtotal: amount, period: { start, end: periodEnd }, pricing: { type: "price_details", price_details: { price: historicalPriceId } } },
      payment: { amount_paid: amount },
      intent: { amount, amount_received: amount },
    });
    await applySubscriptionEvent(env, event());
    await applySubscriptionEvent(env, event());
    const months = interval === "year" ? 12 : 1;
    expect(sqlite.prepare("SELECT count(*) AS n,min(granted) AS smallest,max(granted) AS largest,sum(granted) AS total FROM subscription_credit_periods").get())
      .toEqual({ n: months, smallest: credits, largest: credits, total: months * credits });
    expect(sqlite.prepare("SELECT amount,credits,status,product_id FROM orders WHERE provider_order_id=?").get(invoiceId))
      .toEqual({ amount, credits, status: "paid", product_id: historicalPriceId });
    expect(sqlite.prepare("SELECT count(*) AS n FROM subscription_invoices").get()).toEqual({ n: 1 });
    expect(sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()).toEqual({ credits: 100 });
  });

  it.each([
    ["lite", "month", 759], ["lite", "year", 7308],
    ["standard", "month", 2499], ["standard", "year", 23988],
    ["pro", "month", 4999], ["pro", "year", 44988],
    ["elite-4000", "month", 11999], ["elite-4000", "year", 107988],
  ] as const)("rejects an obsolete Stripe price configured for a new %s/%s checkout", async (planId, interval, amount) => {
    const { db, sqlite } = database();
    const env = baseEnv(db);
    Object.assign(env, { [`STRIPE_PRICE_${interval === "month" ? "MONTHLY" : "YEARLY"}_${planId.replaceAll("-", "_").toUpperCase()}`]: priceId });
    stripeApi({ price: { unit_amount: amount, recurring: { interval, interval_count: 1, usage_type: "licensed" } }, createSession: { amount_total: amount } });
    await expect(createSubscriptionCheckout(env, user, planId, interval, "en")).rejects.toMatchObject({ status: 400 });
    expect(sqlite.prepare("SELECT count(*) AS n FROM orders").get()).toEqual({ n: 0 });
    expect(sqlite.prepare("SELECT count(*) AS n FROM subscriptions").get()).toEqual({ n: 0 });
  });

  it.each([
    ["lite", "month", 1490, 550],
    ["lite", "year", 16092, 550],
    ["standard", "month", 2990, 1150],
    ["standard", "year", 32292, 1150],
    ["pro", "month", 4990, 1950],
    ["pro", "year", 53892, 1950],
    ["elite-4000", "month", 9990, 4000],
    ["elite-4000", "year", 107892, 4000],
  ] as const)("freezes the approved %s/%s price and monthly allowance in a new checkout", async (planId, interval, amount, credits) => {
    const { db, sqlite } = database();
    const env = baseEnv(db);
    const configuredPrice = `price_${planId.replaceAll("-", "")}${interval}`;
    Object.assign(env, { [`STRIPE_PRICE_${interval === "month" ? "MONTHLY" : "YEARLY"}_${planId.replaceAll("-", "_").toUpperCase()}`]: configuredPrice });
    const api = stripeApi({
      price: { id: configuredPrice, unit_amount: amount, recurring: { interval, interval_count: 1, usage_type: "licensed" } },
      createSession: { amount_total: amount },
    });
    const checkout = await createSubscriptionCheckout(env, user, planId, interval, "en");
    expect(sqlite.prepare("SELECT plan_id,billing_interval,price_id,amount_cents,monthly_credits FROM subscriptions WHERE id=?").get(checkout.orderId))
      .toEqual({ plan_id: planId, billing_interval: interval, price_id: configuredPrice, amount_cents: amount, monthly_credits: credits });
    expect(sqlite.prepare("SELECT purchase_type,amount,credits,status FROM orders WHERE id=?").get(checkout.orderId))
      .toEqual({ purchase_type: "subscription", amount, credits, status: "pending" });
    expect(api.sent().get("line_items[0][price]")).toBe(configuredPrice);
    expect(metadata).toMatchObject({ planId, billingInterval: interval, amount: String(amount), credits: String(credits) });
    expect(sqlite.prepare("SELECT count(*) AS n FROM subscription_credit_periods").get()).toEqual({ n: 0 });
  });

  it.each([
    ["elite-15000", 11999], ["elite-25000", 17999], ["elite-40000", 25999], ["elite-60000", 35999],
  ])("does not offer the retired %s plan to new buyers", async (planId, amount) => {
    const { db, sqlite } = database();
    const env = baseEnv(db);
    Object.assign(env, { [`STRIPE_PRICE_MONTHLY_${String(planId).replaceAll("-", "_").toUpperCase()}`]: priceId });
    stripeApi({ price: { unit_amount: amount }, createSession: { amount_total: amount } });
    await expect(createSubscriptionCheckout(env, user, planId, "month", "en"))
      .rejects.toMatchObject({ status: 400, message: "Unknown subscription plan." });
    expect(sqlite.prepare("SELECT count(*) AS n FROM orders").get()).toEqual({ n: 0 });
  });

  it.each([
    "customer.subscription.updated",
    "checkout.session.completed",
    "invoice.paid",
    "refund.failed",
  ])(
    "does not overwrite a newer cancellation with an earlier delayed Stripe read from %s",
    async (type) => {
      const { env, sqlite, checkout } = await setup({
        session: { status: "complete", subscription: subId },
      });
      await applySubscriptionEvent(
        env,
        event("customer.subscription.created", { id: subId }),
      );
      const originalFetch = vi.mocked(globalThis.fetch).getMockImplementation()!;
      let release!: (response: Response) => void;
      let started!: () => void;
      let reads = 0;
      const firstStarted = new Promise<void>((resolve) => {
        started = resolve;
      });
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        if (new URL(String(input)).pathname === `/v1/subscriptions/${subId}`) {
          reads++;
          if (reads === 1) {
            started();
            return new Promise<Response>((resolve) => {
              release = resolve;
            });
          }
          return Response.json(subscription({ cancel_at_period_end: true }));
        }
        return originalFetch(input, init);
      });
      const object =
        type === "invoice.paid"
          ? { id: invoiceId }
          : type === "checkout.session.completed"
            ? { id: sessionId, mode: "subscription" }
            : type === "refund.failed"
              ? { id: "re_subscription123", payment_intent: "pi_subscription123" }
              : { id: subId };
      const delayed = applySubscriptionEvent(env, event(type, object));
      await firstStarted;
      await applySubscriptionEvent(env, {
        ...event("customer.subscription.updated", { id: subId }),
        id: "evt_newer123",
      });
      release(Response.json(subscription({ cancel_at_period_end: false })));
      await delayed;
      expect(await subscriptionStatus(env, "u")).toMatchObject({
        subscription: { cancelAtPeriodEnd: true },
      });
      if (type === "invoice.paid") {
        await applySubscriptionEvent(env, event(type, object));
        expect(
          sqlite
            .prepare("SELECT count(*) AS n FROM subscription_invoices")
            .get(),
        ).toEqual({ n: 1 });
        expect(
          sqlite
            .prepare("SELECT sum(remaining) AS credits FROM subscription_credit_periods")
            .get(),
        ).toEqual({ credits: 550 });
        expect(
          sqlite.prepare("SELECT status FROM orders WHERE id=?").get(checkout.orderId),
        ).toEqual({ status: "paid" });
      }
    },
  );

  it("refreshes an unbound subscription after reserving its local sync version", async () => {
    const { env } = await setup();
    const originalFetch = vi.mocked(globalThis.fetch).getMockImplementation()!;
    let reads = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (new URL(String(input)).pathname === `/v1/subscriptions/${subId}`) {
        reads++;
        return Response.json(
          subscription({ cancel_at_period_end: reads > 1 }),
        );
      }
      return originalFetch(input, init);
    });
    await applySubscriptionEvent(
      env,
      event("customer.subscription.updated", { id: subId }),
    );
    expect(await subscriptionStatus(env, "u")).toMatchObject({
      subscription: { cancelAtPeriodEnd: true },
    });
  });

  it("allows a webhook retry to sync after its earlier Stripe read failed", async () => {
    const { env } = await setup();
    await applySubscriptionEvent(
      env,
      event("customer.subscription.created", { id: subId }),
    );
    stripeApi({ sub: { cancel_at_period_end: true } });
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("Stripe unavailable"));
    const update = event("customer.subscription.updated", { id: subId });
    await expect(applySubscriptionEvent(env, update)).rejects.toMatchObject({
      status: 502,
    });
    expect(await subscriptionStatus(env, "u")).toMatchObject({
      subscription: { cancelAtPeriodEnd: false },
    });
    await applySubscriptionEvent(env, update);
    expect(await subscriptionStatus(env, "u")).toMatchObject({
      subscription: { cancelAtPeriodEnd: true },
    });
  });

  it.each([
    { amount_total: 1 },
    { currency: "gbp" },
    { total_details: { amount_discount: 1, amount_tax: 0 } },
  ])(
    "rejects a Checkout response with changed totals %j",
    async (createSession) => {
      const { db, sqlite } = database();
      stripeApi({ createSession });
      await expect(
        createSubscriptionCheckout(baseEnv(db), user, "lite", "month", "en"),
      ).rejects.toMatchObject({ status: 400 });
      expect(
        sqlite.prepare("SELECT checkout_id,status FROM orders").get(),
      ).toEqual({ checkout_id: null, status: "pending" });
    },
  );

  it("recovers a lost Checkout response with identical parameters after locale changes", async () => {
    const { db, sqlite } = database();
    const env = baseEnv(db);
    const api = stripeApi({ failCreateOnce: true });
    await expect(
      createSubscriptionCheckout(env, user, "lite", "month", "en"),
    ).rejects.toMatchObject({ status: 502 });
    await createSubscriptionCheckout(env, user, "lite", "month", "ja");
    expect(api.checkoutRequests).toHaveLength(2);
    expect(api.checkoutRequests[1]).toBe(api.checkoutRequests[0]);
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM subscriptions").get(),
    ).toEqual({ n: 1 });
  });

  it("creates recurring checkout and a recoverable pending first order without granting credits", async () => {
    const { sqlite, api, checkout, env } = await setup();
    expect(api.sent().get("mode")).toBe("subscription");
    expect(api.sent().get("currency")).toBe("usd");
    expect(api.sent().get("adaptive_pricing[enabled]")).toBe("false");
    expect(api.sent().get("line_items[0][price]")).toBe(priceId);
    expect(api.sent().get("line_items[0][quantity]")).toBe("1");
    expect(metadata).toMatchObject({
      app: "migosai",
      userId: "u",
      orderId: checkout.orderId,
      planId: "lite",
      billingInterval: "month",
      mode: "test",
    });
    expect(
      sqlite
        .prepare("SELECT status,purchase_type,amount,credits FROM orders")
        .get(),
    ).toEqual({
      status: "pending",
      purchase_type: "subscription",
      amount: 1490,
      credits: 550,
    });
    expect(
      await createSubscriptionCheckout(env, user, "lite", "month", "en"),
    ).toEqual(checkout);
    expect(api.expireRequests).toHaveLength(0);
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM subscriptions").get(),
    ).toEqual({ n: 1 });
  });
  it("claims an invoice delivered before checkout completion and grants only once", async () => {
    const { db, sqlite, env, checkout } = await setup();
    await applySubscriptionEvent(env, event());
    await applySubscriptionEvent(env, event());
    expect(
      sqlite
        .prepare("SELECT status,provider_order_id FROM orders WHERE id=?")
        .get(checkout.orderId),
    ).toEqual({ status: "paid", provider_order_id: invoiceId });
    expect(sqlite.prepare("SELECT credits FROM users").get()).toEqual({
      credits: 100,
    });
    expect(await subscriptionStatus(env, "u")).toMatchObject({
      subscription: {
        planId: "lite",
        billingInterval: "month",
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(start * 1000).toISOString(),
        currentPeriodEnd: new Date(end * 1000).toISOString(),
      },
    });
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM subscription_invoices").get(),
    ).toEqual({ n: 1 });
  });
  it.each([
    { invoice: { amount_paid_off_stripe: 1490 } },
    { invoice: { livemode: true } },
    { invoice: { customer: "cus_foreign" } },
    { invoice: { amount_paid: 0 } },
    { invoice: { billing_reason: "subscription_update" } },
    { line: { quantity: 2 } },
    { line: { period: { start: end, end: start } } },
    { line: { discount_amounts: [{ amount: 1 }] } },
    { sub: { metadata: { app: "migosai", userId: "another" } } },
    { sub: { livemode: true } },
    { intent: { status: "processing" } },
    { intent: { customer: "cus_foreign" } },
    { payment: { amount_paid: 1 } },
  ])("rejects invalid paid invoice evidence %j", async (options) => {
    const { env, sqlite } = await setup(options);
    await expect(applySubscriptionEvent(env, event())).rejects.toMatchObject({
      status: 400,
    });
    expect(sqlite.prepare("SELECT status FROM orders").get()).toEqual({
      status: "pending",
    });
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM subscription_invoices").get(),
    ).toEqual({ n: 0 });
  });
  it("keeps failed invoice uncredited and applies cancellation without minting credits", async () => {
    const { env, sqlite } = await setup();
    await applySubscriptionEvent(env, event("invoice.payment_failed"));
    expect(sqlite.prepare("SELECT status FROM orders").get()).toEqual({
      status: "pending",
    });
    stripeApi({ sub: { cancel_at_period_end: true } });
    await applySubscriptionEvent(
      env,
      event("customer.subscription.updated", {
        id: subId,
        object: "subscription",
      }),
    );
    expect(await subscriptionStatus(env, "u")).toMatchObject({
      subscription: { status: "active", cancelAtPeriodEnd: true },
    });
  });

  it("recognizes a Portal cancellation scheduled by cancel_at at the current period end", async () => {
    const { env, sqlite } = await setup();
    await applySubscriptionEvent(env, event());
    stripeApi({
      sub: {
        cancel_at_period_end: false,
        cancel_at: end,
        canceled_at: start,
      },
    });
    await applySubscriptionEvent(
      env,
      event("customer.subscription.updated", { id: subId }),
    );
    expect(await subscriptionStatus(env, "u")).toMatchObject({
      subscription: {
        status: "active",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(end * 1000).toISOString(),
      },
    });
    expect(
      sqlite
        .prepare("SELECT remaining,ends_at FROM subscription_credit_periods")
        .get(),
    ).toEqual({ remaining: 550, ends_at: end });
    expect(sqlite.prepare("SELECT credits FROM users").get()).toEqual({
      credits: 100,
    });

    stripeApi({ sub: { cancel_at_period_end: false, cancel_at: null, canceled_at: null } });
    await applySubscriptionEvent(
      env,
      event("customer.subscription.updated", { id: subId }),
    );
    expect(await subscriptionStatus(env, "u")).toMatchObject({
      subscription: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date(end * 1000).toISOString(),
      },
    });
  });

  it("grants twelve expiring monthly buckets after the annual invoice is paid", async () => {
    const annualEnd =
      Date.UTC(
        new Date(start * 1000).getUTCFullYear() + 1,
        new Date(start * 1000).getUTCMonth(),
        new Date(start * 1000).getUTCDate(),
        new Date(start * 1000).getUTCHours(),
        new Date(start * 1000).getUTCMinutes(),
        new Date(start * 1000).getUTCSeconds(),
      ) / 1000;
    const annualPrice = {
      ...price,
      unit_amount: 16092,
      recurring: {
        interval: "year",
        interval_count: 1,
        usage_type: "licensed",
      },
    };
    const { env, sqlite, api } = await setup({
      price: annualPrice,
      sub: {
        items: {
          data: [
            {
              id: "si_fixture123",
              quantity: 1,
              price: annualPrice,
              current_period_start: start,
              current_period_end: annualEnd,
            },
          ],
          has_more: false,
        },
      },
      invoice: {
        amount_due: 16092,
        amount_paid: 16092,
        total: 16092,
        subtotal: 16092,
      },
      line: { amount: 16092, subtotal: 16092, period: { start, end: annualEnd } },
      payment: { amount_paid: 16092 },
      intent: { amount: 16092, amount_received: 16092 },
    });
    expect(api.sent().get("mode")).toBe("subscription");
    await applySubscriptionEvent(env, event());
    await applySubscriptionEvent(env, event());
    expect(
      sqlite
        .prepare(
          "SELECT count(*) AS n,sum(granted) AS total FROM subscription_credit_periods",
        )
        .get(),
    ).toEqual({ n: 12, total: 6600 });
    expect(
      sqlite
        .prepare(
          "SELECT sum(remaining) AS n FROM subscription_credit_periods WHERE starts_at<=unixepoch() AND ends_at>unixepoch()",
        )
        .get(),
    ).toEqual({ n: 550 });
    expect(sqlite.prepare("SELECT credits FROM users").get()).toEqual({
      credits: 100,
    });
  });
  it("expires a confirmed expired checkout and creates a new pending attempt", async () => {
    const { env, sqlite, checkout } = await setup();
    stripeApi({
      session: { status: "expired" },
      createSession: {
        id: "cs_test_retried123",
        url: "https://checkout.stripe.com/c/pay/cs_test_retried123",
      },
    });
    const next = await createSubscriptionCheckout(
      env,
      user,
      "lite",
      "month",
      "en",
    );
    expect(next.orderId).not.toBe(checkout.orderId);
    expect(
      sqlite
        .prepare("SELECT status FROM subscriptions WHERE id=?")
        .get(checkout.orderId),
    ).toEqual({ status: "expired" });
  });

  it.each([
    { plan: "lite", interval: "year", amount: 16092, variable: "STRIPE_PRICE_YEARLY_LITE" },
    { plan: "standard", interval: "month", amount: 2990, variable: "STRIPE_PRICE_MONTHLY_STANDARD" },
  ] as const)("closes an unpaid Checkout before switching to $plan/$interval", async ({ plan, interval, amount, variable }) => {
    const { env, sqlite, checkout } = await setup();
    const nextPrice = "price_switched123";
    env[variable] = nextPrice;
    const api = stripeApi({
      session: { amount_total: 1490 },
      price: { id: nextPrice, unit_amount: amount, recurring: { interval, interval_count: 1, usage_type: "licensed" } },
      createSession: { id: "cs_test_switched123", amount_total: amount, url: "https://checkout.stripe.com/c/pay/cs_test_switched123" },
    });
    const next = await createSubscriptionCheckout(env, user, plan, interval, "en");
    expect(next.orderId).not.toBe(checkout.orderId);
    expect(api.expireRequests).toEqual([{ id: sessionId, idempotencyKey: `migosai:subscription-expire:test:${checkout.orderId}` }]);
    expect(api.checkoutRequests).toHaveLength(1);
    expect(sqlite.prepare("SELECT status FROM subscriptions WHERE id=?").get(checkout.orderId)).toEqual({ status: "expired" });
    expect(sqlite.prepare("SELECT status FROM orders WHERE id=?").get(checkout.orderId)).toEqual({ status: "cancelled" });
    expect(sqlite.prepare("SELECT status,plan_id,billing_interval,amount_cents FROM subscriptions WHERE id=?").get(next.orderId)).toEqual({ status: "pending", plan_id: plan, billing_interval: interval, amount_cents: amount });
    expect(sqlite.prepare("SELECT count(*) AS n FROM subscriptions WHERE status='pending'").get()).toEqual({ n: 1 });
    expect(sqlite.prepare("SELECT count(*) AS n FROM subscription_credit_periods").get()).toEqual({ n: 0 });
    expect(sqlite.prepare("SELECT credits FROM users").get()).toEqual({ credits: 100 });
  });

  it.each([
    { options: { failExpire: true }, status: 502 },
    { options: { expireSession: { status: "complete", subscription: subId } }, status: 409 },
    { options: { expireSession: { status: "open" } }, status: 409 },
    { options: { expireSession: { payment_status: "paid" } }, status: 409 },
    { options: { expireSession: { subscription: subId } }, status: 409 },
    { options: { expireSession: { id: "cs_test_foreign123" } }, status: 400 },
    { options: { expireSession: { livemode: true } }, status: 400 },
    { options: { expireSession: { customer: "cus_foreign123" } }, status: 400 },
  ])("preserves the pending purchase when closing the old Checkout cannot be verified: $options", async ({ options, status }) => {
    const { env, sqlite, checkout } = await setup();
    const api = stripeApi(options);
    await expect(createSubscriptionCheckout(env, user, "lite", "year", "en")).rejects.toMatchObject({ status });
    expect(api.expireRequests).toHaveLength(1);
    expect(api.checkoutRequests).toHaveLength(0);
    expect(sqlite.prepare("SELECT id,status FROM subscriptions").get()).toEqual({ id: checkout.orderId, status: "pending" });
    expect(sqlite.prepare("SELECT id,status FROM orders").get()).toEqual({ id: checkout.orderId, status: "pending" });
  });

  it("does not retire a purchase activated while Stripe expiration was in flight", async () => {
    const { env, sqlite, checkout } = await setup();
    const api = stripeApi({ beforeExpireResponse: () => {
      sqlite.prepare("UPDATE subscriptions SET status='active',subscription_id=? WHERE id=?").run(subId, checkout.orderId);
      sqlite.prepare("UPDATE orders SET status='paid' WHERE id=?").run(checkout.orderId);
    } });
    await expect(createSubscriptionCheckout(env, user, "lite", "year", "en")).rejects.toMatchObject({ status: 409 });
    expect(api.expireRequests).toHaveLength(1);
    expect(api.checkoutRequests).toHaveLength(0);
    expect(sqlite.prepare("SELECT id,status FROM subscriptions").get()).toEqual({ id: checkout.orderId, status: "active" });
    expect(sqlite.prepare("SELECT id,status FROM orders").get()).toEqual({ id: checkout.orderId, status: "paid" });
  });

  it("does not retire a purchase whose paid invoice arrives before the subscription sync", async () => {
    const { env, sqlite, checkout } = await setup();
    const api = stripeApi({ beforeExpireResponse: () => {
      sqlite.prepare("UPDATE orders SET status='paid' WHERE id=?").run(checkout.orderId);
    } });
    await expect(createSubscriptionCheckout(env, user, "lite", "year", "en")).rejects.toMatchObject({ status: 409 });
    expect(api.checkoutRequests).toHaveLength(0);
    expect(sqlite.prepare("SELECT id,status FROM subscriptions").get()).toEqual({ id: checkout.orderId, status: "pending" });
    expect(sqlite.prepare("SELECT id,status FROM orders").get()).toEqual({ id: checkout.orderId, status: "paid" });
  });

  it("keeps a completed Checkout for payment confirmation when the user switches intervals", async () => {
    const { env, sqlite } = await setup();
    const api = stripeApi({ session: { status: "complete", subscription: subId } });
    await expect(createSubscriptionCheckout(env, user, "lite", "year", "en")).rejects.toMatchObject({ status: 409, message: "Your subscription payment is being confirmed." });
    expect(api.expireRequests).toHaveLength(0);
    expect(api.checkoutRequests).toHaveLength(0);
    expect(sqlite.prepare("SELECT count(*) AS n FROM subscriptions").get()).toEqual({ n: 1 });
  });

  it("allows only one replacement when two plan switches race and reuses the winner", async () => {
    const { env, db, sqlite, checkout } = await setup();
    // Real D1 batches are serialized transactions. The SQLite test adapter's
    // async statements need that serialization to avoid nested BEGIN artifacts.
    let batchQueue = Promise.resolve();
    env.DB = { ...db, batch: (statements: D1PreparedStatement[]) => {
      const result = batchQueue.then(() => db.batch(statements));
      batchQueue = result.then(() => {}, () => {});
      return result;
    } } as D1Database;
    const api = stripeApi({
      session: { amount_total: 1490 },
      price: { unit_amount: 16092, recurring: { interval: "year", interval_count: 1, usage_type: "licensed" } },
      createSession: { id: "cs_test_switched123", url: "https://checkout.stripe.com/c/pay/cs_test_switched123" },
    });
    const fetchStripe = vi.mocked(globalThis.fetch).getMockImplementation()!;
    let releaseReads!: () => void;
    const bothReads = new Promise<void>(resolve => { releaseReads = resolve; });
    let reads = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === `/v1/checkout/sessions/${sessionId}`) {
        if (++reads === 2) releaseReads();
        await bothReads;
      }
      if (path === "/v1/checkout/sessions/cs_test_switched123") {
        return Response.json({
          id: "cs_test_switched123", url: "https://checkout.stripe.com/c/pay/cs_test_switched123",
          mode: "subscription", amount_total: 16092, currency: "usd", total_details: { amount_discount: 0, amount_tax: 0 },
          livemode: false, status: "open", customer: customerId, client_reference_id: metadata.orderId, metadata,
        });
      }
      return fetchStripe(input, init);
    });
    const results = await Promise.allSettled([
      createSubscriptionCheckout(env, user, "lite", "year", "en"),
      createSubscriptionCheckout(env, user, "lite", "year", "en"),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect(api.expireRequests).toHaveLength(2);
    expect(api.checkoutRequests).toHaveLength(1);
    expect(sqlite.prepare("SELECT count(*) AS n FROM subscriptions WHERE status='pending'").get()).toEqual({ n: 1 });
    expect(sqlite.prepare("SELECT status FROM orders WHERE id=?").get(checkout.orderId)).toEqual({ status: "cancelled" });
    const winner = results.find(result => result.status === "fulfilled")!;
    expect(await createSubscriptionCheckout(env, user, "lite", "year", "en")).toEqual(winner.value);
    expect(api.expireRequests).toHaveLength(2);
    expect(api.checkoutRequests).toHaveLength(1);
  });
  it("blocks a second checkout after activation and preserves the first purchase", async () => {
    const { env, sqlite } = await setup();
    await applySubscriptionEvent(env, event());
    await expect(
      createSubscriptionCheckout(env, user, "lite", "month", "en"),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM subscriptions").get(),
    ).toEqual({ n: 1 });
  });

  it("records subscription refunds for review without changing either credit balance", async () => {
    const { env, sqlite } = await setup();
    await applySubscriptionEvent(env, event());
    await applySubscriptionEvent(env, {
      ...event("refund.failed", {
        id: "re_subscription123",
        payment_intent: "pi_subscription123",
        amount: 1490,
        currency: "usd",
      }),
      id: "evt_refund123",
    });
    expect(
      sqlite
        .prepare(
          "SELECT review_required,order_id FROM webhook_events WHERE id='stripe:test:evt_refund123'",
        )
        .get(),
    ).toEqual({ review_required: 1, order_id: metadata.orderId });
    expect(
      sqlite.prepare("SELECT remaining FROM subscription_credit_periods").get(),
    ).toEqual({ remaining: 550 });
    expect(sqlite.prepare("SELECT credits FROM users").get()).toEqual({
      credits: 100,
    });
  });
  it("does not grant from Checkout completion before a verified paid invoice", async () => {
    const { env, sqlite } = await setup();
    stripeApi({ session: { status: "complete", subscription: subId } });
    await applySubscriptionEvent(
      env,
      event("checkout.session.completed", {
        id: sessionId,
        mode: "subscription",
        metadata,
      }),
    );
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM subscription_invoices").get(),
    ).toEqual({ n: 0 });
    expect(sqlite.prepare("SELECT status FROM orders").get()).toEqual({
      status: "pending",
    });
  });
  it("rejects forged environment envelopes before retrieving payment evidence", async () => {
    const { env } = await setup();
    await expect(
      applySubscriptionEvent(env, { ...event(), livemode: true }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("fulfills an unchanged existing subscription even if its Price was archived", async () => {
    const { env, sqlite } = await setup();
    stripeApi({
      sub: {
        items: {
          data: [
            {
              id: "si_fixture123",
              quantity: 1,
              price: { ...price, active: false },
              current_period_start: start,
              current_period_end: end,
            },
          ],
          has_more: false,
        },
      },
    });
    await applySubscriptionEvent(env, event());
    expect(sqlite.prepare("SELECT status FROM orders").get()).toEqual({
      status: "paid",
    });
  });
  it.each([
    { customer: "cus_foreign" },
    { livemode: true },
    { configuration: "bpc_foreign" },
  ])("rejects a portal session with mismatched identity %j", async (portal) => {
    const { env } = await setup();
    await applySubscriptionEvent(env, event());
    stripeApi({ portal });
    await expect(createSubscriptionPortal(env, "u")).rejects.toMatchObject({
      status: 400,
    });
  });
  it("offers portal only with cancellation at period end and no plan changes", async () => {
    const { env } = await setup();
    await applySubscriptionEvent(env, event());
    expect(await createSubscriptionPortal(env, "u")).toEqual({
      url: "https://billing.stripe.com/p/session/fixture",
    });
    stripeApi({
      config: {
        features: {
          subscription_update: { enabled: true },
          subscription_cancel: { enabled: true, mode: "at_period_end" },
        },
      },
    });
    await expect(createSubscriptionPortal(env, "u")).rejects.toMatchObject({
      status: 503,
    });
  });
});

describe('scheduled allowance for an existing monthly subscriber', () => {
  const cutoff = 1795473320;
  const periodSeconds = 30 * 86400;
  function legacySetup(policy: Record<string, string> = {}, periodStart = cutoff, billingReason = 'subscription_cycle') {
    const { db, sqlite } = database();
    const env = baseEnv(db);
    const legacyPrice = { ...price, id: 'price_legacy759', unit_amount: 759 };
    metadata = { app: 'migosai', orderId: 'legacy-allowance', userId: 'u', planId: 'lite', billingInterval: 'month', priceId: legacyPrice.id, amount: '759', credits: '750', mode: 'test', ...policy };
    sqlite.prepare("INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits,customer_id,subscription_id,status) VALUES('legacy-allowance','u','test','lite','month',?,759,750,?,?,'active')").run(legacyPrice.id, customerId, subId);
    sqlite.prepare("INSERT INTO orders(id,user_id,pack_id,product_id,amount,currency,credits,provider,provider_mode,purchase_type,provider_order_id,status) VALUES('legacy-allowance','u','lite',?,759,'USD',750,'stripe','test','subscription','in_initialLegacy','paid')").run(legacyPrice.id);
    const apiOptions = {
      sub: { items: { has_more: false, data: [{ id: 'si_fixture123', quantity: 1, price: legacyPrice,
        // Stripe may already be in a later period when an older invoice arrives.
        current_period_start: cutoff + periodSeconds, current_period_end: cutoff + 2 * periodSeconds }] } },
      invoice: { amount_due: 759, amount_paid: 759, total: 759, subtotal: 759, billing_reason: billingReason },
      line: { amount: 759, subtotal: 759, period: { start: periodStart, end: periodStart + periodSeconds }, pricing: { type: 'price_details', price_details: { price: legacyPrice.id } } },
      payment: { amount_paid: 759 }, intent: { amount: 759, amount_received: 759 },
    };
    stripeApi(apiOptions);
    return { env, sqlite, apiOptions };
  }
  const renewalPolicy = { renewalCredits: '400', renewalCreditsEffectiveAt: String(cutoff) };

  it.each([[cutoff - 1, 750], [cutoff, 400], [cutoff + periodSeconds, 400]])('uses the invoice period start %i to grant %i credits at the unchanged price', async (periodStart, expectedCredits) => {
    const { env, sqlite } = legacySetup(renewalPolicy, periodStart);
    await applySubscriptionEvent(env, event());
    await applySubscriptionEvent(env, event());
    expect(sqlite.prepare('SELECT monthly_credits FROM subscription_invoices').get()).toEqual({ monthly_credits: expectedCredits });
    expect(sqlite.prepare('SELECT granted,remaining FROM subscription_credit_periods').get()).toEqual({ granted: expectedCredits, remaining: expectedCredits });
    expect(sqlite.prepare("SELECT amount,credits FROM orders WHERE provider_order_id=?").get(invoiceId)).toEqual({ amount: 759, credits: expectedCredits });
    expect(sqlite.prepare("SELECT amount,credits FROM orders WHERE id='legacy-allowance'").get()).toEqual({ amount: 759, credits: 750 });
    expect(sqlite.prepare('SELECT amount_cents,monthly_credits FROM subscriptions').get()).toEqual({ amount_cents: 759, monthly_credits: 750 });
    expect(sqlite.prepare("SELECT sum(amount) AS amount,count(*) AS n FROM credit_ledger WHERE kind='subscription_grant'").get()).toEqual({ amount: expectedCredits, n: 1 });
    expect(sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()).toEqual({ credits: 100 });
  });

  it('does not apply a renewal allowance to the original subscription purchase', async () => {
    const { env, sqlite } = legacySetup(renewalPolicy, cutoff, 'subscription_create');
    await applySubscriptionEvent(env, event());
    expect(sqlite.prepare('SELECT granted FROM subscription_credit_periods').get()).toEqual({ granted: 750 });
  });

  it('keeps an already granted renewal and its order at 400 after policy removal or edits', async () => {
    const { env, sqlite } = legacySetup(renewalPolicy);
    await applySubscriptionEvent(env, event());
    sqlite.prepare('UPDATE subscription_credit_periods SET remaining=215').run();
    delete metadata.renewalCredits;
    delete metadata.renewalCreditsEffectiveAt;
    await applySubscriptionEvent(env, event());
    metadata.renewalCredits = '450'; metadata.renewalCreditsEffectiveAt = String(cutoff);
    await applySubscriptionEvent(env, event());
    expect(sqlite.prepare('SELECT granted,remaining FROM subscription_credit_periods').get()).toEqual({ granted: 400, remaining: 215 });
    expect(sqlite.prepare('SELECT monthly_credits FROM subscription_invoices').get()).toEqual({ monthly_credits: 400 });
    expect(sqlite.prepare('SELECT credits FROM orders WHERE provider_order_id=?').get(invoiceId)).toEqual({ credits: 400 });
    expect(sqlite.prepare("SELECT count(*) AS n FROM credit_ledger WHERE kind='subscription_grant'").get()).toEqual({ n: 1 });
  });

  it.each([
    { renewalCredits: '400' }, { renewalCreditsEffectiveAt: String(cutoff) },
    { ...renewalPolicy, renewalCredits: '0' }, { ...renewalPolicy, renewalCredits: '-1' },
    { ...renewalPolicy, renewalCredits: '400.5' }, { ...renewalPolicy, renewalCredits: '9007199254740992' },
    { ...renewalPolicy, renewalCreditsEffectiveAt: 'bad' }, { ...renewalPolicy, renewalCreditsEffectiveAt: '0' },
  ] as Record<string, string>[])('rejects malformed administrative renewal metadata without granting: %j', async policy => {
    const { env, sqlite } = legacySetup(policy);
    await expect(applySubscriptionEvent(env, event())).rejects.toMatchObject({ status: 400 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM subscription_invoices').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM subscription_credit_periods').get()).toEqual({ n: 0 });
  });

  it('leaves an unconfigured subscriber at the original allowance and ignores webhook-supplied policy', async () => {
    const { env, sqlite } = legacySetup();
    await applySubscriptionEvent(env, event('invoice.paid', { id: invoiceId, object: 'invoice', metadata: renewalPolicy }));
    expect(sqlite.prepare('SELECT granted FROM subscription_credit_periods').get()).toEqual({ granted: 750 });
  });

  it.each(['customer.subscription.deleted', 'invoice.payment_failed'])('never grants a future allowance on %s', async type => {
    const { env, sqlite, apiOptions } = legacySetup(renewalPolicy);
    stripeApi({ ...apiOptions, sub: { ...apiOptions.sub, status: 'canceled', cancel_at_period_end: true } });
    await applySubscriptionEvent(env, event(type, { id: type.startsWith('customer.') ? subId : invoiceId }));
    expect(sqlite.prepare('SELECT count(*) AS n FROM subscription_credit_periods').get()).toEqual({ n: 0 });
  });
});
