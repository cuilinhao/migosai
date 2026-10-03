"use client";

import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { stripLocale } from "@/lib/i18n/routing";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CircleHelp, Clapperboard, ListChecks, Menu, Music2, X, Zap } from "lucide-react";
import { useAuth } from "./auth-provider";

const links = [
  { label: "How It Works", href: "/#how-it-works", icon: ListChecks },
  { label: "FAQ", href: "/#faq", icon: CircleHelp },
  { label: "Pricing", href: "/pricing", icon: Zap },
  { label: "Showcase", href: "/showcases", icon: Clapperboard },
  { label: "AI Rap Song Generator", href: "/ai-rap-song-generator", icon: Music2 },
];

export function SiteHeader() {
  const pathname = stripLocale(usePathname());
  const t = useTranslations();
  const { user, credits, openSignIn, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/" onClick={close} aria-label={t("Migos AI home")}>
          <img className="brand-logo" src="/logo.png" alt=""/><span>Migos AI</span>
        </Link>
        <nav className="desktop-nav" aria-label={t("Primary navigation")}>
          {links.map(({ label, href, icon: Icon }) => <Link className={pathname === href ? "active" : ""} href={href} key={label}><Icon size={15} strokeWidth={1.8}/>{t(label)}</Link>)}
        </nav>
        <div className="header-actions">
          <LanguageSwitcher compact />
          {user ? <div className="signed-in-actions"><Link className="credit-badge" href="/app/my-credits">{t("{credits} credits", { credits })}</Link><Link className="sign-in-button account-header-link" href="/app/video-generator">{t("User Center")}</Link><button className="header-signout" onClick={() => void logout()}>{t("Sign Out")}</button></div> : <button className="sign-in-button" onClick={openSignIn}>{t("Sign In")}</button>}
          <button className="mobile-menu-button" aria-label={t(menuOpen ? "Close menu" : "Open menu")} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button>
        </div>
      </div>
      {menuOpen && <nav className="mobile-nav" aria-label={t("Mobile navigation")}>{links.map(({ label, href, icon: Icon }) => <Link href={href} key={label} onClick={close}><Icon size={17}/>{t(label)}</Link>)}{user ? <Link href="/app/video-generator" onClick={close}>{t("User Center")}</Link> : <button onClick={() => { close(); openSignIn(); }}>{t("Sign In")}</button>}</nav>}
    </header>
  );
}
