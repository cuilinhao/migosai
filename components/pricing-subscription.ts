"use client";

import { useEffect, useRef, useState } from "react";
import { isCurrentPricingPlan, pricingSubscriptionView, readPricingSubscription, type Subscriber, type PricingSubscriptionSnapshot } from "./pricing-subscription-state";

export function usePricingSubscription(user: Subscriber | null) {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<PricingSubscriptionSnapshot | null>(null);
  const currentOwner = useRef(user);
  const currentRevision = useRef(revision);
  const currentSnapshot = useRef(snapshot);
  currentOwner.current = user;
  currentSnapshot.current = snapshot;

  useEffect(() => {
    if (!user || user.isGuest) return;
    const controller = new AbortController();
    let active = true;
    const valid = () => active && currentOwner.current === user && currentRevision.current === revision;
    void (async () => {
      try {
        const response = await fetch("/api/subscription", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!response.ok) throw new Error("Could not check subscription");
        const subscription = readPricingSubscription(await response.json());
        if (valid()) setSnapshot({ owner: user, revision, subscription, error: false });
      } catch {
        if (valid()) setSnapshot({ owner: user, revision, subscription: null, error: true });
      }
    })();
    return () => { active = false; controller.abort(); };
    // AuthProvider replaces user after checkout confirmation and on focus refresh.
    // Observing the object, not just its id, keeps this read tied to those updates.
  }, [user, revision]);

  function reload() {
    // Invalidate synchronously, before React renders, so an old click handler
    // cannot start a second subscription while the new checkout is being checked.
    currentRevision.current += 1;
    setRevision(currentRevision.current);
  }
  function canSubscribe() {
    return pricingSubscriptionView(currentOwner.current, currentRevision.current, currentSnapshot.current).canSubscribe;
  }
  function canChangePlan(planId: string, billingInterval: "month" | "year") {
    const view = pricingSubscriptionView(currentOwner.current, currentRevision.current, currentSnapshot.current);
    return view.canChange && !isCurrentPricingPlan(view.subscription, planId, billingInterval);
  }

  return { ...pricingSubscriptionView(user, revision, snapshot), reload, canSubscribe, canChangePlan };
}
