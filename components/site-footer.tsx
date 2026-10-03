"use client";

import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { Mail, Github } from "lucide-react";
import { hotelLobbyPages } from "@/content/public-pages";

export function SiteFooter() {
  const t = useTranslations();
  return <footer className="site-footer">
    <div className="footer-inner">
      <div className="footer-top">
        <div className="footer-brand-block">
          <Link className="brand footer-brand" href="/"><img className="brand-logo" src="/logo.png" alt=""/><span>Migos AI</span></Link>
          <p>{t("Migos AI turns two photos into a viral Hotel Lobby–style duo video. Upload your stars, keep the orange booth and hanging mic, and generate a share-ready rap performance for TikTok, Reels, and Shorts.")}</p>
          <div className="social-links"><span aria-hidden="true">𝕏</span><span aria-hidden="true"><Github size={18}/></span><Link href="/privacy-policy#contact-us" aria-label={t("Contact information")}><Mail size={18}/></Link></div>
        </div>
        <div className="footer-col"><h3>{t("Product")}</h3><Link href="/#features">{t("Features")}</Link><Link href="/ai-rap-song-generator">{t("AI Rap Song Generator")}</Link><Link href="/#how-it-works">{t("How It Works")}</Link><Link href="/pricing">{t("Pricing")}</Link></div>
        <div className="footer-col"><h3>Hotel Lobby AI</h3>{hotelLobbyPages.map((page) => <Link key={page.path} href={page.path}>{t(page.label)}</Link>)}</div>
        <div className="footer-col"><h3>{t("Link")}</h3><Link href="/#faq">{t("FAQ")}</Link><Link href="/privacy-policy">{t("Privacy Policy")}</Link><Link href="/terms-of-service">{t("Terms of Service")}</Link></div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} · Migos AI. {t("All rights reserved.")}</div>
    </div>
  </footer>;
}
