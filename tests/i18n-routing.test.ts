import { describe, expect, it } from "vitest";
import { localeFromPath, localizeHref, stripLocale } from "../lib/i18n/routing";

describe("localized navigation", () => {
  it("keeps English URLs and creates each requested language URL", () => {
    expect(localizeHref("/pricing", "en")).toBe("/pricing");
    for (const locale of ["ko", "ja", "fr", "es", "zh-TW"] as const) {
      expect(localizeHref("/pricing", locale)).toBe(`/${locale}/pricing`);
      expect(localizeHref("/", locale)).toBe(`/${locale}`);
    }
  });
  it("switches language without losing a query or fragment or duplicating prefixes", () => {
    expect(localizeHref("/ja/pricing?checkout=success#plans", "fr")).toBe("/fr/pricing?checkout=success#plans");
    expect(localizeHref("/fr?from=nav#generator", "en")).toBe("/?from=nav#generator");
    expect(localizeHref("/zh-TW/pricing?checkout=success#plans", "ja")).toBe("/ja/pricing?checkout=success#plans");
    expect(localizeHref("/ja/app/my-videos?page=2", "zh-TW")).toBe("/zh-TW/app/my-videos?page=2");
    expect(localizeHref("/zh-TW?from=nav#generator", "en")).toBe("/?from=nav#generator");
  });
  it("does not rewrite APIs, public assets, external URLs or in-page fragments", () => {
    for (const href of ["/api/auth/google?returnTo=%2Fja", "/videos/showcase-01.mp4", "/logo.png", "/_next/static/a.js", "https://example.com/a", "//example.com/a", "mailto:support@example.com", "#generator"]) {
      expect(localizeHref(href, "ja")).toBe(href);
    }
  });
  it("recognizes only full supported locale segments", () => {
    expect(localeFromPath("/ko/app/my-videos")).toBe("ko");
    expect(stripLocale("/ko/app/my-videos")).toBe("/app/my-videos");
    expect(stripLocale("/es")).toBe("/");
    expect(localeFromPath("/zh-TW/app/my-videos")).toBe("zh-TW");
    expect(stripLocale("/zh-TW/app/my-videos")).toBe("/app/my-videos");
    expect(stripLocale("/zh-TW-guide")).toBe("/zh-TW-guide");
    expect(localeFromPath("/japan")).toBe("en");
    expect(stripLocale("/french-guide")).toBe("/french-guide");
  });
});
