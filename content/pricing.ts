export const creditPacks = [
  { id: "starter", name: "Starter", price: 9.9, amountCents: 990, credits: 300, unitPrice: "0.033", recommended: false, description: "Standard generation queue" },
  { id: "creator", name: "Creator", price: 29.9, amountCents: 2990, credits: 1200, unitPrice: "0.025", recommended: true, description: "Best value for regular creators" },
  { id: "pro", name: "Pro", price: 49.9, amountCents: 4990, credits: 2200, unitPrice: "0.023", recommended: false, description: "Built for campaign batches" },
  { id: "business", name: "Business", price: 99.9, amountCents: 9990, credits: 5000, unitPrice: "0.020", recommended: false, description: "Best unit price" }
] as const;
export type PackId = typeof creditPacks[number]["id"];

// Subscription prices are USD cents. Yearly prices are the full annual charge;
// credits are a monthly allowance for both billing intervals.
export const subscriptionPlans = [
  { id: "lite", name: "Lite", credits: 750, monthlyPriceCents: 759, yearlyPriceCents: 7308 },
  { id: "standard", name: "Standard", credits: 2500, monthlyPriceCents: 2499, yearlyPriceCents: 23988 },
  { id: "pro", name: "Pro", credits: 6000, monthlyPriceCents: 4999, yearlyPriceCents: 44988 },
  { id: "elite-15000", name: "Elite", credits: 15000, monthlyPriceCents: 11999, yearlyPriceCents: 107988 },
  { id: "elite-25000", name: "Elite", credits: 25000, monthlyPriceCents: 17999, yearlyPriceCents: 161988 },
  { id: "elite-40000", name: "Elite", credits: 40000, monthlyPriceCents: 25999, yearlyPriceCents: 233988 },
  { id: "elite-60000", name: "Elite", credits: 60000, monthlyPriceCents: 35999, yearlyPriceCents: 323988 },
] as const;
export type SubscriptionPlanId = typeof subscriptionPlans[number]["id"];
export type BillingInterval = "month" | "year";
