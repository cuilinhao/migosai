import { describe, expect, it } from "vitest";
import { trustedCheckoutUrl } from "./checkout-url";

describe("checkout redirect validation", () => {
  it("opens a Stripe hosted checkout with its session fragment intact", () => {
    const url = "https://checkout.stripe.com/c/pay/cs_live_example#fid=test";
    expect(trustedCheckoutUrl(url)).toBe(url);
  });

  it("accepts a previously created Waffo checkout", () => {
    const url = "https://checkout.waffo.ai/store/checkout/cs_example";
    expect(trustedCheckoutUrl(url)).toBe(url);
  });

  it.each([
    undefined,
    "javascript:alert(1)",
    "/pricing",
    "http://checkout.stripe.com/c/pay/cs_test_example",
    "https://checkout.stripe.com.evil.example/c/pay/cs_test_example",
    "https://checkout.stripe.com@evil.example/c/pay/cs_test_example",
    "https://user:password@checkout.stripe.com/c/pay/cs_test_example",
    "https://checkout.stripe.com:8443/c/pay/cs_test_example",
    "https://evil.example/?next=https://checkout.stripe.com",
  ])("blocks an untrusted payment destination: %s", (url) => {
    expect(trustedCheckoutUrl(url)).toBeNull();
  });
});
