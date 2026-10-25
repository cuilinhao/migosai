"use client";

import Link from "@/components/i18n/localized-link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useEffect } from "react";
import { ArrowLeft, Sun } from "lucide-react";
import { AuthCard, useAuth } from "@/components/auth-provider";
import { useTranslations } from "@/components/i18n/locale-provider";
import { authReturnTo } from "./auth-return";

export function AuthPage({ kind }: { kind: "sign-in" | "sign-up" }) {
  const { authConfigured, emailAuthConfigured, user, loading, refresh } = useAuth();
  const t = useTranslations();
  useEffect(() => {
    if (!loading && user && !user.isGuest) window.location.replace(authReturnTo(window.location));
  }, [loading, user]);
  return <main className="mi-auth-page">
    <header className="mi-auth-header">
      <Link href="/" className="mi-auth-brand"><Sun size={28} strokeWidth={2.5} aria-hidden="true"/><span>MigosAI</span></Link>
      <LanguageSwitcher className="mi-language" />
    </header>
    <div className="mi-auth-page-content">
      {user?.isGuest && <p className="mi-guest-signin-note">{t("Your guest credits stay in this wallet when you sign in to another account. Save your recovery code to return to it.")} <Link href="/guest-wallet">{t("Save or restore wallet")}</Link></p>}
      <AuthCard kind={kind} authConfigured={authConfigured} emailAuthConfigured={emailAuthConfigured} loading={loading} onSuccess={refresh} />
      <Link href="/" className="mi-auth-back"><ArrowLeft size={15} aria-hidden="true" />{t("Back to home")}</Link>
    </div>
  </main>;
}
