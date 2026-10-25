import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuestWalletPanel } from "./guest-wallet-panel";

const state = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0, user: null as { id: string; isGuest?: boolean } | null, code: null as string | null, restore: vi.fn(), generate: vi.fn(), logout: vi.fn() }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState(initial: unknown) { const i = state.cursor++; if (!(i in state.cells)) state.cells[i] = initial; return [state.cells[i], (value: unknown) => { state.cells[i] = value; }]; },
  useRef(initial: unknown) { const i = state.cursor++; return state.cells[i] ??= { current: initial }; },
  useId: () => "guest-test",
}));
vi.mock("./auth-provider", () => ({ useAuth: () => ({ user: state.user, credits: 300, loading: false, recoveryCode: state.code, restoreGuest: state.restore, generateGuestRecovery: state.generate, logout: state.logout }) }));
vi.mock("@/components/i18n/locale-provider", () => ({ useTranslations: () => (source: string, values?: Record<string, unknown>) => source.replace(/\{(\w+)\}/g, (match, key) => values?.[key] === undefined ? match : String(values[key])) }));

type Element = ReactElement<Record<string, unknown>>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const item = node as Element;
  return [item, ...elements(item.props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return isValidElement(node) ? text((node.props as { children?: ReactNode }).children) : "";
}
function render(compact = false) { state.cursor = 0; return GuestWalletPanel({ compact }); }
function button(label: string) { const found = elements(render()).find(x => x.type === "button" && text(x.props.children as ReactNode) === label); if (!found) throw new Error(label); return found; }
async function click(label: string) { await (button(label).props.onClick as () => Promise<void>)(); }
function enter(value: string) {
  const input = elements(render()).find(x => x.type === "input" && !x.props.readOnly)!;
  (input.props.onChange as (event: unknown) => void)({ target: { value } });
}
async function submit() {
  const form = elements(render()).find(x => x.type === "form")!;
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault: vi.fn() });
}

beforeEach(() => {
  state.cells = []; state.cursor = 0; state.user = null; state.code = null;
  state.restore.mockReset(); state.generate.mockReset(); state.logout.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("guest wallet access", () => {
  it("allows an anonymous visitor to restore without a sign-in form and trims the code", async () => {
    expect(text(render())).toContain("Restore your guest wallet");
    enter("  recovery-code  "); await submit();
    expect(state.restore).toHaveBeenCalledWith("recovery-code");
    expect(state.logout).not.toHaveBeenCalled();
    expect(text(render())).toContain("Wallet restored. Keep your recovery code safe.");
  });
  it("keeps a signed-in account intact and explains that sign-out is required", () => {
    state.user = { id: "member" };
    expect(elements(render()).some(x => x.type === "form")).toBe(false);
    expect(text(render())).toContain("Sign out of your account before restoring a guest wallet.");
    expect(state.logout).not.toHaveBeenCalled();
  });
  it("explains wallet switching and shows the guest recovery code as selectable read-only text", () => {
    state.user = { id: "guest", isGuest: true }; state.code = "a".repeat(43);
    const tree = render();
    expect(elements(tree).find(x => x.type === "input" && x.props.readOnly)?.props.value).toBe(state.code);
    expect(text(tree)).toContain("Anyone with this code can use your credits and access your creations. Keep it private.");
    expect(text(tree)).toContain("Save your current wallet's code before switching. Restoring signs out other devices using the restored wallet.");
    expect(text(tree)).toContain("You can reuse this code to restore your wallet. Creating a new code replaces it.");
  });
  it("falls back to manual selection when clipboard permission is denied", async () => {
    state.user = { id: "guest", isGuest: true }; state.code = "b".repeat(43);
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
    await click("Copy recovery code");
    expect(text(render())).toContain("Copy was blocked. Select the code above and copy it manually.");
    expect(state.code).toBe("b".repeat(43));
  });
  it("creates a replacement only after an explicit click and explains invalidation", async () => {
    state.user = { id: "guest", isGuest: true };
    expect(text(render())).toContain("Creating a new recovery code replaces your previous code.");
    expect(state.generate).not.toHaveBeenCalled();
    await click("Create new recovery code");
    expect(state.generate).toHaveBeenCalledOnce();
  });
  it("prevents duplicate restore requests while one is pending", async () => {
    let finish!: () => void;
    state.restore.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    enter("a".repeat(43)); const pending = submit(); await submit();
    expect(state.restore).toHaveBeenCalledOnce();
    expect(button("Restoring…").props.disabled).toBe(true);
    finish(); await pending;
  });
  it("keeps purchase controls separate from the compact recovery prompt", () => {
    const tree = render(true);
    expect(elements(tree).some(x => x.type === "form")).toBe(false);
    expect(elements(tree).some(x => x.props.href === "/guest-wallet")).toBe(true);
    expect(text(tree)).toContain("Buy and use credits without signing in or registering.");
  });
});
