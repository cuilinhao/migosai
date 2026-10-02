"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CircleHelp, Clapperboard, Languages, ListChecks, Menu, Music2, X, Zap } from "lucide-react";
import { useAuth } from "./auth-provider";

const links = [
  { label: "How It Works", href: "/#how-it-works", icon: ListChecks },
  { label: "FAQ", href: "/#faq", icon: CircleHelp },
  { label: "Pricing", href: "/pricing", icon: Zap },
  { label: "Showcase", href: "/showcases", icon: Clapperboard },
  { label: "AI Rap Song Generator", href: "/ai-rap-song-generator", icon: Music2 },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, credits, openSignIn, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const close = () => setMenuOpen(false);
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/" onClick={close} aria-label="Migos AI home">
          <img className="brand-logo" src="/logo.png" alt=""/><span>Migos AI</span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {links.map(({ label, href, icon: Icon }) => <Link className={pathname === href ? "active" : ""} href={href} key={label}><Icon size={15} strokeWidth={1.8}/>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <div className="language-control">
            <button className="icon-button" aria-label="Select language" aria-expanded={languageOpen} onClick={() => setLanguageOpen(!languageOpen)}><Languages size={17}/></button>
            {languageOpen && <div className="language-menu"><button onClick={() => setLanguageOpen(false)}>English</button></div>}
          </div>
          {user ? <div className="signed-in-actions"><Link className="credit-badge" href="/app/my-credits">{credits} credits</Link><Link className="sign-in-button account-header-link" href="/app/video-generator">User Center</Link><button className="header-signout" onClick={() => void logout()}>Sign Out</button></div> : <button className="sign-in-button" onClick={openSignIn}>Sign In</button>}
          <button className="mobile-menu-button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button>
        </div>
      </div>
      {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation">{links.map(({ label, href, icon: Icon }) => <Link href={href} key={label} onClick={close}><Icon size={17}/>{label}</Link>)}{user ? <Link href="/app/video-generator" onClick={close}>User Center</Link> : <button onClick={() => { close(); openSignIn(); }}>Sign In</button>}</nav>}
    </header>
  );
}
