import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  env: { APP_URL: "https://example.test" },
  user: {
    id: "u",
    email: "a@b.c",
    name: "Test",
    credits: 100,
    permanentCredits: 100,
    subscriptionCredits: 0,
    subscriptionCreditsExpireAt: null,
  },
}));
const backend = vi.hoisted(() => ({
  checkout: vi.fn(),
  status: vi.fn(),
  portal: vi.fn(),
  cancel: vi.fn(),
  change: vi.fn(),
  credits: vi.fn(),
}));
vi.mock("../lib/server/env", async (original) => ({
  ...(await original<typeof import("../lib/server/env")>()),
  getEnv: async () => state.env,
}));
vi.mock("../lib/server/auth", () => ({
  requireUser: vi.fn(async () => state.user),
}));
vi.mock("../lib/server/subscriptions", () => ({
  createSubscriptionCheckout: backend.checkout,
  subscriptionStatus: backend.status,
  createSubscriptionPortal: backend.portal,
  cancelSubscription: backend.cancel,
  createSubscriptionChange: backend.change,
}));
vi.mock("../lib/server/payments", () => ({ createCheckout: backend.credits }));
import { POST as checkout } from "../app/api/checkout/route";
import { GET as status } from "../app/api/subscription/route";
import { POST as portal } from "../app/api/subscription/portal/route";
import { POST as cancel } from "../app/api/subscription/cancel/route";
import { POST as change } from "../app/api/subscription/change/route";
import { requireUser } from "../lib/server/auth";
import { ApiError } from "../lib/server/errors";
const request = (
  url: string,
  body: unknown = {},
  origin = "https://example.test",
) =>
  new Request("https://example.test" + url, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  backend.checkout.mockResolvedValue({
    checkoutUrl: "https://checkout.stripe.com/c/pay/fixture",
    orderId: "sub-local",
  });
  backend.credits.mockResolvedValue({
    checkoutUrl: "https://checkout.stripe.com/c/pay/credit",
    orderId: "credit-local",
  });
  backend.status.mockResolvedValue({ subscription: null });
  backend.portal.mockResolvedValue({
    url: "https://billing.stripe.com/p/session/fixture",
  });
  backend.cancel.mockResolvedValue({ cancelled: true });
  backend.change.mockResolvedValue({ url: "https://billing.stripe.com/p/session/change-fixture" });
  vi.mocked(requireUser).mockResolvedValue(state.user);
});
describe("subscription HTTP routes", () => {
  it("creates credit checkout for the confirmed guest wallet without requiring registration", async () => {
    const guest = { ...state.user, id: "guest-wallet", email: "", isGuest: true };
    vi.mocked(requireUser).mockResolvedValue(guest);
    const response = await checkout(request("/api/checkout", { packId: "starter", expectedCredits: 300, expectedUserId: guest.id }), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ orderId: "credit-local", buyerId: guest.id });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.credits).toHaveBeenCalledWith(state.env, guest, "starter", undefined, 300);
  });

  it.each([undefined, "another-wallet", null, 42])("rejects a guest checkout whose wallet precondition is %j", async expectedUserId => {
    vi.mocked(requireUser).mockResolvedValue({ ...state.user, isGuest: true });
    const response = await checkout(request("/api/checkout", { packId: "starter", expectedUserId }), {});
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "Your wallet changed. Refresh this page before checking out." });
    expect(backend.credits).not.toHaveBeenCalled();
  });

  it("rejects a changed registered account when the client supplied an ownership precondition", async () => {
    const response = await checkout(request("/api/checkout", { packId: "starter", expectedUserId: "previous-user" }), {});
    expect(response.status).toBe(409);
    expect(backend.credits).not.toHaveBeenCalled();
  });

  it("requires a registered account for a guest subscription or billing portal", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ...state.user, isGuest: true });
    const response = await checkout(request("/api/checkout", { purchaseType: "subscription", planId: "lite", billingInterval: "month", expectedAmountCents: 1490, expectedCredits: 550, expectedUserId: state.user.id }), {});
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "Please sign in to subscribe." });
    expect((await portal(request("/api/subscription/portal"), {})).status).toBe(401);
    expect(backend.checkout).not.toHaveBeenCalled();
    expect(backend.portal).not.toHaveBeenCalled();
  });

  it("does not create checkout without either a registered or guest session", async () => {
    vi.mocked(requireUser).mockRejectedValue(new ApiError(401, "Please sign in to continue."));
    expect((await checkout(request("/api/checkout", { packId: "starter" }), {})).status).toBe(401);
    expect(backend.credits).not.toHaveBeenCalled();
  });

  it.each([
    ["lite", "month", 1490, 550], ["lite", "year", 16092, 550],
    ["standard", "month", 2990, 1150], ["standard", "year", 32292, 1150],
    ["pro", "month", 4990, 1950], ["pro", "year", 53892, 1950],
    ["elite-4000", "month", 9990, 4000], ["elite-4000", "year", 107892, 4000],
  ])("accepts the current displayed quote for %s/%s", async (planId, billingInterval, expectedAmountCents, expectedCredits) => {
    const response = await checkout(request("/api/checkout", { purchaseType: "subscription", planId, billingInterval, expectedAmountCents, expectedCredits }), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ orderId: "sub-local" });
  });

  it.each([
    {}, { expectedCredits: 6000, expectedAmountCents: 4999 },
    { expectedCredits: 1950 }, { expectedAmountCents: 4990 },
    { expectedCredits: 1950, expectedAmountCents: 4999 },
    { expectedCredits: 6000, expectedAmountCents: 4990 },
    { expectedCredits: "1950", expectedAmountCents: 4990 },
  ])("asks stale subscription clients to refresh before payment: %j", async (quote) => {
    const response = await checkout(request("/api/checkout", { purchaseType: "subscription", planId: "pro", billingInterval: "month", ...quote }), {});
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "This subscription offer has changed. Refresh pricing before you check out." });
    expect(backend.checkout).not.toHaveBeenCalled();
  });

  it("passes only authenticated ownership and selected plan to recurring checkout", async () => {
    const response = await checkout(
      request("/api/checkout", {
        purchaseType: "subscription",
        planId: "lite",
        billingInterval: "year",
        expectedCredits: 550,
        expectedAmountCents: 16092,
        locale: "ja",
        userId: "other",
        amount: 1,
      }),
      {},
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ orderId: "sub-local" });
    expect(backend.checkout).toHaveBeenCalledWith(
      state.env,
      state.user,
      "lite",
      "year",
      "ja",
    );
    expect(backend.credits).not.toHaveBeenCalled();
  });
  it("preserves the existing credit-pack checkout request", async () => {
    const response = await checkout(
      request("/api/checkout", { packId: "starter", locale: "en" }),
      {},
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ orderId: "credit-local" });
    expect(backend.credits).toHaveBeenCalledWith(
      state.env,
      state.user,
      "starter",
      "en",
      undefined,
    );
  });
  it("passes only the displayed total as an offer precondition for credit checkout", async () => {
    const response = await checkout(request("/api/checkout", { packId: "starter", locale: "en", expectedCredits: 360, credits: 999999, bonusCredits: 999999, campaignId: "forged" }), {});
    expect(response.status).toBe(200);
    expect(backend.credits).toHaveBeenCalledWith(state.env, state.user, "starter", "en", 360);
  });
  it("rejects unknown purchase types", async () => {
    expect(
      (await checkout(request("/api/checkout", { purchaseType: "custom" }), {}))
        .status,
    ).toBe(400);
    expect(backend.checkout).not.toHaveBeenCalled();
    expect(backend.credits).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations before creating checkout or portal", async () => {
    expect(
      (
        await checkout(
          request(
            "/api/checkout",
            { purchaseType: "subscription" },
            "https://evil.test",
          ),
          {},
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await portal(
          request("/api/subscription/portal", {}, "https://evil.test"),
          {},
        )
      ).status,
    ).toBe(403);
    expect(backend.checkout).not.toHaveBeenCalled();
    expect(backend.portal).not.toHaveBeenCalled();
  });
  it("requires a signed-in user to read subscription status or create a portal", async () => {
    vi.mocked(requireUser).mockRejectedValue(
      new ApiError(401, "Sign in required."),
    );
    expect(
      (await status(new Request("https://example.test/api/subscription"), {}))
        .status,
    ).toBe(401);
    expect((await portal(request("/api/subscription/portal"), {})).status).toBe(
      401,
    );
    expect(backend.status).not.toHaveBeenCalled();
    expect(backend.portal).not.toHaveBeenCalled();
  });
  it("returns uncached subscription state and a portal owned by the authenticated user", async () => {
    const response = await status(
      new Request("https://example.test/api/subscription?userId=other"),
      {},
    );
    expect(await response.json()).toEqual({ subscription: null });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.status).toHaveBeenCalledWith(state.env, "u");
    expect(
      (
        await portal(
          request("/api/subscription/portal", { userId: "other" }),
          {},
        )
      ).status,
    ).toBe(200);
    expect(backend.portal).toHaveBeenCalledWith(state.env, "u", undefined);
  });
});

const rawSubscriptionRequest = (path: string, body?: string, origin = "https://example.test") =>
  new Request("https://example.test" + path, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
  });

const changeRequest = { subscriptionId: "sub-local", expectedUserId: "u", planId: "standard", billingInterval: "month", expectedAmountCents: 2990, expectedCredits: 1150 };

describe.each([
  { path: "/api/subscription/portal", handler: portal, operation: backend.portal, body: { subscriptionId: "sub-local" } },
  { path: "/api/subscription/cancel", handler: cancel, operation: backend.cancel, body: { subscriptionId: "sub-local" } },
  { path: "/api/subscription/change", handler: change, operation: backend.change, body: changeRequest },
])("subscription management boundary: $path", ({ path, handler, operation, body: validBody }) => {
  it("rejects cross-origin requests before checking authentication or parsing JSON", async () => {
    const response = await handler(rawSubscriptionRequest(path, "{", "https://evil.test"), {});
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(requireUser).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  it("requires authentication before parsing JSON", async () => {
    vi.mocked(requireUser).mockRejectedValue(new ApiError(401, "Sign in required."));
    const response = await handler(rawSubscriptionRequest(path, "{"), {});
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(operation).not.toHaveBeenCalled();
  });

  it("rejects guest wallets before parsing JSON", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ...state.user, isGuest: true });
    const response = await handler(rawSubscriptionRequest(path, "{"), {});
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(operation).not.toHaveBeenCalled();
  });

  it.each(["{", "null", "[]", '"subscription"', "42", "true", " "])(
    "rejects invalid JSON or a non-object body: %s",
    async body => {
      const response = await handler(rawSubscriptionRequest(path, body), {});
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(operation).not.toHaveBeenCalled();
    },
  );

  it("rejects bodies above 32 KiB without calling billing", async () => {
    const response = await handler(request(path, { subscriptionId: "sub-local", extra: "x".repeat(32 * 1024) }), {});
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(operation).not.toHaveBeenCalled();
  });

  it("preserves billing errors in an uncached response", async () => {
    operation.mockRejectedValueOnce(new ApiError(404, "The subscription was not found."));
    const response = await handler(request(path, validBody), {});
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "The subscription was not found." });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("subscription cancellation HTTP route", () => {
  it.each([undefined, ""])("rejects an absent or empty request body: %j", async body => {
    const response = await cancel(rawSubscriptionRequest("/api/subscription/cancel", body), {});
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.cancel).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "", "   ", 42, true, [], {}, "x".repeat(201)].map(subscriptionId => ({ subscriptionId })))(
    "rejects a missing or invalid subscription identifier: $subscriptionId",
    async ({ subscriptionId }) => {
      const response = await cancel(request("/api/subscription/cancel", { subscriptionId }), {});
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(backend.cancel).not.toHaveBeenCalled();
    },
  );

  it("uses the signed-in owner and selected subscription, forwarding the locale", async () => {
    const response = await cancel(request("/api/subscription/cancel", {
      subscriptionId: "sub-local",
      userId: "another-user",
      locale: "ja",
    }), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cancelled: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.cancel).toHaveBeenCalledWith(state.env, "u", "sub-local", "ja");
  });

  it("returns the secure cancellation confirmation destination for an existing subscription", async () => {
    backend.cancel.mockResolvedValueOnce({ url: "https://billing.stripe.com/p/session/cancel-fixture" });
    const response = await cancel(request("/api/subscription/cancel", { subscriptionId: "sub-local" }), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://billing.stripe.com/p/session/cancel-fixture" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.cancel).toHaveBeenCalledWith(state.env, "u", "sub-local", undefined);
  });
});

describe("localized subscription billing portal", () => {
  it.each([undefined, "{}"])("preserves no-argument portal requests: %j", async body => {
    const response = await portal(rawSubscriptionRequest("/api/subscription/portal", body), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://billing.stripe.com/p/session/fixture" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.portal).toHaveBeenCalledWith(state.env, "u", undefined);
  });

  it("forwards the locale while ignoring a client-supplied account owner", async () => {
    const response = await portal(request("/api/subscription/portal", { locale: "fr", userId: "another-user" }), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://billing.stripe.com/p/session/fixture" });
    expect(backend.portal).toHaveBeenCalledWith(state.env, "u", "fr");
  });
});


describe("subscription plan-change HTTP route", () => {
  it.each([undefined, null, "", " ", 42, [], {}, "x".repeat(201)])("requires a bounded subscription identifier: %j", async subscriptionId => {
    const response = await change(request("/api/subscription/change", { ...changeRequest, subscriptionId }), {});
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.change).not.toHaveBeenCalled();
  });
  it.each([undefined, null, "other", 42])("rejects a missing or different signed-in account precondition: %j", async expectedUserId => {
    const response = await change(request("/api/subscription/change", { ...changeRequest, expectedUserId }), {});
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.change).not.toHaveBeenCalled();
  });
  it.each([
    { planId: "unknown" }, { planId: "elite-15000" }, { planId: undefined },
    { billingInterval: "week" }, { billingInterval: null }, { billingInterval: undefined },
  ])("rejects unavailable plans and billing intervals: %j", async input => {
    const response = await change(request("/api/subscription/change", { ...changeRequest, ...input }), {});
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.change).not.toHaveBeenCalled();
  });
  it.each([
    { expectedCredits: undefined }, { expectedAmountCents: undefined },
    { expectedCredits: 2500 }, { expectedAmountCents: 2499 },
    { expectedCredits: "1150" }, { expectedAmountCents: "2990" },
    { billingInterval: "year" },
  ])("rejects stale or malformed plan-change quotes: %j", async quote => {
    const response = await change(request("/api/subscription/change", { ...changeRequest, ...quote }), {});
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "This subscription offer has changed. Refresh pricing before you check out." });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.change).not.toHaveBeenCalled();
  });
  it.each([
    ["standard", "month", 2990, 1150], ["standard", "year", 32292, 1150],
    ["pro", "month", 4990, 1950], ["pro", "year", 53892, 1950],
    ["elite-4000", "month", 9990, 4000], ["elite-4000", "year", 107892, 4000],
    ["lite", "month", 1490, 550], ["lite", "year", 16092, 550],
  ])("forwards authenticated ownership and the current quote for %s/%s", async (planId, billingInterval, expectedAmountCents, expectedCredits) => {
    const response = await change(request("/api/subscription/change", { ...changeRequest, planId, billingInterval, expectedAmountCents, expectedCredits, locale: "ja", userId: "forged", priceId: "price_forged", amount: 1, customerId: "cus_forged" }), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://billing.stripe.com/p/session/change-fixture" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.change).toHaveBeenCalledWith(state.env, "u", "sub-local", planId, billingInterval, "ja");
    expect(backend.checkout).not.toHaveBeenCalled();
  });
});
