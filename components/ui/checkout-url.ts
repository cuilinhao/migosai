const checkoutHosts = new Set(["checkout.stripe.com", "checkout.waffo.ai", "pancake.waffo.ai"]);

export function trustedCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password ||
      (url.port && url.port !== "443") || !checkoutHosts.has(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}
