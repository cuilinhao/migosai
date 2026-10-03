import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { type ReactElement } from "react";
import LocalizedPage, { generateMetadata } from "../app/[locale]/[[...path]]/page";
import { LegalPage } from "../components/sections/legal-page";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { SiteFooter } from "../components/site-footer";
import { getMessages, locales, localizeHref } from "../lib/i18n";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "../content/support";

const request = vi.hoisted(() => ({ locale: "en", path: "/" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-migos-locale": request.locale, "x-migos-pathname": request.path }) }));

describe("policy routes and support access", () => {
  it.each(locales)("renders the policy and contact routes and footer links in %s", async (locale) => {
    request.locale = locale;
    const messages = getMessages(locale);
    for (const [path, title] of [["refund-policy", "Refund Policy"], ["acceptable-use-policy", "Acceptable Use Policy"], ["contact", "Contact"]]) {
      request.path = `/${path}`;
      const params = Promise.resolve({ locale, path: [path] });
      const route = await LocalizedPage({ params });
      // Resolve the reused async server page and its LegalPage template before SSR.
      const Page = route.type as () => Promise<ReactElement<Parameters<typeof LegalPage>[0]>>;
      const page = await Page();
      const content = await LegalPage(page.props);
      const html = renderToStaticMarkup(<LocaleProvider locale={locale} messages={messages}>{content}</LocaleProvider>);
      expect(html).toContain(`<h1>${messages[title] ?? title}</h1>`);
      expect(html).toContain(`href="${SUPPORT_MAILTO}"`);
      expect(html).toContain(SUPPORT_EMAIL);
      expect(html).toContain(`href="${localizeHref("/terms-of-service", locale)}"`);
      const metadata = await generateMetadata({ params });
      expect(metadata.alternates?.canonical).toBe(`https://migosai.design${localizeHref(`/${path}`, locale)}`);
    }
    const footer = renderToStaticMarkup(<LocaleProvider locale={locale} messages={messages}><SiteFooter/></LocaleProvider>);
    expect(footer).toContain(`href="${localizeHref("/refund-policy", locale)}"`);
    expect(footer).toContain(`href="${localizeHref("/acceptable-use-policy", locale)}"`);
    expect(footer).toContain(`href="${localizeHref("/contact", locale)}"`);
    expect(footer).toContain("migosai.com");
    expect(footer).toContain(`href="${SUPPORT_MAILTO}"`);
    expect(footer).toContain(SUPPORT_EMAIL);
  });
});
