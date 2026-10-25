"use client";

import { useSearchParams } from "next/navigation";
import { PricingCards } from "@/components/pricing-cards";

export function PricingEntry({ offerTime }: { offerTime: number }) {
  const search = useSearchParams();
  const campaign = search.get("promo") === "blackfriday";
  return <PricingCards key={campaign ? "campaign" : "regular"} initialPurchaseType="packs" offerTime={offerTime}/>;
}
