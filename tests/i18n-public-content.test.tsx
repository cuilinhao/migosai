import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { localizePageContent } from "../components/sections/localized-page-content";
import { createTranslator } from "../lib/i18n/translator";
import { pageMessages } from "../lib/i18n/messages/pages";
import { workflowSteps, featureItems, homeFaqItems } from "../content/home";
import { hotelLobbyTitle, hotelLobbyDescription, hotelLobbySteps, hotelLobbyFaqs } from "../content/hotel-lobby";

describe("public page localization", () => {
  it.each(["ko", "ja", "fr", "es", "zh-TW"] as const)("covers current shared public content in %s", (locale) => {
    const strings = [hotelLobbyTitle, hotelLobbyDescription, ...[...workflowSteps, ...featureItems, ...homeFaqItems, ...hotelLobbySteps, ...hotelLobbyFaqs].flatMap((item) => Object.values(item))];
    for (const source of strings) expect(pageMessages[locale][source], source).toBeTruthy();
  });

  it("translates a complete sentence while preserving its original link", () => {
    const translate = createTranslator({ "Read <0>the guide</0> first.": "Lisez d’abord <0>le guide</0>." });
    const html = renderToStaticMarkup(localizePageContent(<p>Read <a href="/guide#steps">the guide</a> first.</p>, translate));
    expect(html).toBe('<p>Lisez d’abord <a href="/guide#steps">le guide</a>.</p>');
  });

  it("preserves a line break without giving a void element children", () => {
    const translate = createTranslator({ "Hello<0></0>world": "Bonjour<0></0>tout le monde" });
    expect(renderToStaticMarkup(localizePageContent(<h1>Hello<br />world</h1>, translate))).toBe("<h1>Bonjour<br/>tout le monde</h1>");
  });

  it("keeps technical identifiers and media locations unchanged", () => {
    const translate = createTranslator({ Hello: "Bonjour", "The image": "L’image", "hero-image": "must-not-be-used" });
    const html = renderToStaticMarkup(localizePageContent(<section id="hero-image" className="hero-image" aria-label="Hello"><img src="/image.png" alt="The image" /></section>, translate));
    expect(html).toContain('id="hero-image" class="hero-image" aria-label="Bonjour"');
    expect(html).toContain('src="/image.png" alt="L’image"');
  });

  it.each(["ko", "ja", "fr", "es", "zh-TW"] as const)("preserves rich text markers in %s", (locale) => {
    for (const [source, translated] of Object.entries(pageMessages[locale])) {
      expect(translated.match(/<\/?\d+>/g)?.sort() ?? [], source).toEqual(source.match(/<\/?\d+>/g)?.sort() ?? []);
      expect(translated, source).not.toMatch(/ZXQ\d/);
    }
  });
});
