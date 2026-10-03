"use client";

import { usePathname } from "next/navigation";
import { stripLocale } from "@/lib/i18n/routing";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = stripLocale(usePathname());
  const isStandalonePage = pathname === "/sign-in" || pathname === "/sign-up" || pathname.startsWith("/app/");
  return isStandalonePage ? <>{children}</> : <><SiteHeader /><main>{children}</main><SiteFooter /></>;
}
