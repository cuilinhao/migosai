import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PortalShell } from "@/components/portal/portal-shell";
import { VideoWorkspace } from "@/components/video/video-workspace";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { AuthProvider } from "@/components/auth-provider";
import { getMessages, locales, localizeHref } from "@/lib/i18n";
import { getFlyingCarCost } from "@/lib/flyingcar";
import { videoInspiration } from "@/content/video-inspiration";
import { videoEffects } from "@/content/effects";
vi.mock("next/navigation", () => ({ usePathname: () => "/ai-video-generator" }));

describe("video creation workspace", () => {
  it.each(locales)("opens the selected effect with its editable prompt and preview in %s", locale => {
    const effect = videoEffects[2];
    const prompt = "Preserve the reference subject's appearance. Fan a stack of prop banknotes in a close-up shot.";
    const html = renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><AuthProvider><VideoWorkspace template={{effect, prompt}}/></AuthProvider></LocaleProvider>);
    expect(html).toContain(`<h1>${effect.title}</h1>`);
    expect(html).toContain(`src="${effect.video}"`);
    expect(html).toContain(`poster="${effect.poster}"`);
    expect(html).toContain('appearance. Fan a stack of prop banknotes in a close-up shot.</textarea>');
    expect(html).toContain(`href="${localizeHref("/effects", locale)}"`);
    expect(html).not.toContain(videoInspiration[0].src);
    expect(html).not.toContain(effect.sourcePage);
  });

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
