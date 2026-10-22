"use client";

import Link from "@/components/i18n/localized-link";
import { useLocale, useTranslations } from "@/components/i18n/locale-provider";
import { subscriptionPlans } from "@/content/pricing";
import styles from "./subscription-management.module.css";

export type AccountSubscription = {
  planId: string;
  billingInterval: "month" | "year";
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

const statusNames: Record<string,string> = {active:"Active",trialing:"Trialing",past_due:"Payment overdue",unpaid:"Unpaid",canceled:"Canceled",incomplete:"Payment incomplete",incomplete_expired:"Payment expired",paused:"Paused"};
function formatDate(value:string|null,locale:string) {
  if(!value)return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale,{dateStyle:"medium"}).format(date);
}

export function SubscriptionDetails({subscription,busy,onManage}:{subscription:AccountSubscription|null;busy:boolean;onManage:()=>void}) {
  const t=useTranslations();const locale=useLocale();
  if(!subscription)return <div className={styles.empty}><p>{t("You do not have a subscription.")}</p><Link href="/pricing">{t("View plans")}</Link></div>;
  const renewing = !subscription.cancelAtPeriodEnd && ["active","trialing"].includes(subscription.status);
  const dateLabel = subscription.cancelAtPeriodEnd ? "Access until" : renewing ? "Next renewal" : "Current period ends";
  return <div>
    <dl className={styles.details}><div><dt>{t("Plan")}</dt><dd>{t(subscriptionPlans.find(plan=>plan.id===subscription.planId)?.name??subscription.planId)}</dd></div><div><dt>{t("Billing interval")}</dt><dd>{t(subscription.billingInterval==="year"?"Annual billing":"Monthly billing")}</dd></div><div><dt>{t("Status")}</dt><dd>{t(statusNames[subscription.status]??subscription.status)}</dd></div><div><dt>{t(dateLabel)}</dt><dd>{formatDate(subscription.currentPeriodEnd,locale)}</dd></div></dl>
    {subscription.cancelAtPeriodEnd&&<p className={styles.note}>{t("Renewal is canceled. Access continues until the end of your paid period.")}</p>}
    <p className={styles.note}>{t("Subscription credits are issued monthly, including annual plans. Unused subscription credits expire each month and are spent before permanent credits.")}</p>
    <button type="button" className={styles.manage} disabled={busy} onClick={onManage}>{t(busy?"Opening subscription management…":"Manage subscription")}</button>
  </div>;
}

export function CreditBalances({permanentCredits,subscriptionCredits,subscriptionCreditsExpireAt}:{permanentCredits:number;subscriptionCredits:number;subscriptionCreditsExpireAt:string|null}) {
  const t=useTranslations();const locale=useLocale();
  return <section className={styles.balances} aria-label={t("Credit balances")}><dl className={styles.details}><div><dt>{t("Permanent credits")}</dt><dd>{permanentCredits.toLocaleString(locale)}</dd></div><div><dt>{t("Subscription credits")}</dt><dd>{subscriptionCredits.toLocaleString(locale)}</dd></div>{subscriptionCreditsExpireAt&&<div><dt>{t("Subscription credits expire")}</dt><dd>{formatDate(subscriptionCreditsExpireAt,locale)}</dd></div>}</dl><p className={styles.note}>{t("Subscription credits are spent first and expire monthly. Your permanent credit balance is kept.")}</p></section>;
}
