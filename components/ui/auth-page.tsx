"use client";

import Link from "@/components/i18n/localized-link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useEffect } from "react";
import { AuthCard, useAuth } from "@/components/auth-provider";
import { authReturnTo } from "./auth-return";

export function AuthPage({ kind }: { kind: "sign-in" | "sign-up" }) {
  const { authConfigured, user, loading } = useAuth();
  useEffect(() => {
    if (!loading && user) window.location.replace(authReturnTo(window.location));
  }, [loading, user]);
  return <main className="mi-auth-page">
    <header className="mi-auth-header">
      <Link href="/" className="mi-auth-brand"><span className="mi-brand-mark">L</span><span>LobbyDuo</span></Link>
      <LanguageSwitcher className="mi-language" />
    </header>
    <AuthCard kind={kind} authConfigured={authConfigured} />
  </main>;
}
