import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PricingCards } from "./pricing-cards";

const state = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0, cleanups: [] as (() => void)[], user: { id: "buyer-1" } as { id: string } | null, openSignIn: vi.fn() }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState(initial: unknown) { const index = state.cursor++; if (!(index in state.cells)) state.cells[index] = typeof initial === "function" ? initial() : initial; return [state.cells[index], (value: unknown) => { state.cells[index] = typeof value === "function" ? value(state.cells[index]) : value; }]; },
  useRef(initial: unknown) { const index = state.cursor++; return state.cells[index] ??= { current: initial }; },
  useEffect(effect: () => (() => void) | undefined) { const index = state.cursor++; if (!(index in state.cells)) { state.cells[index] = true; const cleanup = effect(); if (cleanup) state.cleanups.push(cleanup); } },
  useId: () => "pricing-test",
}));
vi.mock("./auth-provider", () => ({ useAuth: () => ({ user: state.user, loading: false, openSignIn: state.openSignIn }) }));
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
function render(props?: Parameters<typeof PricingCards>[0]) { state.cursor = 0; return PricingCards(props); }
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
  state.cells = []; state.cursor = 0; state.cleanups = []; state.user = { id: "buyer-1" }; state.openSignIn.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ checkoutUrl: checkout, orderId: "order-1" }))));
  vi.stubGlobal("window", { open: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe("pricing purchase choices", () => {
  it("moves the selected credit-pack highlight when clicking card content without opening checkout", () => {
    const props = { initialPurchaseType: "packs" as const };
    const before = render(props);
    const selectedClass = card(before, "Creator").props.className;
    const unselectedClass = card(before, "Starter").props.className;
    clickCard(before, "Starter");
    const after = render(props);
    expect(card(after, "Starter").props.className).toBe(selectedClass);
    expect(card(after, "Creator").props.className).toBe(unselectedClass);
    expect(button(after, "Starter").props["aria-pressed"]).toBe(true);
    expect(button(after, "Creator").props["aria-pressed"]).toBe(false);
    clickCard(after, "Business");
    expect(button(render(props), "Business").props["aria-pressed"]).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("provides native keyboard-accessible selection buttons for subscription cards", async () => {
    const before = render();
    const selectedClass = card(before, "Pro").props.className;
    expect(button(before, "Lite").props.type).toBe("button");
    await click(before, "Lite");
    expect(card(render(), "Lite").props.className).toBe(selectedClass);
    expect(button(render(), "Lite").props["aria-pressed"]).toBe(true);
    expect(button(render(), "Pro").props["aria-pressed"]).toBe(false);
    await click(render(), "Yearly");
    expect(button(render(), "Lite").props["aria-pressed"]).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not select an Elite card when its tier control bubbles a click", async () => {
    await click(render(), "25K");
    clickCard(render(), "Elite", true);
    const tree = render();
    expect(button(tree, "Pro").props["aria-pressed"]).toBe(true);
    expect(button(tree, "Elite").props["aria-pressed"]).toBe(false);
    expect(textOf(tree)).toContain("25,000 credits per month");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("buys the clicked card once even when another card was selected", async () => {
    const props = { initialPurchaseType: "packs" as const };
    clickCard(render(props), "Business");
    await click(render(props), "Buy Starter");
    clickCard(render(props), "Starter", true);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ packId: "starter", locale: "en", expectedCredits: 300 }) }));
    const tree = render(props);
    expect(button(tree, "Starter").props["aria-pressed"]).toBe(true);
    expect(elements(tree).some(element => element.type === "a" && element.props.href === checkout)).toBe(true);
  });
  it("offers separate subscription and one-time choices and sends the selected monthly plan", async () => {
    const tree = render();
    expect(elements(tree).filter(element => element.props.role === "tab")).toHaveLength(2);
    expect(button(tree, "Subscription").props["aria-selected"]).toBe(true);
    await click(tree, "Subscribe to Lite");
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ purchaseType: "subscription", planId: "lite", billingInterval: "month", locale: "en" }) }));
  });
  it("shows the full annual bill while credits stay monthly and sends the selected Elite tier", async () => {
    await click(render(), "Yearly");
    await click(render(), "25K");
    const tree = render();
    expect(textOf(tree)).toContain("$1,619.88 billed yearly");
    expect(textOf(tree)).toContain("25,000 credits per month");
    await click(tree, "Subscribe to Elite");
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ purchaseType: "subscription", planId: "elite-25000", billingInterval: "year", locale: "en" }) }));
  });
  it("keeps one-time packs as a separate non-recurring checkout", async () => {
    await click(render(), "Credit packs");
    const tree = render();
    expect(textOf(tree)).toContain("One-time purchase");
    expect(textOf(tree)).not.toContain("billed yearly");
    for (const price of ["$9.90", "$29.90", "$49.90", "$99.90"]) expect(textOf(tree)).toContain(price);
    await click(tree, "Buy Starter");
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ packId: "starter", locale: "en", expectedCredits: 300 }) }));
  });
  it("sends the displayed promotional total so the server can reject an expired offer", async () => {
    const props = { initialPurchaseType: "packs" as const, offerTime: Date.parse("2026-11-27T12:00:00Z") };
    const tree = render(props);
    expect(textOf(tree)).toContain("360 credits");
    await click(tree, "Buy Starter");
    expect(fetch).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ body: JSON.stringify({ packId: "starter", locale: "en", expectedCredits: 360 }) }));
  });
  it("keeps an expired-quote response on the page without opening checkout", async () => {
    const message = "This credit pack offer has changed. Refresh pricing before you check out.";
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: message }), { status: 409 }));
    const props = { initialPurchaseType: "packs" as const, offerTime: Date.parse("2026-11-27T12:00:00Z") };
    await click(render(props), "Buy Starter");
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
