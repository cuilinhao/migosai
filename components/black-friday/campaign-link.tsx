"use client";

import type { ReactNode } from "react";
import Link from "@/components/i18n/localized-link";
import { blackFridayCampaign } from "@/content/black-friday-offer";

export function CampaignLink({ href, placement, className, children }: { href: string; placement: string; className?: string; children: ReactNode }) {
  return <Link href={href} className={className} onClick={() => {
    // Internal links keep acquisition attribution intact. Analytics must never block navigation.
    try {
      const analytics = window as Window & { gtag?: (...args: unknown[]) => void };
      analytics.gtag?.("event", "black_friday_cta_click", {
        campaign_id: blackFridayCampaign.id, placement, destination: href,
      });
    } catch { /* Navigation still works if analytics is unavailable. */ }
  }}>{children}</Link>;
}
