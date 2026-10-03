export const creditPacks = [
  { id: "starter", name: "Starter", price: 9.9, amountCents: 990, credits: 300, unitPrice: "0.033", recommended: false, description: "Standard generation queue" },
  { id: "creator", name: "Creator", price: 29.9, amountCents: 2990, credits: 1200, unitPrice: "0.025", recommended: true, description: "Best value for regular creators" },
  { id: "pro", name: "Pro", price: 49.9, amountCents: 4990, credits: 2200, unitPrice: "0.023", recommended: false, description: "Built for campaign batches" },
  { id: "business", name: "Business", price: 99.9, amountCents: 9990, credits: 5000, unitPrice: "0.020", recommended: false, description: "Best unit price" }
] as const;
export type PackId = typeof creditPacks[number]["id"];
