"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { pollSubscriptionChange, type SubscriptionChangePollResult } from "./subscription-change-poll";

type ReturnStatus = Exclude<SubscriptionChangePollResult, "cancelled"> | "pending";

export function SubscriptionChangeReturnStatus() {
  const { user, loading, refresh, openSignIn } = useAuth();
  const t = useTranslations();
  const ownerId = user && !user.isGuest ? user.id : null;
  const owner = useRef(ownerId);
  owner.current = ownerId;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ ownerId: string; attempt: number; status: ReturnStatus } | null>(null);

  useEffect(() => {
    if (loading || !ownerId) return;
    const controller = new AbortController();
    setResult({ ownerId, attempt, status: "pending" });
    void pollSubscriptionChange({ signal: controller.signal, refresh, isCurrent: () => owner.current === ownerId }).then(status => {
      if (!controller.signal.aborted && owner.current === ownerId && status !== "cancelled") setResult({ ownerId, attempt, status });
    });
    return () => controller.abort();
    // Account refresh replaces user objects; only a different owner restarts polling.
  }, [ownerId, loading, refresh, attempt]);

  if (!loading && !ownerId) return <div className="mi-checkout-return" role="status"><strong>{t("Sign in to check your subscription update.")}</strong><button type="button" onClick={openSignIn}>{t("Sign In")}</button></div>;
  const status = result?.ownerId === ownerId && result.attempt === attempt ? result.status : "pending";
  return <div className="mi-checkout-return" role="status" aria-live="polite">
    <strong>{t(status === "settled" ? "Subscription status updated" : status === "pending" ? "Checking your subscription update…" : "Your subscription update could not be confirmed yet.")}</strong>
    <p>{t(status === "settled" ? "Your account balance has been refreshed." : "We are checking your subscription and credits. You can also review them in My Orders.")}</p>
    {(status === "error" || status === "delayed") && <button type="button" onClick={() => setAttempt(value => value + 1)}>{t("Retry")}</button>}
    <Link href="/app/my-orders#subscription">{t("Manage subscription")}</Link>
  </div>;
}
