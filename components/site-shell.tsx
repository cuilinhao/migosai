"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { stripLocale } from "@/lib/i18n/routing";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { PortalShell, SupportFooter } from "./portal/portal-shell";
import { CAMPAIGN_BAR_COOKIE, getCampaignBar, type CampaignBarData } from "@/content/home-discovery";

const portalPages = new Set(["/tools", "/effects", "/ai-image-generator", "/ai-video-generator", "/explore"]);

export function SiteShell({ children, campaignBar = null }: { children: React.ReactNode; campaignBar?: CampaignBarData | null }) {
  const pathname = stripLocale(usePathname());
  const [bar, setBar] = useState(campaignBar);
  useEffect(() => {
    if (pathname !== "/") return;
    // Root layouts survive navigation. Recheck dates and dismissals when returning
    // home or resuming a tab, and keep the countdown current in long-lived tabs.
    const update = () => {
      const value = document.cookie.split("; ").find(cookie => cookie.startsWith(`${CAMPAIGN_BAR_COOKIE}=`))?.slice(CAMPAIGN_BAR_COOKIE.length + 1);
      let dismissed: string | null = null;
      try { dismissed = value ? decodeURIComponent(value) : null; } catch { /* Ignore malformed cookies. */ }
      setBar(getCampaignBar(Date.now(), dismissed));
    };
    update();
    const interval = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [pathname, campaignBar]);
  if (pathname === "/") return <div className="hotel-lobby-home" data-campaign-bar={bar ? "" : undefined}><SiteHeader campaignBar={bar} onDismissCampaign={() => setBar(null)}/><main>{children}</main><SiteFooter/></div>;
  const standalone = pathname === "/landing" || pathname === "/sign-in" || pathname === "/sign-up" || pathname === "/app" || pathname.startsWith("/app/");
  if (standalone) return <>{children}{pathname !== "/landing" && <SupportFooter/>}</>;
  return <PortalShell>{(portalPages.has(pathname) || pathname.startsWith("/effects/")) ? children : <div className="portal-inner-page">{children}</div>}</PortalShell>;
}
