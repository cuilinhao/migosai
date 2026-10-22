import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PortalShell } from "../components/portal/portal-shell";
import { PortalHome } from "../components/portal/portal-home";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { AuthProvider } from "../components/auth-provider";
import { getMessages, locales, localizeHref } from "../lib/i18n";
import { publicPages } from "../content/public-pages";
import { homeCreations, homeEffects, portalCreations, portalEffects } from "../content/portal";
import { videoEffects } from "../content/effects";
import { getEffectCreationHref } from "../content/effect-templates";
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
    expect(html.match(/class="portal-effect-card"/g)).toHaveLength(9);
    expect(html.match(/class="portal-creation-card /g)).toHaveLength(18);
    for (const item of homeEffects) expect(html).toContain(`href="${localizeHref(item.href, locale)}"`);
  });
  it("curates distinct local videos with the matching creation routes", () => {
    const sources = [...homeEffects.map(item => item.video), ...homeCreations.map(item => item.src)];
    expect(new Set(sources).size).toBe(27);
    for (const src of [...sources, ...homeEffects.map(item => item.image), ...homeCreations.map(item => item.poster)]) {
      expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
    }
    for (const item of homeCreations.filter(item => item.model === "Video effect")) {
      const effect = videoEffects.find(effect => effect.id === item.id)!;
      expect(item.href).toBe(getEffectCreationHref(effect));
    }
    for (const category of ["Dance", "Pets", "Cinematic"]) expect(homeCreations.some(item => item.category === category)).toBe(true);
    expect(portalEffects).toHaveLength(4);
    expect(portalCreations).toHaveLength(5);
  });
  it("lists new public pages but keeps personal assets out of the sitemap", () => {
    for (const route of ["/landing", "/ai-image-generator", "/tools", "/effects", "/ai-video-generator", "/explore"]) expect(publicPages.some(page => page.path === route)).toBe(true);
    expect(publicPages.some(page => page.path === "/app/assets")).toBe(false);
  });
});
