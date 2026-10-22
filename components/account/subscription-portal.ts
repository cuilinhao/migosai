/** Billing management is a different Stripe host from payment Checkout. */
export function trustedBillingPortalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com" || url.username || url.password || (url.port && url.port !== "443")) return null;
    return url.href;
  } catch { return null; }
}

export async function requestBillingPortal(fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher("/api/subscription/portal", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
  const data = await response.json().catch(() => null) as {url?:unknown} | null;
  if (!response.ok) throw new Error("Could not open subscription management. Please try again.");
  const url = trustedBillingPortalUrl(data?.url);
  if (!url) throw new Error("The payment service returned an invalid billing address. Please try again.");
  return url;
}
