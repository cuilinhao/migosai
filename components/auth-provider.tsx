"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { MeResponse, User } from "@/lib/contracts";
import { useTranslations } from "@/components/i18n/locale-provider";
import { AuthPanel, type AuthMode } from "@/components/ui/auth-panel";
import { GoogleOneTap, disableGoogleOneTap } from "@/components/ui/google-one-tap";
import Link from "@/components/i18n/localized-link";

export { GoogleSignInButton } from "@/components/ui/auth-panel";

type AuthContextValue = {
  user: User | null;
  credits: number;
  loading: boolean;
  authConfigured: boolean;
  emailAuthConfigured: boolean;
  openSignIn: () => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  ensureGuest: () => Promise<User>;
  recoveryCode: string | null;
  generateGuestRecovery: () => Promise<void>;
  restoreGuest: (code: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function AuthCard({ kind = "sign-in", authConfigured, emailAuthConfigured = true, loading = false, onSuccess }: {
  kind?: AuthMode; authConfigured: boolean; emailAuthConfigured?: boolean; loading?: boolean; onSuccess?: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>(kind);
  useEffect(() => { setMode(kind); }, [kind]);
  return <div className="mi-auth-card">
    <AuthPanel mode={mode} onModeChange={setMode} authConfigured={authConfigured} emailAuthConfigured={emailAuthConfigured} loading={loading} onSuccess={onSuccess} />
  </div>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState(0);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [emailAuthConfigured, setEmailAuthConfigured] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [oneTapError, setOneTapError] = useState("");
  const userRef = useRef<User | null>(null);
  const authRevision = useRef(0);
  const guestRequest = useRef<Promise<User> | null>(null);
  const [recovery, setRecovery] = useState<{ userId: string; code: string } | null>(null);

  const refresh = useCallback(async () => {
    const revision = ++authRevision.current;
    try {
      const response = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Unable to check your account.");
      const data = await response.json() as MeResponse;
      if (revision !== authRevision.current) return;
      userRef.current = data.user;
      setUser(data.user);
      setCredits(data.credits);
      setAuthConfigured(data.authConfigured);
      setEmailAuthConfigured(data.emailAuthConfigured ?? false);
      setGoogleClientId(data.googleClientId ?? null);
    } catch {
      if (revision !== authRevision.current) return;
      userRef.current = null;
      setUser(null);
      setCredits(0);
      setAuthConfigured(false);
      setEmailAuthConfigured(false);
      setGoogleClientId(null);
    } finally {
      if (revision === authRevision.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const focus = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);

  const ensureGuest = useCallback(async (): Promise<User> => {
    if (userRef.current) return userRef.current;
    if (guestRequest.current) return guestRequest.current;
    const revision = ++authRevision.current;
    const pending = (async () => {
      const response = await fetch("/api/guest-wallet", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { user?: User; credits?: number; recoveryCode?: string; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error || "Could not open your guest wallet.");
      // A login completed while the wallet request was in flight takes priority.
      if (revision !== authRevision.current || (userRef.current && userRef.current.id !== data.user.id)) throw new Error("Your wallet changed. Refresh this page before checking out.");
      userRef.current = data.user;
      setUser(data.user);
      setCredits(data.credits ?? 0);
      if (data.recoveryCode) setRecovery({ userId: data.user.id, code: data.recoveryCode });
      await refresh();
      if (userRef.current?.id !== data.user.id) throw new Error("Your wallet changed. Refresh this page before checking out.");
      return data.user;
    })();
    guestRequest.current = pending;
    try { return await pending; }
    finally { if (guestRequest.current === pending) guestRequest.current = null; if (revision === authRevision.current) setLoading(false); }
  }, [refresh]);

  const generateGuestRecovery = useCallback(async () => {
    const owner = userRef.current;
    if (!owner?.isGuest) throw new Error("Could not create a recovery code.");
    const response = await fetch("/api/guest-wallet/recovery", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedUserId: owner.id }) });
    const data = await response.json() as { recoveryCode?: string; userId?: string; error?: string };
    if (!response.ok || !data.recoveryCode) throw new Error(data.error || "Could not create a recovery code.");
    if (userRef.current?.id !== owner.id || data.userId !== owner.id) throw new Error("Your wallet changed. Refresh this page before checking out.");
    setRecovery({ userId: owner.id, code: data.recoveryCode });
  }, []);

  const restoreGuest = useCallback(async (recoveryCode: string) => {
    const response = await fetch("/api/guest-wallet/restore", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recoveryCode }) });
    const data = await response.json() as { user?: User; credits?: number; recoveryCode?: string; error?: string };
    if (!response.ok || !data.user?.isGuest || !data.recoveryCode) throw new Error(data.error || "Could not restore your guest wallet.");
    setRecovery({ userId: data.user.id, code: data.recoveryCode });
    // Re-read cookies: a concurrent normal login must retain its priority.
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    disableGoogleOneTap();
    await refresh();
  }, [refresh]);

  const openSignIn = () => { setMode("sign-in"); setOneTapError(""); setOpen(true); };
  const authenticated = async () => { await refresh(); setOpen(false); setOneTapError(""); };

  return <AuthContext.Provider value={{ user, credits, loading, authConfigured, emailAuthConfigured, openSignIn, refresh, logout, ensureGuest, recoveryCode: recovery && recovery.userId === user?.id ? recovery.code : null, generateGuestRecovery, restoreGuest }}>
    {children}
    <GoogleOneTap enabled={!loading && !user && !open && !!googleClientId} onSuccess={authenticated} onError={message => { setOneTapError(message); setOpen(true); }} />
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="mi-dialog-overlay mi-auth-overlay" />
        <Dialog.Content className="mi-auth-dialog">
          {user?.isGuest && <p className="mi-guest-signin-note">{t("Your guest credits stay in this wallet when you sign in to another account. Save your recovery code to return to it.")} <Link href="/guest-wallet" onClick={() => setOpen(false)}>{t("Save or restore wallet")}</Link></p>}
          <AuthPanel dialog mode={mode} onModeChange={next => { setMode(next); setOneTapError(""); }} authConfigured={authConfigured} emailAuthConfigured={emailAuthConfigured} loading={loading} onSuccess={authenticated} notice={oneTapError} />
          <Dialog.Close className="mi-dialog-close" aria-label={t("Close")}><X size={18} /></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </AuthContext.Provider>;
}
