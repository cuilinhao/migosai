import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlyingCarCredits } from "../components/flyingcar/credits";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { creditPacks, subscriptionPlans } from "../content/pricing";
import { getMessages } from "../lib/i18n";
import { pricingMessages } from "../lib/i18n/messages/pricing";
import { createTranslator } from "../lib/i18n/translator";

const locales = ["zh-TW", "ko", "ja", "fr", "es"] as const;
const component = readFileSync(new URL("../components/pricing-cards.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
const staticUiSources = [...component.matchAll(/\bt\("([^"\n]+)"/g)].map(match => match[1]);
const pageSources = [
  ...[...page.matchAll(/<(?:h1|p)\b[^>]*>([^<]+)<\//g)].map(match => match[1]),
  ...[...page.matchAll(/description: "([^"]+)"/g)].map(match => match[1]),
];
const benefitSources = [
  "Use across image, video and music tools",
  "No added watermark",
  "Download and organize your creations",
  "New credits every month",
  "Unused subscription credits expire monthly",
  "No automatic renewal",
  "Kept separately from subscription credits",
  "Save 10%",
  "{credits} credit pack",
  "Credits never expire",
  "For occasional use",
  "For flexible projects",
  "For larger projects",
  "Lowest unit price among credit packs",
  "This subscription offer has changed. Refresh pricing before you check out.",
];

describe("pricing translations", () => {
  it.each([
    ["en", "950 credit pack", "Credits never expire"],
    ["zh-TW", "950 點點數包", "點數永久有效"],
    ["ko", "950 크레딧 패키지", "크레딧은 만료되지 않습니다"],
    ["ja", "950クレジットパック", "クレジットに有効期限はありません"],
    ["fr", "Pack de 950 crédits", "Les crédits n’expirent jamais"],
    ["es", "Paquete de 950 créditos", "Los créditos no caducan"],
  ] as const)("displays the pack amount and permanent validity in the Flying Car entry for %s", (locale, title, validity) => {
    const html = renderToStaticMarkup(createElement(LocaleProvider, {
      locale, messages: getMessages(locale), children: createElement(FlyingCarCredits),
    }));
    expect(html).toContain(title);
    expect(html).toContain(validity);
    expect(html).not.toContain("BEST UNIT PRICE");
  });

  it.each(locales)("covers both purchase types, billing controls and page copy in %s", locale => {
    const messages = { ...getMessages(locale), ...pricingMessages[locale] };
    const sources = [...staticUiSources, ...pageSources, ...benefitSources, ...subscriptionPlans.map(plan => plan.name), ...creditPacks.flatMap(pack => [pack.name, pack.description])];
    for (const source of sources) {
      expect(messages[source], `${locale}: ${source}`).toBeTypeOf("string");
      expect(messages[source].trim(), `${locale}: ${source}`).not.toBe("");
    }
  });

  it.each(locales)("preserves every pricing interpolation in %s", locale => {
    expect(Object.keys(pricingMessages[locale]).sort()).toEqual(Object.keys(pricingMessages["zh-TW"]).sort());
    for (const [source, translation] of Object.entries(pricingMessages[locale])) {
      expect(translation.trim(), `${locale}: ${source}`).not.toBe("");
      expect((translation.match(/\{\w+\}/g) ?? []).sort(), `${locale}: ${source}`).toEqual((source.match(/\{\w+\}/g) ?? []).sort());
    }
  });

  it.each(locales)("displays annual charges and monthly allowances without losing values in %s", locale => {
    const t = createTranslator(pricingMessages[locale]);
    expect(t("{amount} billed yearly", { amount: "US$160.92" })).toContain("US$160.92");
    expect(t("{credits} credits per month", { credits: "4,000" })).toContain("4,000");
    expect(t("Up to {images} images at 1K", { images: "800" })).toContain("800");
    expect(t("{percent}% OFF", { percent: 10 })).toContain("10");
    const packTitle = t("{credits} credit pack", { credits: "950" });
    expect(packTitle).toContain("950");
    expect(createTranslator(getMessages(locale))("Buy {pack}", { pack: packTitle })).toContain(packTitle);
    const costs = t("Nano Banana 2: 1K uses 5 credits, 2K uses 8, and 4K uses 12. Video and music costs depend on your generation settings.");
    expect(costs.match(/\d+/g)).toEqual(["2", "1", "5", "2", "8", "4", "12"]);
  });
});
