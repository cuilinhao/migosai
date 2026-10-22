import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EffectsGallery } from "@/components/effects/effects-gallery";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { getMessages, locales, translate } from "@/lib/i18n";
import { adjacentEffectIndex, videoEffects } from "@/content/effects";

describe("complete effects gallery", () => {
  it("has all 77 unique videos and keeps the reference catalog order", () => {
    expect(videoEffects).toHaveLength(77);
    expect(new Set(videoEffects.map(item => item.id)).size).toBe(77);
    expect(new Set(videoEffects.map(item => item.video)).size).toBe(77);
    expect(new Set(videoEffects.map(item => item.sourceVideo)).size).toBe(77);
    expect(videoEffects[0].title).toBe("Rap Duo");
    expect(videoEffects[76].title).toBe("Kemusan Dance");
    for (const item of videoEffects) {
      expect(item.video).toMatch(/^\/effects\/piclumen\/[^/]+\.mp4$/);
      expect(item.poster).toMatch(/^\/effects\/piclumen\/[^/]+\.(webp|png|jpg)$/);
      expect(new URL(item.sourcePage).hostname).toBe("www.piclumen.com");
    }
  });

  it.each(locales)("renders every card in %s without loading all 77 videos on entry", locale => {
    const html = renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><EffectsGallery/></LocaleProvider>);
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(html).toContain(translate(locale, "Effects"));
    expect(html.match(/<button /g)).toHaveLength(77);
    expect(html.match(/loading="lazy"/g)).toHaveLength(77);
    const previews = html.match(/<video\b[^>]*>/g) ?? [];
    expect(previews).toHaveLength(77);
    for (const preview of previews) {
      expect(preview).toContain('muted=""');
      expect(preview).toContain('loop=""');
      expect(preview).toContain('playsInline=""');
      expect(preview).toContain('preload="none"');
      expect(preview).not.toMatch(/\bsrc=/);
    }
    const posterPositions = videoEffects.map(item => html.indexOf(`src="${item.poster}"`));
    expect(posterPositions.every((position, index) => position >= 0 && (index === 0 || position > posterPositions[index - 1]))).toBe(true);
    expect(html).not.toContain("Try effect");
  });

  it("can browse forward and backward across both ends of the full catalog", () => {
    expect(adjacentEffectIndex(0, -1, 77)).toBe(76);
    expect(adjacentEffectIndex(76, 1, 77)).toBe(0);
    expect(adjacentEffectIndex(49, 1, 77)).toBe(50);
  });
});
