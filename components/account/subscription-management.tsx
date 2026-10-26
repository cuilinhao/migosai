"use client";

import Link from "@/components/i18n/localized-link";
import { useLocale, useTranslations } from "@/components/i18n/locale-provider";
import { getSubscriptionPlanName } from "@/content/pricing";
import { trustedCheckoutUrl } from "./subscription-portal";
import styles from "./subscription-management.module.css";

export type AccountSubscription = {
  id: string;
  canManage: boolean;
  canCancel: boolean;
  checkoutUrl: string | null;
  planId: string;
  billingInterval: "month" | "year";
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

const statusNames: Record<string,string> = {expired:"Payment expired",pending:"Payment pending",active:"Active",trialing:"Trialing",past_due:"Payment overdue",unpaid:"Unpaid",canceled:"Canceled",incomplete:"Payment incomplete",incomplete_expired:"Payment expired",paused:"Paused"};
function formatDate(value:string|null,locale:string) {
  if(!value)return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale,{dateStyle:"medium"}).format(date);
}

export function SubscriptionDetails({subscription,busy,pendingAction,onManage,onCancel,onRefresh}:{subscription:AccountSubscription|null;busy:boolean;pendingAction?:"manage"|"cancel"|null;onManage:()=>void;onCancel:()=>void;onRefresh:()=>void}) {
  const t=useTranslations();const locale=useLocale();
  if(!subscription)return <div className={styles.empty}><p>{t("You do not have a subscription.")}</p><Link href="/pricing">{t("View plans")}</Link></div>;
  const pending = subscription.status === "pending";
  const closedCheckout = subscription.status === "expired";
  const checkoutUrl = pending ? trustedCheckoutUrl(subscription.checkoutUrl) : null;
  const renewing = !subscription.cancelAtPeriodEnd && ["active","trialing"].includes(subscription.status);
  const dateLabel = subscription.cancelAtPeriodEnd ? "Access until" : renewing ? "Next renewal" : "Current period ends";
  return <div>
    <dl className={styles.details}><div><dt>{t("Plan")}</dt><dd>{t(getSubscriptionPlanName(subscription.planId))}</dd></div><div><dt>{t("Billing interval")}</dt><dd>{t(subscription.billingInterval==="year"?"Annual billing":"Monthly billing")}</dd></div><div><dt>{t("Status")}</dt><dd>{t(statusNames[subscription.status]??subscription.status)}</dd></div>{!pending&&!closedCheckout&&<div><dt>{t(dateLabel)}</dt><dd>{formatDate(subscription.currentPeriodEnd,locale)}</dd></div>}</dl>
    {pending&&<p className={styles.note}>{t(checkoutUrl?"Payment has not been completed. Your subscription starts after payment is confirmed.":"Payment is being confirmed. If you have already paid, refresh to check your subscription.")}</p>}
    {closedCheckout&&<p className={styles.note}>{t("This payment is closed. Your subscription did not start.")}</p>}
    {subscription.cancelAtPeriodEnd&&<p className={styles.note}>{t("Renewal is canceled. Access continues until the end of your paid period.")}</p>}
    {!pending&&!closedCheckout&&<p className={styles.note}>{t("Subscription credits are issued monthly, including annual plans. Unused subscription credits expire each month and are spent before permanent credits.")}</p>}
    {!pending&&subscription.canCancel&&<p className={styles.note}>{t("Confirm cancellation in Stripe. Your access continues until the end of your paid period.")}</p>}
    <div className={styles.actions}>
      {closedCheckout&&<Link className={styles.manage} href="/pricing">{t("View plans")}</Link>}
      {pending&&!checkoutUrl&&<button type="button" className={styles.manage} disabled={busy} onClick={onRefresh}>{t("Refresh status")}</button>}
      {checkoutUrl&&<a className={styles.manage} href={busy?undefined:checkoutUrl} aria-disabled={busy||undefined} tabIndex={busy?-1:undefined} target="_blank" rel="noopener noreferrer">{t("Continue payment")}</a>}
      {!pending&&subscription.canManage&&<button type="button" className={styles.manage} disabled={busy} onClick={onManage}>{t(pendingAction==="manage"?"Opening subscription management…":"Manage subscription")}</button>}
      {subscription.canCancel&&<button type="button" className={styles.cancel} disabled={busy} onClick={onCancel}>{t(pendingAction==="cancel"?(pending?"Canceling pending payment…":"Opening cancellation confirmation…"):(pending?"Cancel pending payment":"Cancel subscription"))}</button>}
    </div>
  </div>;
}

export function CreditBalances({permanentCredits,subscriptionCredits,subscriptionCreditsExpireAt}:{permanentCredits:number;subscriptionCredits:number;subscriptionCreditsExpireAt:string|null}) {
  const t=useTranslations();const locale=useLocale();
  return <section className={styles.balances} aria-label={t("Credit balances")}><dl className={styles.details}><div><dt>{t("Permanent credits")}</dt><dd>{permanentCredits.toLocaleString(locale)}</dd></div><div><dt>{t("Subscription credits")}</dt><dd>{subscriptionCredits.toLocaleString(locale)}</dd></div>{subscriptionCreditsExpireAt&&<div><dt>{t("Subscription credits expire")}</dt><dd>{formatDate(subscriptionCreditsExpireAt,locale)}</dd></div>}</dl><p className={styles.note}>{t("Subscription credits are spent first and expire monthly. Your permanent credit balance is kept.")}</p></section>;
}
