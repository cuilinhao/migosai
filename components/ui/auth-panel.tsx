"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { authReturnTo } from "./auth-return";

export type AuthMode = "sign-in" | "sign-up";

function GoogleMark() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.06.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.91a6 6 0 0 1 0-3.82V7.5H3.05a10 10 0 0 0 0 9l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51L18.7 4.6A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.95 5.5l3.34 2.59C7.18 7.72 9.39 5.96 12 5.96Z"/></svg>;
}

export function GoogleSignInButton({ authConfigured, disabled = false }: { authConfigured: boolean; disabled?: boolean }) {
  const t = useTranslations();
  const [error, setError] = useState("");
  return <>
    <button className="mi-google-button" type="button" disabled={disabled} onClick={() => {
      if (!authConfigured) { setError("Google sign-in is temporarily unavailable."); return; }
      window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(authReturnTo(window.location))}`);
    }}><GoogleMark /><span>{t("Continue with Google")}</span></button>
    {error && <p className="mi-auth-error" role="alert">{t(error)}</p>}
  </>;
}

export function AuthPanel({ mode, onModeChange, authConfigured, emailAuthConfigured = true, loading = false, onSuccess, dialog = false, notice = "" }: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  authConfigured: boolean;
  emailAuthConfigured?: boolean;
  loading?: boolean;
  onSuccess?: () => void | Promise<void>;
  dialog?: boolean;
  notice?: string;
}) {
  const t = useTranslations();
  const id = useId();
  const isUp = mode === "sign-up";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = t(isUp ? "Create your account" : "Welcome back");
  const description = t(isUp ? "Two photos. Endless possibilities." : "Your next great video starts here.");

  const changeMode = (next: AuthMode) => {
    if (busy || next === mode) return;
    setError(""); setPassword(""); setShowPassword(false); onModeChange(next);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || loading) return;
    setError("");
    if (!emailAuthConfigured) { setError("Email sign-in is temporarily unavailable."); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/email/${isUp ? "register" : "login"}`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }
      setPassword("");
      if (onSuccess) await onSuccess();
      else window.location.replace(authReturnTo(window.location));
    } catch { setError("We could not connect. Please try again."); }
    finally { setBusy(false); }
  };

  return <>
    <div className="mi-auth-wordmark"><span className="mi-auth-symbol" aria-hidden="true"><i /><i /></span>LobbyDuo</div>
    <div className="mi-auth-heading">
      {dialog ? <Dialog.Title className="mi-auth-title">{title}</Dialog.Title> : <h1 className="mi-auth-title">{title}</h1>}
      {dialog ? <Dialog.Description className="mi-auth-subtitle">{description}</Dialog.Description> : <p className="mi-auth-subtitle">{description}</p>}
    </div>
    <GoogleSignInButton authConfigured={authConfigured} disabled={busy || loading} />
    <div className="mi-auth-divider"><span>{t("or continue with email")}</span></div>
    <form className="mi-auth-form" onSubmit={submit} aria-busy={busy}>
      <div className="mi-auth-field">
        <label htmlFor={`${id}-email`}>{t("Email address")}</label>
        <div className="mi-auth-input-wrap"><Mail size={17} aria-hidden="true" /><input id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} /></div>
      </div>
      <div className="mi-auth-field">
        <label htmlFor={`${id}-password`}>{t("Password")}</label>
        <div className="mi-auth-input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input id={`${id}-password`} name="password" type={showPassword ? "text" : "password"} autoComplete={isUp ? "new-password" : "current-password"} placeholder={isUp ? t("At least 8 characters") : "••••••••"} minLength={isUp ? 8 : undefined} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} aria-describedby={isUp ? `${id}-hint` : undefined} /><button className="mi-auth-password-toggle" type="button" aria-label={t(showPassword ? "Hide password" : "Show password")} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        {isUp && <small id={`${id}-hint`}>{t("At least 8 characters")}</small>}
      </div>
      {(error || notice) && <p className="mi-auth-error" role="alert">{t(error || notice)}</p>}
      <button className="mi-auth-submit" type="submit" disabled={busy || loading}>{busy ? <><LoaderCircle className="mi-auth-spinner" size={18} aria-hidden="true" />{t(isUp ? "Creating account…" : "Signing in…")}</> : <>{t(isUp ? "Create account" : "Sign in")}<ArrowRight size={17} aria-hidden="true" /></>}</button>
    </form>
    <p className="mi-auth-switch">{t(isUp ? "Already have an account?" : "New to LobbyDuo?")} <button type="button" disabled={busy} onClick={() => changeMode(isUp ? "sign-in" : "sign-up")}>{t(isUp ? "Sign In" : "Sign Up")}<ArrowRight size={13} aria-hidden="true" /></button></p>
    <p className="mi-auth-legal">{t("By continuing, you agree to our")}<br /><Link href="/terms-of-service">{t("Terms of Service")}</Link> {t("and")} <Link href="/privacy-policy">{t("Privacy Policy")}</Link>.</p>
  </>;
}
