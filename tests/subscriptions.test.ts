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
  unit_amount: 759,
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
    amount_due: 759,
    amount_paid: 759,
    amount_remaining: 0,
    amount_paid_off_stripe: 0,
    total: 759,
    subtotal: 759,
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
    amount: 759,
    subtotal: 759,
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
    createSession?: Record<string, unknown>;
    config?: Record<string, unknown>;
    portal?: Record<string, unknown>;
    price?: Record<string, unknown>;
    failCreateOnce?: boolean;
  } = {},
) {
  let sent = new URLSearchParams();
  const checkoutRequests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== "https://api.stripe.com" || init?.redirect !== "manual")
      throw Error("Unexpected destination");
    const body = new URLSearchParams(String(init?.body ?? ""));
    if (url.pathname === `/v1/prices/${priceId}`)
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
        amount_total: options.price ? 7308 : 759,
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
    if (url.pathname === `/v1/checkout/sessions/${sessionId}`)
      return Response.json({
        id: sessionId,
        url: `https://checkout.stripe.com/c/pay/${sessionId}`,
        mode: "subscription",
        amount_total: options.price ? 7308 : 759,
        currency: "usd",
        total_details: { amount_discount: 0, amount_tax: 0 },
        livemode: false,
        status: "open",
        customer: customerId,
        client_reference_id: metadata.orderId,
        metadata,
        expires_at: Math.floor(Date.now() / 1000) + 1800,
        ...options.session,
      });
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
            amount_paid: 759,
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
        amount: 759,
        amount_received: 759,
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
  return { sent: () => sent, checkoutRequests };
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

describe("Stripe subscriptions", () => {
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
        ).toEqual({ credits: 750 });
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
      amount: 759,
      credits: 750,
    });
    expect(
      await createSubscriptionCheckout(env, user, "lite", "month", "en"),
    ).toEqual(checkout);
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
    { invoice: { amount_paid_off_stripe: 759 } },
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
    ).toEqual({ remaining: 750, ends_at: end });
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
      unit_amount: 7308,
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
        amount_due: 7308,
        amount_paid: 7308,
        total: 7308,
        subtotal: 7308,
      },
      line: { amount: 7308, subtotal: 7308, period: { start, end: annualEnd } },
      payment: { amount_paid: 7308 },
      intent: { amount: 7308, amount_received: 7308 },
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
    ).toEqual({ n: 12, total: 9000 });
    expect(
      sqlite
        .prepare(
          "SELECT sum(remaining) AS n FROM subscription_credit_periods WHERE starts_at<=unixepoch() AND ends_at>unixepoch()",
        )
        .get(),
    ).toEqual({ n: 750 });
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
        amount: 759,
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
    ).toEqual({ remaining: 750 });
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
