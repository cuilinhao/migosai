export const creditPacks = [
  { id: "starter", name: "Starter", price: 9.9, amountCents: 990, credits: 300, recommended: false, description: "For occasional use" },
  { id: "creator", name: "Creator", price: 29.9, amountCents: 2990, credits: 950, recommended: true, description: "For flexible projects" },
  { id: "pro", name: "Pro", price: 49.9, amountCents: 4990, credits: 1600, recommended: false, description: "For larger projects" },
  { id: "business", name: "Business", price: 99.9, amountCents: 9990, credits: 3300, recommended: false, description: "Lowest unit price among credit packs" }
] as const;
export type PackId = typeof creditPacks[number]["id"];

// Subscription prices are USD cents. Yearly prices are the full annual charge;
// credits are a monthly allowance for both billing intervals.
export const subscriptionPlans = [
  { id: "lite", name: "Lite", credits: 550, monthlyPriceCents: 1490, yearlyPriceCents: 16092 },
  { id: "standard", name: "Standard", credits: 1150, monthlyPriceCents: 2990, yearlyPriceCents: 32292 },
  { id: "pro", name: "Pro", credits: 1950, monthlyPriceCents: 4990, yearlyPriceCents: 53892 },
  { id: "elite-4000", name: "Elite", credits: 4000, monthlyPriceCents: 9990, yearlyPriceCents: 107892 },
] as const;
export type SubscriptionPlanId = typeof subscriptionPlans[number]["id"];
export type BillingInterval = "month" | "year";

// Retired plans remain readable in account history, but cannot be purchased anew.
const retiredElitePlanIds = ["elite-15000", "elite-25000", "elite-40000", "elite-60000"];
export function getSubscriptionPlanName(planId: string): string {
  return subscriptionPlans.find(plan => plan.id === planId)?.name
    ?? (retiredElitePlanIds.includes(planId) ? "Elite" : planId);
}
