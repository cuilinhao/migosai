"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { MeResponse, User } from "@/lib/contracts";
import { authReturnTo } from "@/components/ui/auth-return";
import { useTranslations } from "@/components/i18n/locale-provider";

type AuthContextValue = {
  user: User | null;
  credits: number;
  loading: boolean;
  authConfigured: boolean;
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

export function GoogleSignInButton({ authConfigured }: { authConfigured: boolean }) {
  const t = useTranslations();
  const [error, setError] = useState("");
  const signIn = () => {
    if (!authConfigured) {
      setError("Google sign-in is temporarily unavailable.");
      return;
    }
    const returnTo = authReturnTo(window.location);
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };
  return <>
    <button className="mi-google-button" type="button" onClick={signIn}>
      <span className="mi-google-mark" aria-hidden="true">G</span> {t("Sign in with Google")}
    </button>
    {error && <p className="mi-error" role="alert">{t(error)}</p>}
  </>;
}

export function AuthCard({ kind = "sign-in", authConfigured }: { kind?: "sign-in" | "sign-up"; authConfigured: boolean }) {
  const t = useTranslations();
  const isUp = kind === "sign-up";
  return <div className="mi-auth-card">
    <h1>{t(isUp ? "Sign Up" : "Sign In")}</h1>
    <p>{t(isUp ? "Create an account" : "Sign in to your account")}</p>
    <GoogleSignInButton authConfigured={authConfigured} />
  </div>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState(0);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Unable to check your account.");
      const data = await response.json() as MeResponse;
      setUser(data.user);
      setCredits(data.credits);
      setAuthConfigured(data.authConfigured);
    } catch {
      setUser(null);
      setCredits(0);
      setAuthConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    await refresh();
  }, [refresh]);

  return <AuthContext.Provider value={{ user, credits, loading, authConfigured, openSignIn: () => setOpen(true), refresh, logout }}>
    {children}
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="mi-dialog-overlay" />
        <Dialog.Content className="mi-auth-dialog" aria-describedby="mi-auth-description">
          <Dialog.Title>{t("Sign In")}</Dialog.Title>
          <Dialog.Description id="mi-auth-description">{t("Sign in to your account")}</Dialog.Description>
          <GoogleSignInButton authConfigured={authConfigured} />
          <Dialog.Close className="mi-dialog-close" aria-label={t("Close")}><X size={18} /></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </AuthContext.Provider>;
}
