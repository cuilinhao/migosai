import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { trustedBillingPortalUrl, trustedCheckoutUrl, requestBillingPortal, requestSubscriptionCancellation } from "./subscription-portal";
import { CreditBalances, SubscriptionDetails, type AccountSubscription } from "./subscription-management";
import { LocaleProvider } from "../i18n/locale-provider";
import { getMessages, locales } from "../../lib/i18n";

const active: AccountSubscription = {id:"local-subscription-1",canManage:true,canCancel:true,checkoutUrl:null,planId:"standard",billingInterval:"year",status:"active",cancelAtPeriodEnd:false,currentPeriodStart:"2026-10-01T00:00:00Z",currentPeriodEnd:"2027-10-01T00:00:00Z"};
const render = (subscription: AccountSubscription | null) => renderToStaticMarkup(<LocaleProvider locale="en" messages={{}}><SubscriptionDetails subscription={subscription} busy={false} onManage={()=>{}} onCancel={()=>{}} onRefresh={()=>{}}/></LocaleProvider>);
describe("subscription account management",()=>{
  it("offers payment and cancellation for a pending checkout instead of billing management",()=>{
    const html=render({...active,status:"pending",canManage:false,checkoutUrl:"https://checkout.stripe.com/c/pay/cs_test_pending",currentPeriodStart:null,currentPeriodEnd:null});
    expect(html).toContain("Payment pending");
    expect(html).toContain("Payment has not been completed.");
    expect(html).toContain('href="https://checkout.stripe.com/c/pay/cs_test_pending"');
    expect(html).toContain("Continue payment");
    expect(html).toContain("Cancel pending payment");
    expect(html).not.toContain("Manage subscription");
    expect(html).not.toContain("Current period ends");
  });
  it("keeps a pending checkout with no usable link cancellable without exposing an untrusted address",()=>{
    const html=render({...active,status:"pending",canManage:false,checkoutUrl:"https://checkout.stripe.com.evil.test/steal"});
    expect(html).toContain("Cancel pending payment");
    expect(html).not.toContain("Continue payment");
    expect(html).not.toContain("evil.test");
  });
  it("shows a confirmation state and refresh action when a pending payment has no open checkout",()=>{
    const html=render({...active,status:"pending",canManage:false,canCancel:false,checkoutUrl:null,currentPeriodStart:null,currentPeriodEnd:null});
    expect(html).toContain("Payment is being confirmed. If you have already paid, refresh to check your subscription.");
    expect(html).toContain("Refresh status");
    expect(html).not.toContain("Payment has not been completed.");
    expect(html).not.toContain("Cancel pending payment");
    expect(html).not.toContain("Manage subscription");
  });
  it("shows a closed checkout with a way to choose a plan instead of subscription billing details",()=>{
    const html=render({...active,status:"expired",canManage:false,canCancel:false,currentPeriodStart:null,currentPeriodEnd:null});
    expect(html).toContain("Payment expired");
    expect(html).toContain("This payment is closed. Your subscription did not start.");
    expect(html).toContain('href="/pricing"');
    expect(html).toContain("View plans");
    expect(html).not.toContain("Current period ends");
    expect(html).not.toContain("Subscription credits are issued monthly");
    expect(html).not.toContain("Manage subscription");
  });
  it("offers explicit cancellation with Stripe confirmation and paid-period access for real subscriptions",()=>{
    const html=render(active);
    expect(html).toContain("Cancel subscription");
    expect(html).toContain("Confirm cancellation in Stripe. Your access continues until the end of your paid period.");
  });
  it("does not offer cancellation when renewal has already been canceled",()=>{
    const html=render({...active,cancelAtPeriodEnd:true,canCancel:false});
    expect(html).not.toContain("Cancel subscription");
    expect(html).toContain("Manage subscription");
  });
  it("disables both subscription actions while a request is in progress",()=>{
    const html=renderToStaticMarkup(<LocaleProvider locale="en" messages={{}}><SubscriptionDetails subscription={active} busy={true} onManage={()=>{}} onCancel={()=>{}} onRefresh={()=>{}}/></LocaleProvider>);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it.each(["elite-15000", "elite-25000", "elite-40000", "elite-60000"])("keeps the historical Elite name for %s after its removal from new purchases", planId => {
    const html = render({...active, planId});
    expect(html).toContain("<dd>Elite</dd>");
    expect(html).not.toContain(planId);
    expect(html).toContain("Manage subscription");
  });
  it("shows the annual plan, status and next renewal without claiming an annual credit grant",()=>{
    const html=render(active);
    for(const value of ["Standard","Annual billing","Active","Next renewal","Manage subscription","monthly"])expect(html).toContain(value);
    expect(html).not.toContain("No subscription");
  });
  it("shows the paid-through date and cancellation explanation",()=>{
    const html=render({...active,cancelAtPeriodEnd:true});
    expect(html).toContain("Access until");expect(html).not.toContain("Next renewal");
    expect(html).toContain("Access continues until the end of your paid period.");
  });
  it("does not offer a management operation when there is no subscription",()=>{
    const html=render(null);expect(html).toContain("You do not have a subscription.");expect(html).toContain('href="/pricing"');expect(html).not.toContain("Manage subscription</button>");
  });
  it.each(locales)("renders the balance buckets with totals unchanged in %s",locale=>{
    const html=renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><CreditBalances permanentCredits={120} subscriptionCredits={30} subscriptionCreditsExpireAt="2026-11-01T00:00:00Z"/></LocaleProvider>);
    expect(html).toContain("120");expect(html).toContain("30");
    if(locale!=="en")expect(html).not.toContain("Permanent credits");
  });
});
describe("Stripe billing portal address validation",()=>{
  it("accepts only HTTPS Stripe billing links",()=>{expect(trustedBillingPortalUrl("https://billing.stripe.com/p/session/test")).toBe("https://billing.stripe.com/p/session/test");expect(trustedBillingPortalUrl("https://billing.stripe.com:443/p/session/test")).toBe("https://billing.stripe.com/p/session/test");});
  it.each([null,{},"javascript:alert(1)","/portal","http://billing.stripe.com/x","https://billing.stripe.com.evil.test/x","https://billing.stripe.com@evil.test/x","https://u:p@billing.stripe.com/x","https://billing.stripe.com:444/x","https://checkout.stripe.com/x"])("rejects untrusted portal destination %s",value=>expect(trustedBillingPortalUrl(value)).toBeNull());
  it("requests the portal by POST and rejects invalid returned URLs",async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({url:"https://evil.test"}),{status:200}));
    await expect(requestBillingPortal(fetcher)).rejects.toThrow("invalid billing address");
    expect(fetcher).toHaveBeenCalledWith("/api/subscription/portal",expect.objectContaining({method:"POST",credentials:"same-origin"}));
  });
  it("does not return a destination on failed responses",async()=>{await expect(requestBillingPortal(async()=>new Response(JSON.stringify({url:"https://billing.stripe.com/x"}),{status:503}))).rejects.toThrow("Could not open subscription management");});
});

describe("subscription cancellation requests",()=>{
  it("sends the displayed local subscription id and locale and returns a Stripe confirmation link",async()=>{
    const fetcher=vi.fn(async()=>Response.json({url:"https://billing.stripe.com/p/session/cancel"}));
    await expect(requestSubscriptionCancellation("local-subscription-1","zh-TW",fetcher)).resolves.toEqual({url:"https://billing.stripe.com/p/session/cancel"});
    expect(fetcher).toHaveBeenCalledWith("/api/subscription/cancel",expect.objectContaining({method:"POST",credentials:"same-origin",body:JSON.stringify({subscriptionId:"local-subscription-1",locale:"zh-TW"})}));
  });
  it("returns a completed pending cancellation without requiring a redirect",async()=>{
    await expect(requestSubscriptionCancellation("pending-1","en",async()=>Response.json({cancelled:true}))).resolves.toEqual({cancelled:true});
  });
  it.each([{url:"https://evil.test/cancel"},{cancelled:false},{}])("rejects an invalid cancellation result %j",async body=>{
    await expect(requestSubscriptionCancellation("sub-1","en",async()=>Response.json(body))).rejects.toThrow();
  });
  it.each(["No subscription is available to manage.","Your subscription payment is being confirmed.","Subscription checkout is still being prepared. Please try again.","The subscription has changed. Refresh and try again.","Subscription service could not be confirmed. Please try again later."])("shows the actionable service error %s",async error=>{
    const response=()=>Promise.resolve(Response.json({error},{status:409}));
    await expect(requestSubscriptionCancellation("sub-1","en",response)).rejects.toThrow(error);
    await expect(requestBillingPortal(response,"en")).rejects.toThrow(error);
  });
  it("does not expose unknown service or network errors",async()=>{
    await expect(requestSubscriptionCancellation("sub-1","en",async()=>Response.json({error:"secret internal service detail"},{status:500}))).rejects.toThrow("Could not cancel your subscription. Please try again.");
    await expect(requestBillingPortal(async()=>{throw new Error("internal network detail");},"en")).rejects.toThrow("Could not open subscription management. Please try again.");
  });
  it("preserves the current language when opening billing management",async()=>{
    const fetcher=vi.fn(async()=>Response.json({url:"https://billing.stripe.com/p/session/manage"}));
    await requestBillingPortal(fetcher,"ja");
    expect(fetcher).toHaveBeenCalledWith("/api/subscription/portal",expect.objectContaining({body:JSON.stringify({locale:"ja"})}));
  });
});
describe("pending checkout address validation",()=>{
  it("accepts HTTPS Stripe Checkout only",()=>expect(trustedCheckoutUrl("https://checkout.stripe.com:443/c/pay/test")).toBe("https://checkout.stripe.com/c/pay/test"));
  it.each([null,{},"javascript:alert(1)","/checkout","http://checkout.stripe.com/x","https://checkout.stripe.com.evil.test/x","https://checkout.stripe.com@evil.test/x","https://u:p@checkout.stripe.com/x","https://checkout.stripe.com:444/x","https://billing.stripe.com/x"])("rejects untrusted checkout destination %s",value=>expect(trustedCheckoutUrl(value)).toBeNull());
});

describe("subscription action translations",()=>{
  it.each(locales.filter(locale=>locale!=="en"))("provides complete pending-payment, cancellation and service-error text in %s",locale=>{
    const messages=getMessages(locale);
    for(const key of ["Payment is being confirmed. If you have already paid, refresh to check your subscription.","Refresh status","This payment is closed. Your subscription did not start.","Payment pending","Payment has not been completed. Your subscription starts after payment is confirmed.","Continue payment","Cancel pending payment","Cancel subscription","Canceling pending payment…","Opening cancellation confirmation…","Cancel this pending payment? The payment link will stop working and your subscription will not start.","Confirm cancellation in Stripe. Your access continues until the end of your paid period.","Your subscription is not canceled yet. Confirm cancellation on the secure Stripe page.","Continue to cancellation confirmation (opens in a new tab)","No subscription is available to manage.","Your subscription payment is being confirmed.","Subscription checkout is still being prepared. Please try again.","The subscription has changed. Refresh and try again.","Could not cancel your subscription. Please try again.","Subscription service could not be confirmed. Please try again later."]){
      expect(messages[key],`${locale}: ${key}`).toBeTruthy();
      expect(messages[key],`${locale}: ${key}`).not.toBe(key);
    }
  });
});
