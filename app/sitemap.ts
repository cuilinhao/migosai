import type { MetadataRoute } from "next";
import { locales, localizeHref } from "../lib/i18n/routing";
import { publicPages, SITE_URL } from "../content/public-pages";
import { OZIL_BLOG_PATH, OZIL_BLOG_UPDATED, ozilBlogAlternates, ozilBlogPosts } from "../content/ozil-blog";
import { videoEffects } from "../content/effects";
import { getEffectCreationHref } from "../content/effect-templates";
import { GANGNAM_BLOG_PATH, GANGNAM_BLOG_UPDATED, gangnamBlogPosts } from "../content/gangnam-style-blog";

export default function sitemap(): MetadataRoute.Sitemap {
  // Dedicated generators already appear in publicPages; omit their effect aliases.
  const effectPages = videoEffects
    .map(effect => getEffectCreationHref(effect))
    .filter(path => path.startsWith("/effects/"))
    .map(path => ({ path, priority: 0.7, changeFrequency: "monthly" as const, lastModified: "2026-10-22" }));
  const translatedPages = [...publicPages, ...effectPages].flatMap(({ path, priority, changeFrequency, lastModified }) => locales.map((locale) => ({
    url: new URL(localizeHref(path, locale), SITE_URL).href,
    alternates: { languages: Object.fromEntries([...locales.map((language) => [language, new URL(localizeHref(path, language), SITE_URL).href]), ["x-default", new URL(path, SITE_URL).href]]) },
    priority,
    changeFrequency,
    ...(lastModified ? { lastModified } : {}),
  })));
  // Gangnam has complete translations; Ozil keeps its independently authored variants.
  return [...translatedPages,
    ...[{ path: GANGNAM_BLOG_PATH, dateModified: GANGNAM_BLOG_UPDATED }, ...gangnamBlogPosts].flatMap(({ path, dateModified }) => locales.map(locale => ({
      url: `${SITE_URL}${localizeHref(path, locale)}`, priority: 0.7, changeFrequency: path === GANGNAM_BLOG_PATH ? "weekly" as const : "monthly" as const, lastModified: dateModified,
      alternates: { languages: Object.fromEntries([...locales.map(language => [language, `${SITE_URL}${localizeHref(path, language)}`]), ['x-default', `${SITE_URL}${path}`]]) },
    }))),
    { url: `${SITE_URL}${OZIL_BLOG_PATH}`, priority: 0.7, changeFrequency: "weekly", lastModified: OZIL_BLOG_UPDATED },
    ...ozilBlogPosts.map(post => ({
      url: `${SITE_URL}${post.path}`, priority: 0.7, changeFrequency: "monthly" as const, lastModified: post.dateModified,
      alternates: { languages: Object.fromEntries(Object.entries(ozilBlogAlternates(post)).map(([language, path]) => [language, `${SITE_URL}${path}`])) },
    })),
  ];
}
