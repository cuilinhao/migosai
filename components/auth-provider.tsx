"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { MeResponse, User } from "@/lib/contracts";
import { useTranslations } from "@/components/i18n/locale-provider";
import { AuthPanel, type AuthMode } from "@/components/ui/auth-panel";
import { GoogleOneTap, disableGoogleOneTap } from "@/components/ui/google-one-tap";

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

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Unable to check your account.");
      const data = await response.json() as MeResponse;
      setUser(data.user);
      setCredits(data.credits);
      setAuthConfigured(data.authConfigured);
      setEmailAuthConfigured(data.emailAuthConfigured ?? false);
      setGoogleClientId(data.googleClientId ?? null);
    } catch {
      setUser(null);
      setCredits(0);
      setAuthConfigured(false);
      setEmailAuthConfigured(false);
      setGoogleClientId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    disableGoogleOneTap();
    await refresh();
  }, [refresh]);

  const openSignIn = () => { setMode("sign-in"); setOneTapError(""); setOpen(true); };
  const authenticated = async () => { await refresh(); setOpen(false); setOneTapError(""); };

  return <AuthContext.Provider value={{ user, credits, loading, authConfigured, emailAuthConfigured, openSignIn, refresh, logout }}>
    {children}
    <GoogleOneTap enabled={!loading && !user && !open && !!googleClientId} onSuccess={authenticated} onError={message => { setOneTapError(message); setOpen(true); }} />
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="mi-dialog-overlay mi-auth-overlay" />
        <Dialog.Content className="mi-auth-dialog">
          <AuthPanel dialog mode={mode} onModeChange={next => { setMode(next); setOneTapError(""); }} authConfigured={authConfigured} emailAuthConfigured={emailAuthConfigured} loading={loading} onSuccess={authenticated} notice={oneTapError} />
          <Dialog.Close className="mi-dialog-close" aria-label={t("Close")}><X size={18} /></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </AuthContext.Provider>;
}
