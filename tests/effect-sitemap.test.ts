import { describe, expect, it } from "vitest";
import sitemap from "../app/sitemap";
import { videoEffects } from "../content/effects";

const site = "https://migosai.design";
const prefixes = ["", "/ko", "/ja", "/fr", "/es", "/zh-TW"];
const redirectedEffects = new Set(["001-hotel-lobby-rap-duo", "002-flying-roadster", "005-ozil-goal-ai"]);

describe("effect sitemap discovery", () => {
  it("publishes a standalone effect in all six languages with reciprocal canonical alternates", () => {
    const entries = sitemap();
    const languages = {
      en: "https://migosai.design/effects/003-ai-money-flex",
      ko: "https://migosai.design/ko/effects/003-ai-money-flex",
      ja: "https://migosai.design/ja/effects/003-ai-money-flex",
      fr: "https://migosai.design/fr/effects/003-ai-money-flex",
      es: "https://migosai.design/es/effects/003-ai-money-flex",
      "zh-TW": "https://migosai.design/zh-TW/effects/003-ai-money-flex",
      "x-default": "https://migosai.design/effects/003-ai-money-flex",
    };

    for (const url of new Set(Object.values(languages))) {
      const matches = entries.filter(entry => entry.url === url);
      expect(matches, url).toHaveLength(1);
      expect(matches[0].alternates?.languages).toEqual(languages);
    }
  });

  it("covers the complete standalone catalog and excludes the three redirected aliases", () => {
    const entries = sitemap();
    const effectUrls = entries.filter(entry => /\/effects\//.test(new URL(entry.url).pathname)).map(entry => entry.url);
    const expected = videoEffects
      .filter(effect => !redirectedEffects.has(effect.id))
      .flatMap(effect => prefixes.map(prefix => `${site}${prefix}/effects/${effect.id}`));

    expect(effectUrls.slice().sort()).toEqual(expected.slice().sort());
    expect(new Set(effectUrls).size).toBe(effectUrls.length);
    for (const prefix of prefixes) {
      for (const path of ["/hotel-lobby-ai-video-generator", "/flying-car-ai-video-generator", "/ozil-goal-generator"]) {
        expect(entries.some(entry => entry.url === `${site}${prefix}${path}`)).toBe(true);
      }
    }
  });

  it("records the homepage and effect launch without advancing older content revisions", () => {
    const entries = sitemap();
    for (const prefix of prefixes) {
      const home = prefix ? `${site}${prefix}` : `${site}/`;
      expect(entries.find(entry => entry.url === home)?.lastModified).toBe("2026-10-25");
      expect(entries.find(entry => entry.url === `${site}${prefix}/effects/003-ai-money-flex`)?.lastModified).toBe("2026-10-22");
      expect(entries.find(entry => entry.url === `${site}${prefix}/hotel-lobby-ai-video-generator`)?.lastModified).toBe("2026-10-23");
    }
  });
});
