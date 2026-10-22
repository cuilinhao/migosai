import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../i18n/locale-provider";
import { RecraftLanding } from "./landing-page";
import { landingMessages } from "../../lib/i18n/messages/landing";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { galleryImages, heroSlides, landingCopy, landingFaqs, productCards } from "./landing-content";
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
    expect(html).toContain('href="#faq"');
    expect(html).toContain('aria-label="Play video example"');
    expect(html).toContain('aria-label="Pause slideshow"');
    expect(html).toContain("No free credits are included at registration.");
    expect(html).not.toContain("Trusted by");
    expect(html).not.toContain("Vector generation");
  });

  it("connects harvested assets and real gallery/FAQ content to the landing route", () => {
    const html = render();
    expect(html).toContain(`src="/landing/ideogram/${heroSlides[0].image}"`);
    expect(html).not.toContain("/landing/reference/");
    expect(html.match(/aria-label="Preview image:/g)).toHaveLength(galleryImages.length);
    expect(html.match(/<details/g)).toHaveLength(landingFaqs.length);
    expect(html).toContain('id="faq"');
    expect(html).toContain('aria-controls="landing-slide"');
    for (const item of [...heroSlides, ...productCards, ...galleryImages]) {
      expect(existsSync(join(process.cwd(), "public/landing/ideogram", item.image))).toBe(true);
    }
  });

  it.each(["ko", "ja", "fr", "es", "zh-TW"] as const)("translates the new content and FAQ in %s", locale => {
    for (const key of [...Object.values(landingCopy), ...landingFaqs.flatMap(item => [item.question, item.answer])]) {
      expect(landingMessages[locale][key], key).toBeTruthy();
    }
    const html = render(locale);
    expect(html).toContain(renderToStaticMarkup(<>{landingMessages[locale][landingCopy.heroTitle]}</>));
    expect(html).toContain(renderToStaticMarkup(<>{landingMessages[locale][landingFaqs[3].answer]}</>));
  });

  it.each(["ko", "ja", "fr", "es", "zh-TW"] as const)("renders localized navigation, hero and credit explanations in %s", (locale) => {
    const html = render(locale);
    expect(html).toContain(`href="/${locale}/ai-image-generator"`);
    for (const key of ["Start creating", "Create with Nano Banana 2", "One place. More possibilities.", "1K · 5 credits"]) {
      expect(landingMessages[locale][key]).toBeTruthy();
      expect(html).toContain(renderToStaticMarkup(<>{landingMessages[locale][key]}</>));
    }
  });
});
