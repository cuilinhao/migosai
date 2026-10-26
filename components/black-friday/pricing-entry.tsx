"use client";

import { useSearchParams } from "next/navigation";
import { PricingCards } from "@/components/pricing-cards";
import { SubscriptionChangeReturnStatus } from "@/components/ui/subscription-change-return-status";

export function PricingEntry({ offerTime }: { offerTime: number }) {
  const search = useSearchParams();
  const campaign = search.get("promo") === "blackfriday";
  const purchaseType = search.get("subscription") === "updated" ? "subscription" : "packs";
  return <>
    {purchaseType === "subscription" && <SubscriptionChangeReturnStatus/>}
    <PricingCards key={`${campaign ? "campaign" : "regular"}-${purchaseType}`} initialPurchaseType={purchaseType} offerTime={offerTime}/>
  </>;
}
