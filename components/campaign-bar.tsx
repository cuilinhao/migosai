"use client";

import { ArrowUpRight, Clock3, Sparkles, X } from "lucide-react";
import Link from "@/components/i18n/localized-link";
import { useLocale, useTranslations } from "@/components/i18n/locale-provider";
import { localeTags } from "@/lib/i18n/routing";
import { CAMPAIGN_BAR_COOKIE, campaignBarCookieValue, daysUntil, type CampaignBarData } from "@/content/home-discovery";

/**
 * Time-limited announcement rendered inside the homepage <header> landmark.
 * It is site chrome, not page content: no headings, `data-nosnippet`, and a fixed height
 * that the header and the hero spacing already account for, so it never shifts the layout.
 */
export function CampaignBar({ bar, onDismiss }: { bar: CampaignBarData; onDismiss: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const date = (value: number) => new Intl.DateTimeFormat(localeTags[locale], { month: "short", day: "numeric", timeZone: "UTC" }).format(value);
  const start = date(Date.parse(bar.startsAt));
  const end = date(Date.parse(bar.endsAt) - 1);
  const active = bar.state === "active";
  const days = daysUntil(active ? bar.endsAt : bar.startsAt, bar.now);
  const countdown = active
    ? days <= 1 ? t("Last day") : t("{count} days left", { count: days })
    : days <= 1 ? t("Starts tomorrow") : t("Starts in {count} days", { count: days });
  const message = active
    ? t("+{percent}% bonus credits on one-time credit packs, now through {end}.", { percent: bar.bonusPercent, end })
    : t("+{percent}% bonus credits on one-time credit packs, {start} – {end}.", { percent: bar.bonusPercent, start, end });
  const dismiss = () => {
    document.cookie = `${CAMPAIGN_BAR_COOKIE}=${encodeURIComponent(campaignBarCookieValue(bar))}; Path=/; Max-Age=${60 * 60 * 24 * 45}; SameSite=Lax`;
    onDismiss();
  };
  return <div className="campaign-bar" data-nosnippet="" data-state={bar.state}>
    <div className="campaign-bar-inner">
      <span className="campaign-bar-tag"><Sparkles size={13} aria-hidden="true"/><span>{t(bar.title)}</span></span>
      <span className="campaign-bar-message">{message}</span>
      <span className="campaign-bar-short">{t("+{percent}% bonus credits", { percent: bar.bonusPercent })}</span>
      <span className="campaign-bar-count"><Clock3 size={12} aria-hidden="true"/>{countdown}</span>
      <Link className="campaign-bar-link" href={bar.path}>{t(active ? "Get the offer" : "See the offer")}<ArrowUpRight size={14} aria-hidden="true"/></Link>
    </div>
    <button type="button" className="campaign-bar-close" onClick={dismiss} aria-label={t("Dismiss announcement")}><X size={16} aria-hidden="true"/></button>
  </div>;
}
