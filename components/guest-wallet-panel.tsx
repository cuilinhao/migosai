"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { useAuth } from "./auth-provider";
import styles from "./guest-wallet-panel.module.css";

export function GuestWalletPanel({ compact = false }: { compact?: boolean } = {}) {
  const t = useTranslations();
  const { user, credits, loading, recoveryCode, generateGuestRecovery, restoreGuest, logout } = useAuth();
  const id = useId();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"restore" | "generate" | "logout" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function run(kind: "restore" | "generate" | "logout", action: () => Promise<void>, success = "") {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(kind); setNotice(""); setError("");
    try { await action(); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again."); }
    finally { inFlight.current = false; setBusy(null); }
  }
  async function restore(event: FormEvent) {
    event.preventDefault();
    const code = input.trim();
    if (!code) { setError("Enter your recovery code."); return; }
    await run("restore", async () => { await restoreGuest(code); setInput(""); }, "Wallet restored. Keep your recovery code safe.");
  }
  async function copyCode() {
    if (!recoveryCode) return;
    setNotice(""); setError("");
    try { await navigator.clipboard.writeText(recoveryCode); setNotice("Recovery code copied."); }
    catch { setNotice("Copy was blocked. Select the code above and copy it manually."); }
  }
  function downloadCode() {
    if (!recoveryCode) return;
    const contents = `${t("MigosAI guest wallet recovery code")}\n\n${recoveryCode}\n\n${t("Anyone with this code can use your credits and access your creations. Keep it private.")}\nhttps://migosai.design/guest-wallet\n`;
    const url = URL.createObjectURL(new Blob([contents], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "migosai-wallet-recovery.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (compact && user && !user.isGuest) return null;
  return <section className={`${styles.panel} ${compact ? styles.compact : ""}`} aria-label={t("Guest wallet")}>
    {notice && <p className={styles.notice} role="status">{t(notice)}</p>}
    {user?.isGuest ? <>
      <div className={styles.heading}><h2>{t("Guest wallet")}</h2><span>{t("{credits} credits", { credits })}</span></div>
      <p>{t("Buy and use credits without signing in or registering.")}</p>
      <p>{t("Save a recovery code to keep access after clearing browser data or changing devices.")}</p>
      {recoveryCode ? <div className={styles.recovery}>
        <label htmlFor={`${id}-saved-code`}>{t("Your recovery code")}</label>
        <input id={`${id}-saved-code`} className={styles.code} value={recoveryCode} readOnly autoComplete="off" spellCheck={false} onFocus={event => event.currentTarget.select()}/>
        <p className={styles.warning}>{t("Anyone with this code can use your credits and access your creations. Keep it private.")}</p>
        <div className={styles.actions}><button type="button" onClick={copyCode}>{t("Copy recovery code")}</button><button type="button" onClick={downloadCode}>{t("Download recovery code")}</button></div>
      </div> : <div className={styles.recovery}>
        <p>{t("Creating a new recovery code replaces your previous code.")}</p>
        <button type="button" disabled={busy !== null || loading} onClick={() => run("generate", generateGuestRecovery)}>{t(busy === "generate" ? "Creating recovery code…" : "Create new recovery code")}</button>
      </div>}
      {!compact && <p>{t("Your guest credits stay in this wallet when you sign in to another account. Save your recovery code to return to it.")}</p>}
    </> : compact ? <p>{t("Buy and use credits without signing in or registering.")}</p> : null}

    {compact ? <Link href="/guest-wallet" className={styles.link}>{t("Save or restore wallet")}</Link> : <div className={styles.restore}>
      <h2>{t("Restore your guest wallet")}</h2>
      {user && !user.isGuest ? <>
        <p>{t("Sign out of your account before restoring a guest wallet.")}</p>
        <button type="button" disabled={busy !== null || loading} onClick={() => run("logout", logout)}>{t("Sign Out")}</button>
      </> : <>
        <p>{t("Use your recovery code to access your purchase on this device.")}</p>
        <p>{t("You can reuse this code to restore your wallet. Creating a new code replaces it.")}</p>
        {user?.isGuest && <p className={styles.warning}>{t("Save your current wallet's code before switching. Restoring signs out other devices using the restored wallet.")}</p>}
        <form onSubmit={restore}>
          <label htmlFor={`${id}-restore-code`}>{t("Recovery code")}</label>
          <input id={`${id}-restore-code`} type="password" value={input} onChange={event => setInput(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={128} disabled={busy !== null || loading} required/>
          <button type="submit" disabled={busy !== null || loading || !input.trim()}>{t(busy === "restore" ? "Restoring…" : "Restore wallet")}</button>
        </form>
      </>}
      <Link href="/pricing" className={styles.link}>{t("Credit packs")}</Link>
    </div>}
    {error && <p className={styles.error} role="alert">{t(error)}</p>}
  </section>;
}
