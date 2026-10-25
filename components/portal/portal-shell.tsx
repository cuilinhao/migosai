"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AudioLines, BookOpen, ChevronDown, Clapperboard, Compass, FolderOpen, Gem, Home, ImageIcon, LogOut, Menu, Sparkles, Sun, Trophy, WandSparkles, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "@/components/i18n/localized-link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useTranslations } from "@/components/i18n/locale-provider";
import { useAuth } from "@/components/auth-provider";
import { stripLocale } from "@/lib/i18n/routing";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/content/support";
import "./portal.css";

const groups = [
  { label: "", items: [{ label: "Home", href: "/", Icon: Home }] },
  { label: "STUDIO", items: [{ label: "Tools", href: "/tools", Icon: WandSparkles }, { label: "Effects", href: "/effects", Icon: Sparkles }] },
  { label: "MODELS", items: [{ label: "Video", href: "/ai-video-generator", Icon: Clapperboard }, { label: "Image", href: "/ai-image-generator", Icon: ImageIcon }, { label: "Audio", href: "/ai-rap-song-generator", Icon: AudioLines }] },
  { label: "ASSETS", items: [{ label: "Assets", href: "/app/assets", Icon: FolderOpen }] },
  { label: "COMMUNITY", items: [{ label: "Explore", href: "/explore", Icon: Compass }, { label: "Hub", href: "/blog", Icon: BookOpen }] },
];

function navigationIsActive(pathname: string, href: string) {
  const isArticle = pathname === "/ozil-goal-generator/blog" || pathname.startsWith("/ozil-goal-generator/blog/");
  if (href === "/blog" && isArticle) return true;
  if (href === "/explore" && pathname === "/showcases") return true;
  if (href === "/ai-video-generator") return !isArticle && (pathname.startsWith("/hotel-lobby-ai-") || ["/ai-video-generator", "/hotel-lobby-ai-video-generator", "/flying-car-ai-video-generator", "/ozil-goal-generator"].some(route => pathname === route || pathname.startsWith(`${route}/`)));
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalBrand() { return <span className="portal-brand"><Sun size={28} strokeWidth={2.5}/><span>MigosAI</span></span>; }

export function PortalShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const pathname = stripLocale(usePathname());
  const videoWorkspace = pathname === "/ai-video-generator" || pathname.startsWith("/effects/");
  const effectsCatalog = pathname === "/effects";
  const assetsWorkspace = pathname === "/app/assets";
  const { user, credits, loading, openSignIn, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const mobileMore = useRef<HTMLButtonElement>(null);
  useEffect(() => { setMobileOpen(false); setAccountOpen(false); }, [pathname]);
  const navigation = <>
    <Link href="/" aria-label={`MigosAI ${t("Home")}`} className="portal-brand-link" onClick={() => setMobileOpen(false)}><PortalBrand/></Link>
    <nav className="portal-nav" aria-label={t("Main navigation")}>
      {groups.map(group => <div className="portal-nav-group" key={group.label}>{group.label && <small>{t(group.label)}</small>}{group.items.map(({ label, href, Icon }) => <Link key={href} href={href} aria-label={t(label)} aria-current={navigationIsActive(pathname, href) ? "page" : undefined} className={navigationIsActive(pathname, href) ? "active" : ""} onClick={() => setMobileOpen(false)}><Icon size={18}/><span>{t(label)}</span>{label === "Image" && <i className="portal-new">NEW</i>}</Link>)}</div>)}
      <div className="portal-nav-group"><button className="portal-coming" aria-label={`${t("Quests")} · ${t("Coming soon")}`} aria-disabled="true" onClick={() => setNotice(t("Quests are coming soon."))}><Trophy size={18}/><span>{t("Quests")}<small>{t("Coming soon")}</small></span></button></div>
    </nav>
    <div className="portal-sidebar-bottom"><Link href="/pricing" aria-label={t("Pricing")} aria-current={pathname === "/pricing" ? "page" : undefined} className="portal-upgrade"><Gem size={17}/>{t("Pricing")}</Link><LanguageSwitcher compact/></div>
  </>;
  return <div className={`portal-shell${videoWorkspace ? " portal-video-workspace" : ""}${effectsCatalog ? " portal-effects-catalog" : ""}${assetsWorkspace ? " portal-assets-workspace" : ""}`}>
    <aside className="portal-sidebar">{navigation}</aside>
    <header className="portal-mobile-header"><Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}><Dialog.Trigger className="portal-icon-button" aria-label={t("Open menu")}><Menu/></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="portal-drawer-shade"/><Dialog.Content className="portal-drawer" onCloseAutoFocus={event => { if (videoWorkspace && mobileMore.current?.getClientRects().length) { event.preventDefault(); mobileMore.current.focus(); } }}><Dialog.Title className="sr-only">{t("Main navigation")}</Dialog.Title><Dialog.Description className="sr-only">{t("Explore MigosAI tools and creations.")}</Dialog.Description><Dialog.Close className="portal-drawer-close" aria-label={t("Close menu")}><X/></Dialog.Close>{navigation}</Dialog.Content></Dialog.Portal></Dialog.Root><Link href="/"><PortalBrand/></Link></header>
    <div className="portal-content"><div className="portal-account-bar">{user ? <><Link className="portal-credit" href="/app/my-credits"><Gem size={14}/>{t("{count} credits", { count: credits })}</Link><div className="portal-account"><button onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen}><span className="portal-avatar">{user.name.slice(0,1).toUpperCase()}</span><ChevronDown size={14}/></button>{accountOpen && <div className="portal-account-menu"><Link href="/app/assets">{t("My assets")}</Link><Link href="/app/my-orders">{t("My Orders")}</Link><button onClick={async () => { try { await logout(); setAccountOpen(false); } catch { setNotice(t("Could not sign out. Please try again.")); } }}><LogOut size={14}/>{t("Sign Out")}</button></div>}</div></> : <button className="portal-signin" onClick={openSignIn} disabled={loading}>{t(loading ? "Loading…" : "Sign In")}</button>}</div><main>{children}</main>{!assetsWorkspace && (videoWorkspace ? <SupportFooter/> : <PortalFooter/>)}</div>
    {videoWorkspace && <nav className="portal-video-bottom" aria-label={t("Main navigation")}><Link href="/"><Home size={20}/><span>{t("Home")}</span></Link><Link href="/explore"><Compass size={20}/><span>{t("Feed")}</span></Link><button className="portal-video-create" aria-label={t("Create video")} onClick={() => document.getElementById("video-workspace-prompt")?.focus()}><Sparkles size={23}/></button><Link href="/pricing"><Gem size={20}/><span>{t("Pricing")}</span></Link><button ref={mobileMore} onClick={() => setMobileOpen(true)}><Menu size={20}/><span>{t("More")}</span></button></nav>}
    {notice && <div className="portal-toast" role="status">{notice}<button aria-label={t("Close")} onClick={() => setNotice("")}><X size={16}/></button></div>}
  </div>;
}

function PortalFooter() {
  const t = useTranslations();
  return <footer className="portal-footer"><div><PortalBrand/><p>{t("A little inspiration. Endless possibilities.")}</p><span>© {new Date().getFullYear()} MigosAI</span></div><div><b>{t("Create")}</b><Link href="/ai-image-generator">{t("AI Image Generator")}</Link><Link href="/hotel-lobby-ai-video-generator">Hotel Lobby</Link><Link href="/ai-rap-song-generator">{t("AI Music")}</Link></div><div><b>{t("Discover")}</b><Link href="/landing">{t("About MigosAI")}</Link><Link href="/explore">{t("Explore")}</Link><Link href="/blog">{t("Inspiration Hub")}</Link><Link href="/pricing">{t("Pricing")}</Link><Link href="/black-friday">{t("Black Friday 2026")}</Link></div><div><b>{t("Support")}</b><a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a><Link href="/contact">{t("Contact")}</Link><Link href="/privacy-policy">{t("Privacy Policy")}</Link><Link href="/terms-of-service">{t("Terms of Service")}</Link><Link href="/refund-policy">{t("Refund Policy")}</Link><Link href="/acceptable-use-policy">{t("Acceptable Use Policy")}</Link></div></footer>;
}

export function SupportFooter() {
  const t = useTranslations();
  return <footer className="support-footer"><Link href="/contact">{t("Contact support")}</Link><a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a></footer>;
}
