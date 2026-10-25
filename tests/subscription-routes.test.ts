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
}));
vi.mock("../lib/server/payments", () => ({ createCheckout: backend.credits }));
import { POST as checkout } from "../app/api/checkout/route";
import { GET as status } from "../app/api/subscription/route";
import { POST as portal } from "../app/api/subscription/portal/route";
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
  vi.mocked(requireUser).mockResolvedValue(state.user);
});
describe("subscription HTTP routes", () => {
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
    expect(backend.portal).toHaveBeenCalledWith(state.env, "u");
  });
});
