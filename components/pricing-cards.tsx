"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Check, Diamond, ShieldCheck, Zap } from "lucide-react";
import { creditPacks, subscriptionPlans, type PackId, type SubscriptionPlanId, type BillingInterval } from "@/content/pricing";
import { useAuth } from "./auth-provider";
import { useLocale, useTranslations } from "@/components/i18n/locale-provider";
import { trustedCheckoutUrl } from "./ui/checkout-url";
import { blackFridayCampaign, getCreditPackOffer } from "@/content/black-friday-offer";
import styles from "./pricing-cards.module.css";
import { GuestWalletPanel } from "./guest-wallet-panel";

type Purchase = { packId: PackId } | { purchaseType: "subscription"; planId: SubscriptionPlanId; billingInterval: BillingInterval };
type PurchaseTab = "subscription" | "packs";

export function PricingCards({ initialPurchaseType = "packs", offerTime = 0 }: { initialPurchaseType?: PurchaseTab; offerTime?: number } = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const { user, openSignIn, ensureGuest } = useAuth();
  const id = useId();
  const [tab, setTab] = useState<PurchaseTab>(initialPurchaseType);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [selectedPack, setSelectedPack] = useState<PackId>("creator");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>("standard");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ userId: string | undefined; message: string } | null>(null);
  const [checkout, setCheckout] = useState<{ userId: string; url: string } | null>(null);
  const inFlight = useRef(false);
  const currentUserId = useRef(user?.id);
  const mounted = useRef(true);
  currentUserId.current = user?.id;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const money = (cents: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(cents / 100);

  function clearNotice() { setError(null); setCheckout(null); }
  function selectPurchase(purchase: Purchase) {
    if (inFlight.current) return;
    clearNotice();
    if ("packId" in purchase) setSelectedPack(purchase.packId);
    else setSelectedPlan(purchase.planId);
  }
  function cardClick(event: MouseEvent<HTMLElement>, purchase: Purchase) {
    // Child controls handle their own actions; card selection must not clear a checkout they open.
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea, label, [role=button]")) return;
    selectPurchase(purchase);
  }
  function changeTab(next: PurchaseTab) { if (!inFlight.current) { clearNotice(); setTab(next); } }
  function changeInterval(next: BillingInterval) { if (!inFlight.current) { clearNotice(); setInterval(next); } }
  function tabKeyDown(event: KeyboardEvent<HTMLButtonElement>, next: PurchaseTab) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || inFlight.current) return;
    event.preventDefault();
    const target = event.key === "Home" ? "subscription" : event.key === "End" ? "packs" : next;
    changeTab(target);
    document.getElementById(`${id}-${target}-tab`)?.focus();
  }

  async function buy(purchase: Purchase) {
    if (inFlight.current) return;
    selectPurchase(purchase);
    if (!("packId" in purchase) && (!user || user.isGuest)) { openSignIn(); return; }
    let userId = user?.id;
    const key = "packId" in purchase ? `pack-${purchase.packId}` : `plan-${purchase.planId}`;
    inFlight.current = true;
    setBusy(key);
    try {
      const buyer = user ?? await ensureGuest();
      if (!mounted.current || (currentUserId.current !== userId && currentUserId.current !== buyer.id)) return;
      userId = buyer.id;
      currentUserId.current = userId;
      const pack = "packId" in purchase ? creditPacks.find(item => item.id === purchase.packId) : undefined;
      const plan = "planId" in purchase ? subscriptionPlans.find(item => item.id === purchase.planId) : undefined;
      const quote = pack ? { expectedCredits: getCreditPackOffer(pack, offerTime).credits }
        : plan && "billingInterval" in purchase ? { expectedCredits: plan.credits, expectedAmountCents: purchase.billingInterval === "year" ? plan.yearlyPriceCents : plan.monthlyPriceCents } : {};
      const response = await fetch("/api/checkout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...purchase, locale, ...quote, expectedUserId: userId }) });
      const data: { checkoutUrl?: string; buyerId?: string; error?: string } = await response.json();
      if (!mounted.current || currentUserId.current !== userId) return;
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "Checkout is unavailable right now. Please try again later.");
      if (data.buyerId && data.buyerId !== userId) throw new Error("Your wallet changed. Refresh this page before checking out.");
      const url = trustedCheckoutUrl(data.checkoutUrl);
      if (!url) throw new Error("The payment service returned an invalid checkout address. Please try again later.");
      setCheckout({ userId, url });
      // Keep a direct link even if the browser blocks the asynchronous popup.
      try { window.open(url, "_blank", "noopener,noreferrer"); } catch { /* The link below remains available. */ }
    } catch (cause) {
      if (mounted.current && currentUserId.current === userId) setError({ userId, message: cause instanceof Error ? cause.message : "Checkout is unavailable right now. Please try again later." });
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  const benefits = ["Use across image, video and music tools", "No added watermark", "Download and organize your creations"];

  return <div className={styles.pricing}>
    <div className={styles.controls}>
      <div className={styles.tabs} role="tablist" aria-label={t("Purchase type")}>
        <button type="button" id={`${id}-subscription-tab`} role="tab" aria-selected={tab === "subscription"} aria-controls={`${id}-subscription-panel`} tabIndex={tab === "subscription" ? 0 : -1} disabled={busy !== null} onKeyDown={event => tabKeyDown(event, "packs")} onClick={() => changeTab("subscription")}><Diamond size={17} aria-hidden="true"/>{t("Subscription")}</button>
        <button type="button" id={`${id}-packs-tab`} role="tab" aria-selected={tab === "packs"} aria-controls={`${id}-packs-panel`} tabIndex={tab === "packs" ? 0 : -1} disabled={busy !== null} onKeyDown={event => tabKeyDown(event, "subscription")} onClick={() => changeTab("packs")}><Zap size={17} aria-hidden="true"/>{t("Credit packs")}</button>
      </div>
      {tab === "subscription" && <div className={styles.billing} role="group" aria-label={t("Billing interval")}>
        <button type="button" aria-pressed={interval === "month"} disabled={busy !== null} onClick={() => changeInterval("month")}>{t("Monthly")}</button>
        <button type="button" aria-pressed={interval === "year"} disabled={busy !== null} onClick={() => changeInterval("year")}>{t("Yearly")}</button>
        <span>{t("Save 10%")}</span>
      </div>}
    </div>

    <div id={`${id}-subscription-panel`} role="tabpanel" aria-labelledby={`${id}-subscription-tab`} hidden={tab !== "subscription"} tabIndex={0}>
      {tab === "subscription" && <>
        <div className={styles.grid}>{subscriptionPlans.map(plan => {
          const monthlyCents = interval === "year" ? plan.yearlyPriceCents / 12 : plan.monthlyPriceCents;
          const selected = selectedPlan === plan.id;
          const purchase = { purchaseType: "subscription" as const, planId: plan.id, billingInterval: interval };
          return <article key={plan.id} className={`${styles.card} ${selected ? styles.featured : ""}`} data-selected={selected} onClick={event => cardClick(event, purchase)}>
            {interval !== "year" && plan.id === "standard" && <span className={styles.discount}>{t("Recommended")}</span>}
            {interval === "year" && <span className={styles.discount}>{t("{percent}% OFF", { percent: Math.round((1 - plan.yearlyPriceCents / (12 * plan.monthlyPriceCents)) * 100) })}</span>}
            <h3 className={styles.planTitle}><button type="button" className={styles.cardSelect} aria-pressed={selected} disabled={busy !== null} onClick={() => selectPurchase(purchase)}><Diamond size={23} aria-hidden="true"/>{t(plan.name)}</button></h3>
            <div className={styles.price}>{interval === "year" && <del>{money(plan.monthlyPriceCents)}</del>}<strong>{money(monthlyCents)}</strong><span>{t("/mo")}</span></div>
            <p className={styles.billingNote}>{interval === "year" ? t("{amount} billed yearly", { amount: money(plan.yearlyPriceCents) }) : t("Billed monthly")}</p>
            <button type="button" className={styles.subscribe} aria-label={t("Subscribe to {plan}", { plan: t(plan.name) })} disabled={busy !== null} onClick={() => buy(purchase)}>{busy === `plan-${plan.id}` ? t("Opening checkout…") : t("Subscribe")}</button>
            <div className={styles.creditBox}><Zap size={19} aria-hidden="true"/><div><strong>{t("{credits} credits per month", { credits: plan.credits.toLocaleString(locale) })}</strong><span>{t("Up to {images} images at 1K", { images: Math.floor(plan.credits / 5).toLocaleString(locale) })}</span></div></div>
            <ul className={styles.benefits}>{["New credits every month", "Unused subscription credits expire monthly", ...benefits].map(benefit => <li key={benefit}><Check size={16} aria-hidden="true"/>{t(benefit)}</li>)}</ul>
            <p className={styles.cardFooter}>{t("Cancel renewal anytime. Access continues through your paid term.")}</p>
          </article>;
        })}</div>
        <p className={styles.explanation}>{t("Subscriptions renew automatically. Annual plans are billed once per year and credits are issued monthly, not all at once.")}<br/>{t("Subscription credits are used first and expire each month. Your one-time credit balance is kept separately.")}</p>
      </>}
    </div>

    <div id={`${id}-packs-panel`} role="tabpanel" aria-labelledby={`${id}-packs-tab`} hidden={tab !== "packs"} tabIndex={0}>
      {tab === "packs" && <>
        <div className={styles.grid}>{creditPacks.map(pack => {
          const offer = getCreditPackOffer(pack, offerTime);
          const selected = selectedPack === pack.id;
          const packName = t("{credits} credit pack", { credits: pack.credits.toLocaleString(locale) });
          return <article className={`${styles.card} ${selected ? styles.featured : ""}`} data-selected={selected} key={pack.id} onClick={event => cardClick(event, { packId: pack.id })}>
          {(offer.bonusCredits > 0 || pack.recommended) && <span className={styles.discount}>{offer.bonusCredits > 0 ? t("{percent}% bonus credits", { percent: blackFridayCampaign.bonusPercent }) : t("Recommended")}</span>}
          <h3 className={styles.planTitle}><button type="button" className={styles.cardSelect} aria-pressed={selected} disabled={busy !== null} onClick={() => selectPurchase({ packId: pack.id })}><Zap size={23} aria-hidden="true"/>{packName}</button></h3>
          <div className={styles.price}><strong>{money(pack.amountCents)}</strong></div>
          <p className={styles.billingNote}>{t("One-time purchase")}</p>
          <button type="button" className={styles.subscribe} disabled={busy !== null} onClick={() => buy({ packId: pack.id })}>{busy === `pack-${pack.id}` ? t("Opening checkout…") : t("Buy {pack}", { pack: packName })}</button>
          <div className={styles.creditBox}><Zap size={19} aria-hidden="true"/><div><strong>{t("{credits} credits", { credits: offer.credits.toLocaleString(locale) })}</strong>{offer.bonusCredits > 0 && <span>{t("{base} + {bonus} bonus credits", { base: offer.baseCredits.toLocaleString(locale), bonus: offer.bonusCredits.toLocaleString(locale) })}</span>}<span>{t("${price} / credit", { price: (pack.amountCents / 100 / offer.credits).toFixed(4) })}</span></div></div>
          <ul className={styles.benefits}>{["No automatic renewal", "Credits never expire", ...benefits].map(benefit => <li key={benefit}><Check size={16} aria-hidden="true"/>{t(benefit)}</li>)}</ul>
          <p className={styles.cardFooter}>{t(pack.description)}</p>
        </article>; })}</div>
        <p className={styles.explanation}>{t("Credit packs are one-time purchases. You can buy a pack with or without an active subscription.")}<br/>{t("Buy and use credits without signing in or registering.")}</p>
        <GuestWalletPanel compact/>
      </>}
    </div>

    <div className={styles.secure}><ShieldCheck size={17} aria-hidden="true"/>{t("Secure checkout by Stripe")}</div>
    <p className={styles.costNote}>{t("USD prices. Any applicable taxes are shown at checkout.")}<br/>{t("Nano Banana 2: 1K uses 5 credits, 2K uses 8, and 4K uses 12. Video and music costs depend on your generation settings.")}</p>
    {checkout?.userId === user?.id && checkout && <div className="mi-checkout-return" role="status"><strong>{t("Checkout ready")}</strong><p>{t("If a new tab did not open, use the secure link below to continue your purchase.")}</p><a href={checkout.url} target="_blank" rel="noopener noreferrer">{t("Continue to Stripe checkout (opens in a new tab)")}</a></div>}
    {error?.userId === user?.id && error && <p className="pricing-error" role="alert">{t(error.message)}</p>}
  </div>;
}
