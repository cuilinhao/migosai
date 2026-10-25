"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import { useTranslations } from "@/components/i18n/locale-provider";
import { CampaignLink } from "./campaign-link";
import styles from "./campaign-banner.module.css";

export function CampaignBanner({ placement }: { placement: string }) {
  const t = useTranslations();
  return <aside className={styles.banner} aria-label={t("Black Friday 2026")}>
    <div className={styles.copy}><Sparkles size={22} aria-hidden="true"/><div>
      <span>{t("Black Friday 2026")}</span>
      <strong>{t("More credits for your next idea.")}</strong>
      <p>{t("See the offer, dates and eligible credit packs.")}</p>
    </div></div>
    <CampaignLink href="/black-friday" placement={placement} className={styles.link}>{t("Explore Black Friday")}<ArrowUpRight size={17} aria-hidden="true"/></CampaignLink>
  </aside>;
}
