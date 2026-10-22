import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PortalShell } from "../components/portal/portal-shell";
import { PortalHome } from "../components/portal/portal-home";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { AuthProvider } from "../components/auth-provider";
import { getMessages, locales, localizeHref } from "../lib/i18n";
import { publicPages } from "../content/public-pages";
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("MigosAI portal entry points", () => {
  it.each(locales)("provides working localized tools and preserves the legacy landing in %s", (locale) => {
    const html = renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><AuthProvider><PortalShell><PortalHome/></PortalShell></AuthProvider></LocaleProvider>);
    for (const href of ["/ai-image-generator", "/hotel-lobby-ai-video-generator", "/ai-rap-song-generator", "/app/assets", "/pricing", "/landing"]) expect(html).toContain(`href="${localizeHref(href, locale)}"`);
    expect(html).not.toMatch(/href="#"/);
    expect(html).not.toMatch(/>\s*(Canvas|Solutions|Text)\s*</);
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(html).toContain("MigosAI");
    expect(html).toContain('aria-disabled="true"');
  });
  it("lists new public pages but keeps personal assets out of the sitemap", () => {
    for (const route of ["/landing", "/ai-image-generator", "/tools", "/effects", "/ai-video-generator", "/explore"]) expect(publicPages.some(page => page.path === route)).toBe(true);
    expect(publicPages.some(page => page.path === "/app/assets")).toBe(false);
  });
});
