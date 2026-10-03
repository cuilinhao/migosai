export const locales = ["en", "ko", "ja", "fr", "es", "zh-TW"] as const;
export type Locale = (typeof locales)[number];
export type TranslatedLocale = Exclude<Locale, "en">;
export const languageNames: Record<Locale, string> = { en: "English", ko: "한국어", ja: "日本語", fr: "Français", es: "Español", "zh-TW": "繁體中文" };
export const localeTags: Record<Locale, string> = { en: "en-US", ko: "ko-KR", ja: "ja-JP", fr: "fr-FR", es: "es-ES", "zh-TW": "zh-TW" };
export function isLocale(value: string): value is Locale { return (locales as readonly string[]).includes(value); }
export function localeFromPath(path: string): Locale {
  const first = path.split(/[/?#]/)[1];
  return isLocale(first || "") ? first as Locale : "en";
}
export function stripLocale(path: string): string {
  const match = path.match(/^\/(en|ko|ja|fr|es|zh-TW)(?=\/|\?|#|$)/);
  if (!match) return path;
  const rest = path.slice(match[0].length);
  return rest.startsWith("/") ? rest : `/${rest}`;
}
export function isPagePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !/^\/(api|_next)(?:\/|$)/.test(path) && !/\.[^/]+$/.test(path.split(/[?#]/)[0]);
}
export function localizeHref(href: string, locale: Locale): string {
  if (!isPagePath(href)) return href;
  const base = stripLocale(href);
  if (!isPagePath(base)) return href;
  if (locale === "en") return base;
  return `/${locale}${base === "/" ? "" : base.startsWith("/?") || base.startsWith("/#") ? base.slice(1) : base}`;
}
