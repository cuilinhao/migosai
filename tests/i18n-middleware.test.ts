import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { createTranslator } from "../lib/i18n/translator";
import sitemap from "../app/sitemap";
import { publicPages } from "../content/public-pages";

describe("localized requests", () => {
  it.each(["ja", "zh-TW"])("passes %s to the real localized page route", (locale) => {
    const response = middleware(new NextRequest(`https://migosai.design/${locale}/pricing?checkout=success`));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-migos-locale")).toBe(locale);
    expect(response.headers.get("x-middleware-request-x-migos-pathname")).toBe("/pricing");
  });
  it("keeps the unprefixed URL English regardless of supplied locale headers", () => {
    const response = middleware(new NextRequest("https://migosai.design/", { headers: { "x-migos-locale": "fr" } }));
    expect(response.headers.get("x-middleware-request-x-migos-locale")).toBe("en");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
  it("canonicalizes the explicit English prefix", () => {
    const response = middleware(new NextRequest("https://migosai.design/en/pricing?x=1"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://migosai.design/pricing?x=1");
  });
  it("does not expose an alternative API route under a language prefix", () => {
    const response = middleware(new NextRequest("https://migosai.design/fr/api/me"));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});

describe("translation formatting", () => {
  it("preserves inline spaces and interpolates literal values safely", () => {
    const t = createTranslator({ "Credits": "Crédits", "{count} credits": "{count} crédits" });
    expect(t(" Credits ")).toBe(" Crédits ");
    expect(t("{count} credits", { count: 300 })).toBe("300 crédits");
    expect(t("{count} credits", { count: "$&" })).toBe("$& crédits");
    expect(t("Untranslated brand")).toBe("Untranslated brand");
  });
});

describe("multilingual sitemap", () => {
  it("lists every public page in each language with reciprocal hreflang URLs", () => {
    const entries = sitemap();
    expect(entries).toHaveLength(publicPages.length * 6);
    expect(new Set(entries.map(entry => entry.url)).size).toBe(entries.length);
    const french = entries.find(entry => entry.url === "https://migosai.design/fr/pricing");
    expect(french?.alternates?.languages).toEqual({ en: "https://migosai.design/pricing", ko: "https://migosai.design/ko/pricing", ja: "https://migosai.design/ja/pricing", fr: "https://migosai.design/fr/pricing", es: "https://migosai.design/es/pricing", "zh-TW": "https://migosai.design/zh-TW/pricing", "x-default": "https://migosai.design/pricing" });
  });
});
