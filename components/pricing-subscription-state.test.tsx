import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingCards } from "./pricing-cards";
import { LocaleProvider } from "./i18n/locale-provider";
import { getMessages } from "@/lib/i18n";
import { isCurrentPricingPlan, pricingSubscriptionView, readPricingSubscription, type PricingSubscription, type Subscriber } from "./pricing-subscription-state";

const state = vi.hoisted(() => ({
  user: { id: "buyer-1" } as { id: string; isGuest?: boolean } | null,
  subscription: null as { id: string; planId: string; billingInterval: "month" | "year"; status: string } | null,
  loading: false, error: false,
}));
vi.mock("./auth-provider", () => ({ useAuth: () => ({ user: state.user, loading: false, openSignIn: vi.fn(), ensureGuest: vi.fn() }) }));
vi.mock("./pricing-subscription", () => ({ usePricingSubscription: () => ({ subscription: state.subscription, loading: state.loading, error: state.error, reload: vi.fn(), canSubscribe: () => !state.loading && !state.error && !state.subscription }) }));

const active = { id: "subscription-1", planId: "lite", billingInterval: "month", status: "active", cancelAtPeriodEnd: false, currentPeriodStart: "2026-10-01T00:00:00Z", currentPeriodEnd: "2026-11-01T00:00:00Z", canManage: true, canCancel: true, checkoutUrl: null } as const;
const buyer = { id: "buyer-1" };
function snapshot(subscription: PricingSubscription | null = active, owner: Subscriber = buyer, revision = 0, error = false) { return { owner, revision, subscription, error }; }
function render(purchaseType: "subscription" | "packs" = "subscription", locale: "en" | "zh-TW" | "ko" | "ja" | "fr" | "es" = "en") {
  return renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><PricingCards initialPurchaseType={purchaseType}/></LocaleProvider>);
}
function planAction(html: string, label: string) {
  const card = html.match(/<article\b[\s\S]*?<\/article>/g)?.find(item => item.includes(`>${label}</button></h3>`));
  const action = card?.match(/<button\b[^>]*aria-label=[^>]*>[^<]*<\/button>/)?.[0];
  if (!action) throw new Error(`Missing subscription action for ${label}`);
  return action;
}

beforeEach(() => { state.user = buyer; state.subscription = active; state.loading = false; state.error = false; });

describe("pricing subscription response and state", () => {
  it("keeps cancellation scheduled for period end as the current paid plan", () => {
    const subscription = readPricingSubscription({ subscription: { ...active, cancelAtPeriodEnd: true, canCancel: false } });
    expect(isCurrentPricingPlan(subscription, "lite", "month")).toBe(true);
    expect(pricingSubscriptionView(buyer, 0, snapshot(subscription)).canSubscribe).toBe(false);
  });
  it("matches the current plan and its billing interval exactly", () => {
    const subscription = { ...active, billingInterval: "year" as const };
    expect(isCurrentPricingPlan(subscription, "lite", "year")).toBe(true);
    expect(isCurrentPricingPlan(subscription, "lite", "month")).toBe(false);
    expect(isCurrentPricingPlan(subscription, "standard", "year")).toBe(false);
  });
  it.each(["canceled", "expired", "incomplete_expired"])("allows purchasing again only for closed status %s", status => {
    const subscription = readPricingSubscription({ subscription: { ...active, status } });
    expect(subscription).toBeNull();
    expect(pricingSubscriptionView(buyer, 0, snapshot(subscription)).canSubscribe).toBe(true);
  });
  it.each(["pending", "incomplete", "active", "trialing", "past_due", "unpaid", "paused", "unknown"])("blocks a second subscription for open or unknown status %s", status => {
    const subscription = readPricingSubscription({ subscription: { ...active, status } });
    expect(pricingSubscriptionView(buyer, 0, snapshot(subscription)).canSubscribe).toBe(false);
    if (["pending", "incomplete", "unknown"].includes(status)) expect(isCurrentPricingPlan(subscription, "lite", "month")).toBe(false);
  });
  it.each([null, {}, { subscription: {} }, { subscription: { ...active, billingInterval: "week" } }, { subscription: { ...active, status: null } }])("rejects a malformed status response instead of treating it as no subscription: %j", body => {
    expect(() => readPricingSubscription(body)).toThrow();
  });
  it("accepts an explicit server-confirmed absence of subscription", () => {
    expect(readPricingSubscription({ subscription: null })).toBeNull();
    expect(pricingSubscriptionView(buyer, 0, snapshot(null)).canSubscribe).toBe(true);
  });
  it("keeps checkout disabled until the signed-in account has been checked", () => {
    expect(pricingSubscriptionView(buyer, 0, null)).toMatchObject({ loading: true, canSubscribe: false });
    expect(pricingSubscriptionView(buyer, 0, snapshot(null, buyer, 0, true))).toMatchObject({ error: true, canSubscribe: false });
  });
  it("requires a fresh read after payment confirmation replaces the same user's account object", () => {
    const refreshedBuyer = { id: "buyer-1" };
    expect(pricingSubscriptionView(refreshedBuyer, 0, snapshot(null))).toMatchObject({ loading: true, canSubscribe: false });
    expect(pricingSubscriptionView(refreshedBuyer, 0, snapshot(active, refreshedBuyer))).toMatchObject({ loading: false, subscription: active, canSubscribe: false });
  });
  it("makes the previous checkout result unusable immediately when its revision is invalidated", () => {
    expect(pricingSubscriptionView(buyer, 1, snapshot(null, buyer, 0))).toMatchObject({ loading: true, canSubscribe: false });
    expect(pricingSubscriptionView(buyer, 1, snapshot(null, buyer, 1))).toMatchObject({ loading: false, canSubscribe: true });
  });
  it.each([null, { id: "guest-1", isGuest: true }, { id: "buyer-2" }])("never exposes the previous user's current subscription to %j", next => {
    expect(pricingSubscriptionView(next, 0, snapshot())).toMatchObject({ subscription: null, canSubscribe: false });
  });
});

describe("pricing subscribed controls with real React rendering", () => {
  it("renders the paid plan as a disabled Current plan and routes other plans to management", () => {
    const html = render();
    expect(planAction(html, "Lite")).toContain("disabled");
    expect(planAction(html, "Lite")).toContain(">Current plan</button>");
    expect(planAction(html, "Standard")).toContain("disabled");
    expect(planAction(html, "Standard")).toContain(">Subscription unavailable</button>");
    expect(html).toContain('href="/app/my-orders#subscription"');
    expect(html).toContain("Manage subscription");
  });
  it("does not mark the monthly price as the current annual plan", () => {
    state.subscription = { ...active, billingInterval: "year" };
    const html = render();
    expect(planAction(html, "Lite")).toContain("disabled");
    expect(html).not.toContain("Current plan");
  });
  it("renders status checking and read errors as disabled subscription actions", () => {
    state.subscription = null; state.loading = true;
    expect(planAction(render(), "Lite")).toContain(">Checking subscription…</button>");
    expect(planAction(render(), "Lite")).toContain("disabled");
    state.loading = false; state.error = true;
    expect(planAction(render(), "Lite")).toContain("disabled");
    expect(render()).toContain("Could not check your subscription. Please try again.");
    expect(render()).toContain(">Retry</button>");
  });
  it("offers pending-payment management without claiming an active subscription", () => {
    state.subscription = { ...active, status: "pending" };
    const html = render();
    expect(planAction(html, "Lite")).toContain("disabled");
    expect(html).not.toContain("Current plan");
    expect(html).toContain("Manage pending payment");
  });
  it("keeps one-time packs available to subscribed users", () => {
    const html = render("packs");
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Buy 300 credit pack<\/button>/);
    expect(html).not.toContain("Subscription unavailable");
  });
  it.each(["en", "zh-TW", "ko", "ja", "fr", "es"] as const)("renders the current-plan label and management link in %s", locale => {
    const html = render("subscription", locale);
    const translated = getMessages(locale)["Current plan"] ?? "Current plan";
    expect(html).toContain(`>${translated}</button>`);
    expect(html).toContain(locale === "en" ? 'href="/app/my-orders#subscription"' : `href="/${locale}/app/my-orders#subscription"`);
    if (locale !== "en") expect(html).not.toContain("You already have a subscription.");
  });
});
