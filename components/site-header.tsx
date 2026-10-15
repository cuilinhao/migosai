"use client";

import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { stripLocale } from "@/lib/i18n/routing";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CircleHelp, Clapperboard, ListChecks, Menu, Music2, Newspaper, X, Zap } from "lucide-react";
import { useAuth } from "./auth-provider";
import { GeneratorMenu } from "./generator-menu";

const links = [
  { label: "How It Works", href: "/#how-it-works", icon: ListChecks },
  { label: "FAQ", href: "/#faq", icon: CircleHelp },
  { label: "Pricing", href: "/pricing", icon: Zap },
  { label: "Showcase", href: "/showcases", icon: Clapperboard },
  { label: "AI Rap Song Generator", href: "/ai-rap-song-generator", icon: Music2 },
  { label: "Blog", href: "/blog", icon: Newspaper },
];

const isActive = (pathname: string, href: string) => pathname === href || (href === "/blog" && pathname.startsWith("/blog/"));

export function SiteHeader() {
  const pathname = stripLocale(usePathname());
  const t = useTranslations();
  const { user, credits, openSignIn, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const close = () => setMenuOpen(false);
  useEffect(() => {
    if (!menuOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) { setMenuOpen(false); mobileTrigger.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [menuOpen]);
  const navigationLinks = (mobile = false) => links.map(({ label, href, icon: Icon }) => href === "/ai-rap-song-generator"
    ? <GeneratorMenu key={href} pathname={pathname} mobile={mobile} onNavigate={close}/>
    : <Link className={isActive(pathname, href) ? "active" : ""} aria-current={isActive(pathname, href) ? "page" : undefined} href={href} key={href} onClick={close}><Icon size={mobile ? 17 : 15} strokeWidth={1.8}/>{t(label)}</Link>);
  return (
    <header className="site-header" ref={header}>
      <div className="site-header-inner">
        <Link className="brand" href="/" onClick={close} aria-label={t("LobbyDuo home")}>
          <span className="brand-logo" aria-hidden="true">L</span><span>LobbyDuo</span>
        </Link>
        <nav className="desktop-nav" aria-label={t("Primary navigation")}>
          {navigationLinks()}
        </nav>
        <div className="header-actions">
          <LanguageSwitcher compact />
          {user ? <div className="signed-in-actions"><Link className="credit-badge" href="/app/my-credits">{t("{credits} credits", { credits })}</Link><Link className="sign-in-button account-header-link" href="/app/video-generator">{t("User Center")}</Link><button className="header-signout" onClick={() => void logout()}>{t("Sign Out")}</button></div> : <button className="sign-in-button" onClick={openSignIn}>{t("Sign In")}</button>}
          <button ref={mobileTrigger} className="mobile-menu-button" aria-label={t(menuOpen ? "Close menu" : "Open menu")} aria-expanded={menuOpen} aria-controls="mobile-primary-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button>
        </div>
      </div>
      {menuOpen && <nav id="mobile-primary-navigation" className="mobile-nav" aria-label={t("Mobile navigation")}>{navigationLinks(true)}{user ? <Link href="/app/video-generator" onClick={close}>{t("User Center")}</Link> : <button onClick={() => { close(); openSignIn(); }}>{t("Sign In")}</button>}</nav>}
    </header>
  );
}
