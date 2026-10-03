"use client";

import { useState } from "react";
import { creditPacks, type PackId } from "@/content/pricing";
import { useAuth } from "./auth-provider";
import { useLocale, useTranslations } from "@/components/i18n/locale-provider";
import { trustedCheckoutUrl } from "./ui/checkout-url";
import { getVideoCost } from "@/lib/video-options";

const estimateVideoCredits = getVideoCost(5, "480p", "wan-3.0");

export function PricingCards() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, openSignIn } = useAuth();
  const [busy, setBusy] = useState<PackId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  async function buy(packId: PackId) {
    setError(null);
    setCheckoutUrl(null);
    if (!user) { openSignIn(); return; }
    setBusy(packId);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId, locale }) });
      const data: { checkoutUrl?: string; error?: string } = await response.json();
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "Checkout is unavailable right now. Please try again later.");
      const url = trustedCheckoutUrl(data.checkoutUrl);
      if (!url) {
        throw new Error("The payment service returned an invalid checkout address. Please try again later.");
      }
      setCheckoutUrl(url);
      // Some browsers block async popups; noopener can also return null after
      // opening successfully. Always keep a direct link to the same checkout.
      try { window.open(url, "_blank", "noopener,noreferrer"); } catch { /* The direct link remains available. */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout is unavailable right now. Please try again later.");
    } finally {
      setBusy(null);
    }
  }

  return <div>
    <div className="pricing-grid">{creditPacks.map((pack) => <article className={`pricing-card ${pack.recommended ? "recommended" : ""}`} key={pack.id}>
      <div className="pricing-card-top"><h3>{t(pack.name)}</h3>{pack.recommended && <span className="recommended-badge">{t("Recommended")}</span>}</div>
      <div className="price">${pack.price.toFixed(2)}</div><p className="unit-price">{t("${price} / credit", { price: pack.unitPrice })}</p>
      <div className="credit-summary"><strong>{t("{credits} credits", { credits: pack.credits.toLocaleString(locale) })}</strong><span>{t("About {videos} Wan 3.0 template videos (5 seconds, 480p)", { videos: Math.floor(pack.credits / estimateVideoCredits) })}</span></div>
      <ul className="pack-inclusions"><li><b>{t("Included")}</b> {t("{credits} credits", { credits: pack.credits.toLocaleString(locale) })}</li><li><b>{t("Included")}</b> {t("AI Rap Song Generator")}</li><li><b>{t("Included")}</b> {t("No added watermark")}</li><li><b>{t("Included")}</b> {t(pack.description)}</li></ul>
      <button className="buy-button" disabled={busy !== null} onClick={() => void buy(pack.id)}>{busy === pack.id ? t("Opening checkout…") : t("Buy {pack}", { pack: t(pack.name) })}</button>
    </article>)}</div>
    <p className="pricing-payment-note">{t("Estimates use {credits} credits per Wan template video. Other models, settings, and reference durations change the cost.", { credits: estimateVideoCredits })}<br/>{t("Secure checkout by Stripe. One-time purchase. No subscription.")}</p>
    {checkoutUrl && <div className="mi-checkout-return" role="status"><strong>{t("Checkout ready")}</strong><p>{t("If a new tab did not open, use the secure link below to continue your purchase.")}</p><a href={checkoutUrl} target="_blank" rel="noopener noreferrer">{t("Continue to Stripe checkout (opens in a new tab)")}</a></div>}
    {error && <p className="pricing-error" role="alert">{t(error)}</p>}
  </div>;
}
