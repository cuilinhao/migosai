import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TermsPage from "../app/terms-of-service/page";
import RefundPage from "../app/refund-policy/page";
import { LegalPage } from "../components/sections/legal-page";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { getMessages, locales } from "../lib/i18n";
const request=vi.hoisted(()=>({locale:"en"}));
vi.mock("next/headers",()=>({headers:async()=>new Headers({"x-migos-locale":request.locale})}));
describe("subscription policy copy",()=>{
  it.each(locales)("explains separate credit rules and preserves refund rights in %s",async locale=>{
    request.locale=locale;const messages=getMessages(locale);
    const terms=await TermsPage();const refund=await RefundPage();
    if(!isValidElement<Parameters<typeof LegalPage>[0]>(terms)||!isValidElement<Parameters<typeof LegalPage>[0]>(refund))throw new Error("Expected legal page elements");
    const termsHtml=renderToStaticMarkup(<LocaleProvider locale={locale} messages={messages}>{await LegalPage(terms.props)}</LocaleProvider>);
    const refundHtml=renderToStaticMarkup(<LocaleProvider locale={locale} messages={messages}>{await LegalPage(refund.props)}</LocaleProvider>);
    const formatDate=(date:string)=>new Intl.DateTimeFormat(locale,{dateStyle:"long",timeZone:"UTC"}).format(new Date(`${date}T00:00:00Z`));
    expect(termsHtml).toContain(formatDate("2026-10-23"));expect(refundHtml).toContain(formatDate("2026-10-22"));
    const unchanged=renderToStaticMarkup(await LegalPage({title:"Policy",subtitle:"",sections:[]}));
    expect(unchanged).toContain(messages["Last updated October 3, 2026"]??"Last updated October 3, 2026");
    expect(termsHtml).not.toContain("with no subscription or automatic renewal");expect(refundHtml).not.toContain("There are no subscriptions");
    const monthly="Subscriptions renew monthly or annually according to the selected plan. Credits are issued monthly for both intervals, expire at the end of each monthly credit period, and are spent before permanent credits. Annual payment does not issue a full year's credits at once.";
    const review="For subscription payment questions, duplicate charges, or refund requests, contact support for a review of your payment and service records. Your statutory rights are unaffected.";
    for(const [html,text] of [[termsHtml,monthly],[refundHtml,review]]) {
      if(locale!=="en")expect(messages[text]).toBeTruthy();
      expect(html).toContain(renderToStaticMarkup(<>{messages[text]??text}</>));
    }
    expect(refundHtml).toContain(renderToStaticMarkup(<>{messages["You may request a refund within 14 days of purchase if none of the credits from that pack have been used. We check the order and credit ledger to confirm eligibility. Approved refunds remove the corresponding credits from your account."]??"You may request a refund within 14 days of purchase if none of the credits from that pack have been used. We check the order and credit ledger to confirm eligibility. Approved refunds remove the corresponding credits from your account."}</>));
  });
});
