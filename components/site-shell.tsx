"use client";

import { usePathname } from "next/navigation";
import { stripLocale } from "@/lib/i18n/routing";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = stripLocale(usePathname());
  const isStandalonePage = pathname === "/sign-in" || pathname === "/sign-up" || pathname.startsWith("/app/");
  const hasOzilFooter = (pathname === "/ozil-goal-generator" || pathname.startsWith("/ozil-goal-generator/")) && !/^\/ozil-goal-generator\/blog(?:\/|$)/.test(pathname);
  const hasFlyingCarFooter = pathname === "/flying-car-ai-video-generator" || pathname.startsWith("/flying-car-ai-video-generator/");
  return isStandalonePage ? <>{children}</> : <><SiteHeader /><main>{children}</main>{!hasOzilFooter && !hasFlyingCarFooter && <SiteFooter />}</>;
}
