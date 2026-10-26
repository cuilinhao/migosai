import type { User } from "@/lib/contracts";

export type Subscriber = Pick<User, "id" | "isGuest">;
export type PricingSubscription = {
  id: string;
  planId: string;
  billingInterval: "month" | "year";
  status: string;
};
export type PricingSubscriptionSnapshot = {
  owner: Subscriber;
  revision: number;
  subscription: PricingSubscription | null;
  error: boolean;
};

export function readPricingSubscription(body: unknown): PricingSubscription | null {
  if (!body || typeof body !== "object" || !("subscription" in body)) throw new Error("Invalid subscription response");
  const subscription = body.subscription;
  if (subscription === null) return null;
  if (!subscription || typeof subscription !== "object" ||
    !("id" in subscription) || typeof subscription.id !== "string" ||
    !("planId" in subscription) || typeof subscription.planId !== "string" ||
    !("billingInterval" in subscription) || !["month", "year"].includes(String(subscription.billingInterval)) ||
    !("status" in subscription) || typeof subscription.status !== "string") throw new Error("Invalid subscription response");
  // Closed subscriptions can be purchased again; all other states stay blocked.
  // In particular, canceling renewal does not close an active paid subscription.
  return ["canceled", "expired", "incomplete_expired"].includes(subscription.status) ? null : subscription as PricingSubscription;
}

export function pricingSubscriptionView(user: Subscriber | null, revision: number, snapshot: PricingSubscriptionSnapshot | null) {
  const registered = !!user && !user.isGuest;
  const ownSnapshot = registered && snapshot?.owner.id === user.id ? snapshot : null;
  const loading = registered && (ownSnapshot?.owner !== user || ownSnapshot?.revision !== revision);
  return {
    subscription: ownSnapshot?.subscription ?? null,
    loading,
    error: !loading && !!ownSnapshot?.error,
    canSubscribe: registered && !loading && !!ownSnapshot && !ownSnapshot.error && !ownSnapshot.subscription,
  };
}

export function isCurrentPricingPlan(subscription: PricingSubscription | null, planId: string, billingInterval: "month" | "year") {
  return !!subscription && ["active", "trialing", "past_due", "unpaid", "paused"].includes(subscription.status)
    && subscription.planId === planId && subscription.billingInterval === billingInterval;
}
