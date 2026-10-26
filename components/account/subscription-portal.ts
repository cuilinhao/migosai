function trustedStripeUrl(value: unknown, hostname: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== hostname || url.username || url.password || (url.port && url.port !== "443")) return null;
    return url.href;
  } catch { return null; }
}

/** Billing management and payment Checkout use different Stripe hosts. */
export function trustedBillingPortalUrl(value: unknown): string | null {
  return trustedStripeUrl(value, "billing.stripe.com");
}

export function trustedCheckoutUrl(value: unknown): string | null {
  return trustedStripeUrl(value, "checkout.stripe.com");
}

const knownSubscriptionErrors = new Set([
  "No subscription is available to manage.",
  "Your subscription payment is being confirmed.",
  "Subscription checkout is still being prepared. Please try again.",
  "The subscription has changed. Refresh and try again.",
  "Subscription service could not be confirmed. Please try again later.",
  "Could not open subscription management. Please try again.",
  "Could not cancel your subscription. Please try again.",
]);

async function requestSubscriptionAction(path: string, body: Record<string, string>, fallback: string, fetcher: typeof fetch) {
  let response: Response;
  try {
    response = await fetcher(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch { throw new Error(fallback); }
  const data = await response.json().catch(() => null) as {url?:unknown;cancelled?:unknown;error?:unknown} | null;
  if (!response.ok) throw new Error(typeof data?.error === "string" && knownSubscriptionErrors.has(data.error) ? data.error : fallback);
  return data;
}

export async function requestBillingPortal(fetcher: typeof fetch = fetch, locale?: string): Promise<string> {
  const data = await requestSubscriptionAction("/api/subscription/portal", locale ? {locale} : {}, "Could not open subscription management. Please try again.", fetcher);
  const url = trustedBillingPortalUrl(data?.url);
  if (!url) throw new Error("The payment service returned an invalid billing address. Please try again.");
  return url;
}

export async function requestSubscriptionCancellation(subscriptionId: string, locale: string, fetcher: typeof fetch = fetch): Promise<{url:string} | {cancelled:true}> {
  const data = await requestSubscriptionAction("/api/subscription/cancel", {subscriptionId,locale}, "Could not cancel your subscription. Please try again.", fetcher);
  if (data?.cancelled === true) return {cancelled:true};
  const url = trustedBillingPortalUrl(data?.url);
  if (!url) throw new Error("The payment service returned an invalid billing address. Please try again.");
  return {url};
}
