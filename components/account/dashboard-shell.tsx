"use client";

import Link from "@/components/i18n/localized-link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CreditCard, FolderOpen, ImageIcon, History, House, List, LogOut, Menu, Sun, Video, X } from "lucide-react";
import { useTranslations, useLocale } from "@/components/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { localizeHref, stripLocale } from "@/lib/i18n/routing";
import { useAuth } from "@/components/auth-provider";
import styles from "./dashboard-shell.module.css";

const routes = [
  { href: "/app/video-generator", label: "Generate Video", Icon: Video },
  { href: "/ai-image-generator", label: "AI Image Generator", Icon: ImageIcon },
  { href: "/app/assets", label: "My assets", Icon: FolderOpen },
  { href: "/app/my-videos", label: "My Videos", Icon: History },
  { href: "/app/my-orders", label: "My Orders", Icon: List },
  { href: "/app/my-credits", label: "My Credits", Icon: CreditCard },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, openSignIn, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const mobileToggle=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!mobileOpen)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMobileOpen(false);mobileToggle.current?.focus();}};
    window.addEventListener('keydown',escape);
    return()=>window.removeEventListener('keydown',escape);
  },[mobileOpen]);
  const signOut = async () => { try { await logout(); router.push(localizeHref("/", locale)); } catch { /* The account remains visible if the request fails. */ } };
  return <div className={`dashboard-shell ${styles.shell}`}>
    <button ref={mobileToggle} className="dashboard-mobile-toggle" aria-label={t(mobileOpen ? "Close account menu" : "Open account menu")} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={19}/> : <Menu size={19}/>}</button>
    {mobileOpen && <button className="dashboard-mobile-shade" aria-label={t("Close account menu")} onClick={() => setMobileOpen(false)}/>}
    <aside className={`dashboard-sidebar ${mobileOpen ? "open" : ""}`}>
      <button type="button" className="dashboard-menu-close" aria-label={t("Close account menu")} onClick={()=>{setMobileOpen(false);mobileToggle.current?.focus();}}><X size={18}/></button>
      <Link className="dashboard-brand" href="/app/video-generator" onClick={() => setMobileOpen(false)}><Sun size={28} strokeWidth={2.5} aria-hidden="true"/><span>MigosAI</span></Link>
      <nav className="dashboard-nav" aria-label={t("Account navigation")}>{routes.map(({ href, label, Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={stripLocale(pathname) === href ? "page" : undefined} className={stripLocale(pathname) === href ? "active" : ""}><Icon size={16}/><span>{t(label)}</span></Link>)}</nav>
      <div className="dashboard-sidebar-bottom">
        <LanguageSwitcher />
        {user ? <div className="dashboard-profile"><button onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}>{user.picture ? <img src={user.picture} alt=""/> : <span className="dashboard-avatar">{user.name.slice(0,1).toUpperCase()}</span>}<span className="dashboard-profile-details"><b>{user.name}</b><small>{user.email}</small></span><span className="profile-chevron">⌃</span></button>{profileOpen && <button className="dashboard-signout" onClick={() => void signOut()}><LogOut size={15}/> {t("Sign Out")}</button>}</div> : <button className="dashboard-login" onClick={openSignIn}>{t(loading ? "Loading…" : "Sign In")}</button>}
        <Link className="dashboard-home" href="/" aria-label={t("Home")}><House size={18}/></Link>
      </div>
    </aside>
    <main className="dashboard-main"><div className="dashboard-panel">{children}</div></main>
  </div>;
}
