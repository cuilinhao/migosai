"use client";

import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { Mail, Github } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/content/support";
import { hotelLobbyPages } from "@/content/public-pages";

export function SiteFooter() {
  const t = useTranslations();
  return <footer className="site-footer">
    <div className="footer-inner">
      <div className="footer-top">
        <div className="footer-brand-block">
          <Link className="brand footer-brand" href="/"><span className="brand-logo" aria-hidden="true">L</span><span>LobbyDuo</span></Link>
          <p>{t("LobbyDuo creates AI duo performances from photos you have permission to use. Make a video for TikTok, Reels, and Shorts, and follow the sharing platform’s AI-labeling rules.")}</p>
          <div className="social-links"><span aria-hidden="true">𝕏</span><span aria-hidden="true"><Github size={18}/></span><a href={SUPPORT_MAILTO} aria-label={t("Contact information")}><Mail size={18}/></a></div>
        </div>
        <div className="footer-col"><h3>{t("Product")}</h3><Link href="/#features">{t("Features")}</Link><Link href="/ai-rap-song-generator">{t("AI Rap Song Generator")}</Link><Link href="/#how-it-works">{t("How It Works")}</Link><Link href="/pricing">{t("Pricing")}</Link></div>
        <div className="footer-col"><h3>Hotel Lobby AI</h3>{hotelLobbyPages.map((page) => <Link key={page.path} href={page.path}>{t(page.label)}</Link>)}</div>
        <div className="footer-col"><h3>{t("Link")}</h3><Link href="/#faq">{t("FAQ")}</Link><Link href="/privacy-policy">{t("Privacy Policy")}</Link><Link href="/terms-of-service">{t("Terms of Service")}</Link><Link href="/refund-policy">{t("Refund Policy")}</Link><Link href="/acceptable-use-policy">{t("Acceptable Use Policy")}</Link><a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a></div>
      </div>
      <p className="footer-bottom">{t("LobbyDuo is an independent AI creation service and is not affiliated with or endorsed by Migos, Quavo, Takeoff, or COLORS.")}</p>
      <div className="footer-bottom">© {new Date().getFullYear()} · LobbyDuo. {t("All rights reserved.")}</div>
    </div>
  </footer>;
}
