import { headers } from "next/headers";
import type { Metadata } from "next";
import { cache } from "react";
import { getMessages } from "./index";
import { createTranslator } from "./translator";
import { isLocale, locales, localeTags, localizeHref, type Locale } from "./routing";
const SITE_URL = "https://migosai.design";
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await headers()).get("x-migos-locale") || "en";
  return isLocale(value) ? value : "en";
});
export const getTranslations = cache(async () => createTranslator(getMessages(await getLocale())));
export async function localizeMetadata(metadata: Metadata): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations();
  const pathname = (await headers()).get("x-migos-pathname") || "/";
  const canonical = new URL(localizeHref(pathname, locale), SITE_URL).href;
  const title = typeof metadata.title === "string" ? t(metadata.title) : metadata.title ? Object.fromEntries(Object.entries(metadata.title).map(([key, value]) => [key, typeof value === "string" ? t(value) : value])) as Metadata["title"] : metadata.title;
  const privatePage = /^\/(app(?:\/|$)|sign-in(?:\/|$)|sign-up(?:\/|$))/.test(pathname);
  return {
    ...metadata,
    ...(metadata.title ? { title } : {}),
    ...(metadata.description ? { description: t(metadata.description) } : {}),
    ...(privatePage ? { robots: { index: false, follow: false } } : {}),
    alternates: { ...metadata.alternates, canonical, languages: Object.fromEntries([...locales.map((language) => [language, new URL(localizeHref(pathname, language), SITE_URL).href]), ["x-default", new URL(pathname, SITE_URL).href]]) },
    ...(metadata.openGraph ? { openGraph: { ...metadata.openGraph, url: canonical, locale: localeTags[locale].replace("-", "_"), alternateLocale: locales.filter(l => l !== locale).map(l => localeTags[l].replace("-", "_")), ...(typeof metadata.openGraph.title === "string" ? { title: t(metadata.openGraph.title) } : {}), ...(metadata.openGraph.description ? { description: t(metadata.openGraph.description) } : {}) } } : {}),
    ...(metadata.twitter ? { twitter: { ...metadata.twitter, ...(typeof metadata.twitter.title === "string" ? { title: t(metadata.twitter.title) } : {}), ...(metadata.twitter.description ? { description: t(metadata.twitter.description) } : {}) } } : {}),
  };
}
