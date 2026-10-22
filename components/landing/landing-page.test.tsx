import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../i18n/locale-provider";
import { RecraftLanding } from "./landing-page";
import { landingMessages } from "../../lib/i18n/messages/landing";
import { type Locale } from "../../lib/i18n/routing";

const render = (locale: Locale = "en") => renderToStaticMarkup(<LocaleProvider locale={locale} messages={locale === "en" ? {} : landingMessages[locale]}><RecraftLanding/></LocaleProvider>);

describe("MigosAI visual landing", () => {
  it("offers the real image, video and music tools with working destinations and clear credit costs", () => {
    const html = render();
    for (const path of ["/ai-image-generator", "/hotel-lobby-ai-video-generator", "/flying-car-ai-video-generator", "/ozil-goal-generator", "/ai-rap-song-generator", "/pricing", "/"]) expect(html).toContain(`href="${path}"`);
    expect(html).toContain("1K · 5 credits");
    expect(html).toContain("2K · 8 credits");
    expect(html).toContain("4K · 12 credits");
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('aria-label="Next slide"');
    expect(html).toContain('aria-label="Open menu"');
    expect(html).toContain('src="/landing/reference/1d20d4416701db4d.avif"');
    expect((html.match(/<section/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(html).not.toContain("Trusted by");
    expect(html).not.toContain("Vector generation");
  });

  it.each(["ko", "ja", "fr", "es", "zh-TW"] as const)("renders localized navigation, hero and credit explanations in %s", (locale) => {
    const html = render(locale);
    expect(html).toContain(`href="/${locale}/ai-image-generator"`);
    for (const key of ["Start creating", "AI IMAGES & VIDEOS", "Create with Nano Banana 2", "One place. More possibilities.", "1K · 5 credits"]) {
      expect(landingMessages[locale][key]).toBeTruthy();
      expect(html).toContain(renderToStaticMarkup(<>{landingMessages[locale][key]}</>));
    }
  });
});
