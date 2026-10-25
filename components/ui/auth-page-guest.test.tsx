import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "./auth-page";

const state = vi.hoisted(() => ({ user: null as { id: string; isGuest?: boolean } | null, loading: false }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: (effect: () => void) => effect() }));
vi.mock("@/components/auth-provider", () => ({ AuthCard: () => null, useAuth: () => ({ user: state.user, loading: state.loading, authConfigured: true, emailAuthConfigured: true, refresh: vi.fn() }) }));
vi.mock("@/components/i18n/locale-provider", () => ({ useTranslations: () => (source: string) => source }));

type Element = ReactElement<Record<string, unknown>>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const item = node as Element;
  return [item, ...elements(item.props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(text).join("");
  return isValidElement(node) ? text((node.props as { children?: ReactNode }).children) : "";
}

beforeEach(() => {
  state.user = null; state.loading = false;
  vi.stubGlobal("window", { location: { pathname: "/sign-in", search: "?returnTo=%2Fpricing", replace: vi.fn() } });
});
afterEach(() => vi.unstubAllGlobals());

describe("standalone guest authentication", () => {
  it.each(["sign-in", "sign-up"] as const)("keeps the %s form available to a guest and offers wallet recovery", kind => {
    state.user = { id: "guest", isGuest: true };
    const tree = AuthPage({ kind });
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(elements(tree).some(item => item.props.kind === kind)).toBe(true);
    expect(text(tree)).toContain("Your guest credits stay in this wallet when you sign in to another account. Save your recovery code to return to it.");
    expect(elements(tree).some(item => item.props.href === "/guest-wallet")).toBe(true);
  });
  it.each(["sign-in", "sign-up"] as const)("redirects an authenticated member away from %s", kind => {
    state.user = { id: "member", isGuest: false };
    AuthPage({ kind });
    expect(window.location.replace).toHaveBeenCalledWith("/pricing");
  });
  it("does not redirect while authentication is loading", () => {
    state.user = { id: "member" }; state.loading = true;
    AuthPage({ kind: "sign-in" });
    expect(window.location.replace).not.toHaveBeenCalled();
  });
});
