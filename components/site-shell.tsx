"use client";

import { usePathname } from "next/navigation";
import { stripLocale } from "@/lib/i18n/routing";
import { PortalShell } from "./portal/portal-shell";

const portalPages = new Set(["/", "/tools", "/effects", "/ai-image-generator", "/ai-video-generator", "/explore"]);

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = stripLocale(usePathname());
  const standalone = pathname === "/landing" || pathname === "/sign-in" || pathname === "/sign-up" || pathname === "/app" || pathname.startsWith("/app/");
  if (standalone) return <>{children}</>;
  return <PortalShell>{(portalPages.has(pathname) || pathname.startsWith("/effects/")) ? children : <div className="portal-inner-page">{children}</div>}</PortalShell>;
}
