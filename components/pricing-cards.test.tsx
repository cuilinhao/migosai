import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PricingCards } from "./pricing-cards";

const state = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0, cleanups: [] as (() => void)[], user: { id: "buyer-1" } as { id: string; isGuest?: boolean } | null, openSignIn: vi.fn(), ensureGuest: vi.fn(), reloadSubscription: vi.fn() }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState(initial: unknown) { const index = state.cursor++; if (!(index in state.cells)) state.cells[index] = typeof initial === "function" ? initial() : initial; return [state.cells[index], (value: unknown) => { state.cells[index] = typeof value === "function" ? value(state.cells[index]) : value; }]; },
  useRef(initial: unknown) { const index = state.cursor++; return state.cells[index] ??= { current: initial }; },
  useEffect(effect: () => (() => void) | undefined) { const index = state.cursor++; if (!(index in state.cells)) { state.cells[index] = true; const cleanup = effect(); if (cleanup) state.cleanups.push(cleanup); } },
  useId: () => "pricing-test",
}));
vi.mock("./pricing-subscription", () => ({ usePricingSubscription: () => ({ subscription: null, loading: false, error: false, reload: state.reloadSubscription, canSubscribe: () => true }) }));
vi.mock("./auth-provider", () => ({ useAuth: () => ({ user: state.user, loading: false, openSignIn: state.openSignIn, ensureGuest: state.ensureGuest }) }));
vi.mock("@/components/i18n/locale-provider", () => ({ useLocale: () => "en", useTranslations: () => (source: string, values?: Record<string, string | number>) => source.replace(/\{(\w+)\}/g, (match, key) => values?.[key] === undefined ? match : String(values[key])) }));

type Element = ReactElement<Record<string, unknown>>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children as ReactNode)];
}
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return isValidElement(node) ? textOf((node.props as {children?: ReactNode}).children) : "";
}
function render(props: Parameters<typeof PricingCards>[0] = { initialPurchaseType: "subscription" }) { state.cursor = 0; return PricingCards(props); }
function button(tree: ReactNode, label: string) {
  const result = elements(tree).find(element => element.type === "button" && (element.props["aria-label"] === label || textOf(element.props.children as ReactNode) === label));
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}
function click(tree: ReactNode, label: string) { return (button(tree, label).props.onClick as () => unknown)(); }
function card(tree: ReactNode, name: string) {
  const result = elements(tree).find(element => element.type === "article" && elements(element).some(child => child.type === "h3" && textOf(child.props.children as ReactNode) === name));
  if (!result) throw new Error(`Missing card: ${name}`);
  return result;
}
function clickCard(tree: ReactNode, name: string, interactiveChild = false) {
  return (card(tree, name).props.onClick as (event: unknown) => void)({ target: { closest: () => interactiveChild ? {} : null } });
}
const checkout = "https://checkout.stripe.com/c/pay/cs_test_reference";

beforeEach(() => {
  state.cells = []; state.cursor = 0; state.cleanups = []; state.user = { id: "buyer-1" }; state.openSignIn.mockReset(); state.reloadSubscription.mockReset();
  state.ensureGuest.mockReset().mockImplementation(async () => { state.user = { id: "guest-1", isGuest: true }; return state.user; });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ checkoutUrl: checkout, orderId: "order-1" }))));
  vi.stubGlobal("window", { open: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe("pricing purchase choices", () => {
  it("defaults to Credit packs without displaying subscription prices", () => {
    const tree = render({});
    expect(button(tree, "Credit packs").props["aria-selected"]).toBe(true);
    expect(button(tree, "Subscription").props["aria-selected"]).toBe(false);
    expect(textOf(tree)).toContain("$9.90");
    expect(textOf(tree)).toContain("300 credits");
    expect(textOf(tree)).not.toContain("Billed monthly");
  });
  it("creates a guest wallet and buys a pack without a sign-in prompt", async () => {
    state.user = null;
    await click(render({}), "Buy 300 credit pack");
    expect(state.ensureGuest).toHaveBeenCalledOnce();
    expect(state.openSignIn).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ packId: "starter", locale: "en", expectedCredits: 300, expectedUserId: "guest-1" }) }));
    expect(window.open).toHaveBeenCalledWith(checkout, "_blank", "noopener,noreferrer");
    expect(elements(render({})).some(element => element.type === "a" && element.props.href === checkout)).toBe(true);
  });
  it("requires a registered account for subscriptions even with a guest wallet", async () => {
    state.user = { id: "guest-1", isGuest: true };
    await click(render(), "Subscribe to Lite");
    expect(state.openSignIn).toHaveBeenCalledOnce();
    expect(state.ensureGuest).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not open a checkout belonging to another wallet", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ checkoutUrl: checkout, buyerId: "another-wallet" }));
    await click(render({}), "Buy 300 credit pack");
    expect(window.open).not.toHaveBeenCalled();
    expect(textOf(render({}))).toContain("Your wallet changed");
  });
  it("keeps the failure visible when creating a guest wallet fails", async () => {
    state.user = null;
    state.ensureGuest.mockRejectedValue(new Error("Could not open your guest wallet."));
    await click(render({}), "Buy 300 credit pack");
    expect(fetch).not.toHaveBeenCalled();
    expect(textOf(render({}))).toContain("Could not open your guest wallet.");
  });
  it("moves the selected credit-pack highlight when clicking card content without opening checkout", () => {
    const props = { initialPurchaseType: "packs" as const };
    const before = render(props);
    const selectedClass = card(before, "950 credit pack").props.className;
    const unselectedClass = card(before, "300 credit pack").props.className;
    clickCard(before, "300 credit pack");
    const after = render(props);
    expect(card(after, "300 credit pack").props.className).toBe(selectedClass);
    expect(card(after, "950 credit pack").props.className).toBe(unselectedClass);
    expect(button(after, "300 credit pack").props["aria-pressed"]).toBe(true);
    expect(button(after, "950 credit pack").props["aria-pressed"]).toBe(false);
    clickCard(after, "3,300 credit pack");
    expect(button(render(props), "3,300 credit pack").props["aria-pressed"]).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("provides native keyboard-accessible selection buttons for subscription cards", async () => {
    const before = render();
    const selectedClass = card(before, "Standard").props.className;
    expect(button(before, "Lite").props.type).toBe("button");
    await click(before, "Lite");
    expect(card(render(), "Lite").props.className).toBe(selectedClass);
    expect(button(render(), "Lite").props["aria-pressed"]).toBe(true);
    expect(button(render(), "Standard").props["aria-pressed"]).toBe(false);
    await click(render(), "Yearly");
    expect(button(render(), "Lite").props["aria-pressed"]).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("offers one Elite allowance and does not change selection when a child control bubbles", () => {
    const before = render();
    clickCard(before, "Elite", true);
    const tree = render();
    expect(button(tree, "Standard").props["aria-pressed"]).toBe(true);
    expect(button(tree, "Elite").props["aria-pressed"]).toBe(false);
    expect(elements(tree).filter(element => element.type === "article")).toHaveLength(4);
    expect(textOf(card(tree, "Elite"))).toContain("4,000 credits per month");
    expect(elements(tree).some(element => element.props["aria-label"] === "Elite monthly credits")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("buys the clicked card once even when another card was selected", async () => {
    const props = { initialPurchaseType: "packs" as const };
    clickCard(render(props), "3,300 credit pack");
    await click(render(props), "Buy 300 credit pack");
    clickCard(render(props), "300 credit pack", true);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ packId: "starter", locale: "en", expectedCredits: 300, expectedUserId: "buyer-1" }) }));
    const tree = render(props);
    expect(button(tree, "300 credit pack").props["aria-pressed"]).toBe(true);
    expect(elements(tree).some(element => element.type === "a" && element.props.href === checkout)).toBe(true);
  });
  it("offers separate subscription and one-time choices and sends the selected monthly plan", async () => {
    const tree = render();
    expect(elements(tree).filter(element => element.props.role === "tab")).toHaveLength(2);
    expect(button(tree, "Subscription").props["aria-selected"]).toBe(true);
    await click(tree, "Subscribe to Lite");
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ purchaseType: "subscription", planId: "lite", billingInterval: "month", locale: "en", expectedCredits: 550, expectedAmountCents: 1490, expectedUserId: "buyer-1" }) }));
  });
  it.each([
    ["Lite", "$14.90", "550", "$13.41", "$160.92"],
    ["Standard", "$29.90", "1,150", "$26.91", "$322.92"],
    ["Pro", "$49.90", "1,950", "$44.91", "$538.92"],
    ["Elite", "$99.90", "4,000", "$89.91", "$1,078.92"],
  ])("shows the approved monthly and annual quote for %s", async (plan, monthly, credits, annualMonthly, annualTotal) => {
    expect(textOf(card(render(), plan))).toContain(monthly);
    expect(textOf(card(render(), plan))).toContain(`${credits} credits per month`);
    await click(render(), "Yearly");
    const annualCard = textOf(card(render(), plan));
    expect(annualCard).toContain(annualMonthly);
    expect(annualCard).toContain(`${annualTotal} billed yearly`);
    expect(annualCard).toContain(`${credits} credits per month`);
    expect(annualCard).toContain("10% OFF");
    expect(textOf(render())).toContain("Save 10%");
  });
  it("sends the new Elite plan with its annual billing interval", async () => {
    await click(render(), "Yearly");
    await click(render(), "Subscribe to Elite");
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ purchaseType: "subscription", planId: "elite-4000", billingInterval: "year", locale: "en", expectedCredits: 4000, expectedAmountCents: 107892, expectedUserId: "buyer-1" }) }));
  });
  it.each([
    ["starter", "300", 300, "$0.0330 / credit"],
    ["creator", "950", 950, "$0.0315 / credit"],
    ["pro", "1,600", 1600, "$0.0312 / credit"],
    ["business", "3,300", 3300, "$0.0303 / credit"],
  ])("shows and submits the exact permanent allowance for %s", async (packId, formatted, credits, unitPrice) => {
    const props = { initialPurchaseType: "packs" as const };
    const tree = render(props);
    const packCard = textOf(card(tree, `${formatted} credit pack`));
    expect(packCard).toContain(`${formatted} credits`);
    expect(packCard).toContain(unitPrice);
    expect(packCard).toContain("Credits never expire");
    await click(tree, `Buy ${formatted} credit pack`);
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ packId, locale: "en", expectedCredits: credits, expectedUserId: "buyer-1" }) }));
  });
  it("keeps one-time packs as a separate non-recurring checkout", async () => {
    await click(render(), "Credit packs");
    const tree = render();
    expect(textOf(tree)).toContain("One-time purchase");
    expect(textOf(tree)).not.toContain("billed yearly");
    for (const price of ["$9.90", "$29.90", "$49.90", "$99.90"]) expect(textOf(tree)).toContain(price);
    await click(tree, "Buy 300 credit pack");
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ packId: "starter", locale: "en", expectedCredits: 300, expectedUserId: "buyer-1" }) }));
  });
  it("sends the displayed promotional total so the server can reject an expired offer", async () => {
    const props = { initialPurchaseType: "packs" as const, offerTime: Date.parse("2026-11-27T12:00:00Z") };
    const tree = render(props);
    expect(textOf(tree)).toContain("360 credits");
    await click(tree, "Buy 300 credit pack");
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ packId: "starter", locale: "en", expectedCredits: 360, expectedUserId: "buyer-1" }) }));
  });
  it("keeps an expired-quote response on the page without opening checkout", async () => {
    const message = "This credit pack offer has changed. Refresh pricing before you check out.";
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: message }), { status: 409 }));
    const props = { initialPurchaseType: "packs" as const, offerTime: Date.parse("2026-11-27T12:00:00Z") };
    await click(render(props), "Buy 300 credit pack");
    expect(window.open).not.toHaveBeenCalled();
    expect(textOf(render(props))).toContain(message);
  });
  it("requires sign-in before requesting a checkout", async () => {
    state.user = null;
    await click(render(), "Subscribe to Lite");
    expect(state.openSignIn).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps a direct secure checkout link when the browser blocks the popup", async () => {
    vi.mocked(window.open).mockImplementation(() => { throw new Error("Popup blocked"); });
    await click(render(), "Subscribe to Lite");
    expect(elements(render()).some(element => element.type === "a" && element.props.href === checkout)).toBe(true);
  });
  it("rejects an untrusted checkout destination", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ checkoutUrl: "https://stripe.example.org/checkout" })));
    await click(render(), "Subscribe to Lite");
    expect(window.open).not.toHaveBeenCalled();
    expect(elements(render()).some(element => element.props.role === "alert")).toBe(true);
  });
  it.each(["network", "invalid JSON"])("rechecks subscription state when the checkout result is unknown after %s failure", async failure => {
    if (failure === "network") vi.mocked(fetch).mockRejectedValue(new Error("Connection lost"));
    else vi.mocked(fetch).mockResolvedValue(new Response("{incomplete"));
    await click(render(), "Subscribe to Lite");
    expect(state.reloadSubscription).toHaveBeenCalledOnce();
    expect(window.open).not.toHaveBeenCalled();
  });
  it("does not open a pending checkout after the signed-in account changes", async () => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const pending = click(render(), "Subscribe to Lite");
    state.user = { id: "buyer-2" };
    render();
    resolve(new Response(JSON.stringify({ checkoutUrl: checkout })));
    await pending;
    expect(window.open).not.toHaveBeenCalled();
    expect(elements(render()).some(element => element.type === "a" && element.props.href === checkout)).toBe(false);
  });
  it("prevents duplicate checkout requests while the first one is pending", async () => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const tree = render();
    const pending = click(tree, "Subscribe to Lite");
    await click(tree, "Subscribe to Lite");
    expect(fetch).toHaveBeenCalledOnce();
    expect(button(render(), "Credit packs").props.disabled).toBe(true);
    resolve(new Response(JSON.stringify({ checkoutUrl: checkout })));
    await pending;
  });
  it("clears the previous checkout link when a different billing choice is selected", async () => {
    await click(render(), "Subscribe to Lite");
    await click(render(), "Yearly");
    expect(elements(render()).some(element => element.type === "a" && element.props.href === checkout)).toBe(false);
  });
  it("does not open checkout after navigating away while the request is pending", async () => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const pending = click(render(), "Subscribe to Lite");
    state.cleanups.forEach(cleanup => cleanup());
    resolve(new Response(JSON.stringify({ checkoutUrl: checkout })));
    await pending;
    expect(window.open).not.toHaveBeenCalled();
  });
});
