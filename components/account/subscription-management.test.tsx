import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { trustedBillingPortalUrl, requestBillingPortal } from "./subscription-portal";
import { CreditBalances, SubscriptionDetails, type AccountSubscription } from "./subscription-management";
import { LocaleProvider } from "../i18n/locale-provider";
import { getMessages, locales } from "../../lib/i18n";

const active: AccountSubscription = {planId:"standard",billingInterval:"year",status:"active",cancelAtPeriodEnd:false,currentPeriodStart:"2026-10-01T00:00:00Z",currentPeriodEnd:"2027-10-01T00:00:00Z"};
const render = (subscription: AccountSubscription | null) => renderToStaticMarkup(<LocaleProvider locale="en" messages={{}}><SubscriptionDetails subscription={subscription} busy={false} onManage={()=>{}}/></LocaleProvider>);
describe("subscription account management",()=>{
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
