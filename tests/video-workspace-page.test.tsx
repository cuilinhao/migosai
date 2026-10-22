import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PortalShell } from "@/components/portal/portal-shell";
import { VideoWorkspace } from "@/components/video/video-workspace";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { AuthProvider } from "@/components/auth-provider";
import { getMessages, locales, localizeHref } from "@/lib/i18n";
import { getFlyingCarCost } from "@/lib/flyingcar";
import { videoInspiration } from "@/content/video-inspiration";
vi.mock("next/navigation", () => ({ usePathname: () => "/ai-video-generator" }));

describe("video creation workspace", () => {
  it.each(locales)("renders the dedicated workspace and existing generation limits in %s", locale => {
    const html = renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><AuthProvider><PortalShell><VideoWorkspace/></PortalShell></AuthProvider></LocaleProvider>);
    expect(html).toContain("portal-video-workspace");
    expect(html).not.toContain("portal-footer");
    expect(html).not.toContain("portal-effects-grid");
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(html).toContain("Seedance 2.5");
    expect(html).toContain('maxLength="600"');
    expect(html).toContain('value="10" selected=""');
    expect(html).toContain(`</svg>${getFlyingCarCost(10)}</span>`);
    for (const item of videoInspiration) {
      expect(html).toContain(`poster="${item.poster}"`);
      expect(html).toContain(`src="${item.src}"`);
    }
    expect(html).toContain(`href="${localizeHref("/explore", locale)}"`);
    expect(html).not.toMatch(/href="#"/);
    expect(html).not.toMatch(/>\s*(Canvas|Solutions|Text)\s*</);
  });
});
