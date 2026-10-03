import type { MetadataRoute } from "next";
import { locales, localizeHref } from "../lib/i18n/routing";
import { publicPages, SITE_URL } from "../content/public-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.flatMap(({ path, priority, changeFrequency, lastModified }) => locales.map((locale) => ({
    url: new URL(localizeHref(path, locale), SITE_URL).href,
    alternates: { languages: Object.fromEntries([...locales.map((language) => [language, new URL(localizeHref(path, language), SITE_URL).href]), ["x-default", new URL(path, SITE_URL).href]]) },
    priority,
    changeFrequency,
    ...(lastModified ? { lastModified } : {}),
  })));
}
