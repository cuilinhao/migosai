import type { ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { User } from "@/lib/contracts";
import { AuthProvider } from "./auth-provider";

const hooks = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0 }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState(initial: unknown) { const i = hooks.cursor++; if (!(i in hooks.cells)) hooks.cells[i] = initial; return [hooks.cells[i], (value: unknown) => { hooks.cells[i] = value; }]; },
  useRef(initial: unknown) { const i = hooks.cursor++; return hooks.cells[i] ??= { current: initial }; },
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
}));
vi.mock("@/components/i18n/locale-provider", () => ({ useTranslations: () => (text: string) => text }));
type Context = { user: User | null; recoveryCode: string | null; loading: boolean; refresh(): Promise<void>; ensureGuest(): Promise<User>; restoreGuest(code: string): Promise<void>; generateGuestRecovery(): Promise<void> };
function render(): Context { hooks.cursor = 0; return (AuthProvider({ children: null }) as ReactElement<{ value: Context }>).props.value; }
const guest: User = { id: "guest-1", name: "Guest", email: "", isGuest: true };
const member: User = { id: "member-1", name: "Member", email: "member@example.test", isGuest: false };
const code = "a".repeat(43);
function me(user: User | null) { return Response.json({ user, credits: 0, authConfigured: true, emailAuthConfigured: true }); }
beforeEach(() => { hooks.cells = []; hooks.cursor = 0; vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => vi.unstubAllGlobals());

it("coalesces guest creation, keeps the recovery code in memory and verifies the cookie owner", async () => {
  let complete!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; })).mockResolvedValueOnce(me(guest));
  const ctx = render();
  const one = ctx.ensureGuest(), two = ctx.ensureGuest();
  expect(fetch).toHaveBeenCalledOnce();
  complete(Response.json({ user: guest, credits: 0, recoveryCode: code }));
  expect(await one).toEqual(guest); expect(await two).toEqual(guest);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(render()).toMatchObject({ user: guest, recoveryCode: code, loading: false });
});

it("does not let an earlier anonymous refresh erase a newly created wallet", async () => {
  let initial!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { initial = resolve; }))
    .mockResolvedValueOnce(Response.json({ user: guest, credits: 0, recoveryCode: code })).mockResolvedValueOnce(me(guest));
  const ctx = render(); const earlier = ctx.refresh();
  await ctx.ensureGuest();
  initial(me(null)); await earlier;
  expect(render().user).toEqual(guest);
});

it("keeps a newer member login when guest creation completes late", async () => {
  let create!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { create = resolve; })).mockResolvedValueOnce(me(member));
  const ctx = render(); const pending = ctx.ensureGuest();
  await ctx.refresh();
  create(Response.json({ user: guest, credits: 0, recoveryCode: code }));
  await expect(pending).rejects.toThrow("Your wallet changed");
  expect(render()).toMatchObject({ user: member, recoveryCode: null });
});

it("does not show another wallet's recovery code after an account change", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ user: guest, credits: 0, recoveryCode: code })).mockResolvedValueOnce(me(guest)).mockResolvedValueOnce(me(member));
  await render().ensureGuest(); await render().refresh();
  expect(render()).toMatchObject({ user: member, recoveryCode: null });
});

it("restores by POST body and re-reads the active identity instead of overriding a concurrent login", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ user: guest, credits: 300, recoveryCode: code })).mockResolvedValueOnce(me(member));
  await render().restoreGuest("b".repeat(43));
  expect(fetch).toHaveBeenCalledWith("/api/guest-wallet/restore", expect.objectContaining({ method: "POST", body: JSON.stringify({ recoveryCode: "b".repeat(43) }) }));
  expect(render()).toMatchObject({ user: member, recoveryCode: null });
});

it("pins recovery-code changes to the displayed wallet and rejects a different response owner", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(me(guest))
    .mockResolvedValueOnce(Response.json({ userId: "guest-other", recoveryCode: code }));
  await render().refresh();
  await expect(render().generateGuestRecovery()).rejects.toThrow("Your wallet changed");
  expect(fetch).toHaveBeenCalledWith("/api/guest-wallet/recovery", expect.objectContaining({ body: JSON.stringify({ expectedUserId: guest.id }) }));
  expect(render().recoveryCode).toBeNull();
});
