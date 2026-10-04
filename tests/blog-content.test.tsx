import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { renderInline, plainText } from "../components/blog/blog-shared";
import { blogMessages } from "../lib/i18n/messages/blog";
import { getMessages } from "../lib/i18n";
import { blogPosts, blogSourceStrings } from "../content/blog";
import { publicPages } from "../content/public-pages";
import sitemap from "../app/sitemap";

const translatedLocales = ["ko", "ja", "fr", "es", "zh-TW"] as const;
const links = (text: string) => [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]).sort();
const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort();
const boldMarkers = (text: string) => (text.match(/\*\*/g) || []).length;

describe("blog translations", () => {
  const sources = blogSourceStrings();

  it.each(translatedLocales)("translates every blog string in %s and keeps no stale keys", (locale) => {
    const catalog = blogMessages[locale];
    for (const source of sources) expect(catalog[source]?.trim(), `${locale}: ${source}`).toBeTruthy();
    expect(Object.keys(catalog).sort()).toEqual([...sources].sort());
  });

  it.each(translatedLocales)("preserves links, placeholders and bold markup in %s", (locale) => {
    for (const source of sources) {
      const translated = blogMessages[locale][source];
      expect(links(translated), `${locale}: ${source}`).toEqual(links(source));
      expect(placeholders(translated), `${locale}: ${source}`).toEqual(placeholders(source));
      expect(boldMarkers(translated), `${locale}: ${source}`).toBe(boldMarkers(source));
    }
  });

  it.each(translatedLocales)("labels the Blog navigation link in %s", (locale) => {
    expect(getMessages(locale).Blog?.trim()).toBeTruthy();
  });

  it("keeps blog article copy out of the client message bundle", () => {
    const clientMessages = getMessages("ja");
    expect(clientMessages[blogPosts[0].intro]).toBeUndefined();
  });
});

describe("blog content", () => {
  const publicPaths = new Set(publicPages.map((page) => page.path));

  it("links only to public routes that exist", () => {
    for (const source of blogSourceStrings()) {
      for (const href of links(source).filter((link) => link.startsWith("/"))) {
        expect(publicPaths.has(href.split("#")[0]), href).toBe(true);
      }
    }
  });

  it("lists every article in the sitemap in all six languages", () => {
    const urls = new Set(sitemap().map((entry) => entry.url));
    for (const path of ["/blog", ...blogPosts.map((post) => post.path)]) {
      expect(urls.has(`https://migosai.design${path}`), path).toBe(true);
      for (const locale of translatedLocales) expect(urls.has(`https://migosai.design/${locale}${path}`), `${locale}${path}`).toBe(true);
    }
  });

  it("gives every article a dated title, FAQs and sources", () => {
    for (const post of blogPosts) {
      expect(post.metaTitle).toContain("2026");
      expect(post.faqs.length).toBeGreaterThanOrEqual(5);
      expect(post.sources.length).toBeGreaterThanOrEqual(3);
      expect(new Set(post.sections.map((section) => section.id)).size).toBe(post.sections.length);
    }
  });

  it("renders inline links in the reader's language and strips markup for structured data", () => {
    const text = blogMessages.fr["Despite the name, nothing in the video happens in a hotel lobby: \"Hotel Lobby\" is the title of the song."];
    expect(text).toContain("Hotel Lobby");
    const source = "Use **[LobbyDuo](/hotel-lobby-ai-video-generator#generator)** or read [the source](https://example.com).";
    const html = renderToStaticMarkup(createElement(LocaleProvider, { locale: "fr", messages: {}, children: renderInline(source) }));
    expect(html).toContain('<strong><a href="/fr/hotel-lobby-ai-video-generator#generator">LobbyDuo</a></strong>');
    expect(html).toContain('<a href="https://example.com" rel="noopener">the source</a>');
    expect(plainText(source)).toBe("Use LobbyDuo or read the source.");
  });
});
