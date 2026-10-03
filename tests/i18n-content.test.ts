import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { LanguageSwitcher } from "../components/i18n/language-switcher";
import { getMessages } from "../lib/i18n";
import { pageMessages } from "../lib/i18n/messages/pages";
import { sharedMessages } from "../lib/i18n/messages/shared";
import { interactiveMessages } from "../lib/i18n/messages/interactive";
import { localizeMetadata } from "../lib/i18n/server";
import { VideoPreview } from "../components/generator/video-preview";
const request = vi.hoisted(() => ({ locale: "en", path: "/" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-migos-locale": request.locale, "x-migos-pathname": request.path }) }));

const translatedLocales = ["ko", "ja", "fr", "es", "zh-TW"] as const;
describe("translation catalogs", () => {
  for (const [name, catalogs] of Object.entries({ pages: pageMessages, shared: sharedMessages, interactive: interactiveMessages })) {
    it(`${name} supplies every message and interpolation in every translated language`, () => {
      const sourceKeys = Object.keys(catalogs.ko).sort();
      expect(sourceKeys.length).toBeGreaterThan(0);
      for (const locale of translatedLocales) {
        expect(Object.keys(catalogs[locale]).sort()).toEqual(sourceKeys);
        for (const [source, translation] of Object.entries(catalogs[locale])) {
          expect(translation.trim(), `${locale}: ${source}`).not.toBe("");
          expect((translation.match(/\{\w+\}/g) || []).sort(), `${locale}: ${source}`).toEqual((source.match(/\{\w+\}/g) || []).sort());
        }
      }
    });
  }
  it("renders a localized generator status before hydration", () => {
    const messages = getMessages("ja");
    const html = renderToStaticMarkup(createElement(LocaleProvider, { locale: "ja", messages, children: createElement(VideoPreview, { generation: null, stage: "", error: "" }) }));
    expect(html).toContain(messages["Reference preview · Upload two photos to generate"]);
    expect(html).not.toContain(">Reference preview<");
  });
  it.each(["fr", "zh-TW"] as const)("offers all languages with %s selected and native labels", (locale) => {
    const html = renderToStaticMarkup(createElement(LocaleProvider, { locale, messages: getMessages(locale), children: createElement(LanguageSwitcher) }));
    expect(html).toContain(`value="${locale}" selected=""`);
    for (const label of ["English", "한국어", "日本語", "Français", "Español", "繁體中文"]) expect(html).toContain(label);
  });
});

describe("localized metadata", () => {
  beforeEach(() => { request.locale = "fr"; request.path = "/pricing"; });
  it("gives localized routes their own canonical and reciprocal language alternates", async () => {
    const data = await localizeMetadata({ title: "Pricing", description: "Pricing", openGraph: { title: "Pricing" } });
    expect(data.title).toBe(getMessages("fr")["Pricing"]);
    expect(data.alternates?.canonical).toBe("https://migosai.design/fr/pricing");
    expect(data.alternates?.languages?.ja).toBe("https://migosai.design/ja/pricing");
    expect(data.openGraph).toMatchObject({ url: "https://migosai.design/fr/pricing", locale: "fr_FR" });
  });
  it("keeps account and authentication pages out of the index", async () => {
    request.path = "/app/my-videos";
    expect((await localizeMetadata({})).robots).toEqual({ index: false, follow: false });
  });
  it("uses Traditional Chinese metadata and the zh_TW social locale", async () => {
    request.locale = "zh-TW";
    const data = await localizeMetadata({ title: "Pricing", description: "Pricing", openGraph: { title: "Pricing" } });
    expect(data.title).toBe(getMessages("zh-TW")["Pricing"]);
    expect(data.title).not.toBe("Pricing");
    expect(data.alternates?.canonical).toBe("https://migosai.design/zh-TW/pricing");
    expect(data.alternates?.languages?.["zh-TW"]).toBe("https://migosai.design/zh-TW/pricing");
    expect(data.openGraph).toMatchObject({ url: "https://migosai.design/zh-TW/pricing", locale: "zh_TW" });
  });
});
