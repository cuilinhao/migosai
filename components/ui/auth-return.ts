import { localizeHref, localeFromPath, stripLocale, type Locale } from "@/lib/i18n/routing";

const ACCOUNT_HOME = "/app/video-generator";

export function safeAuthReturnTo(value: string | null | undefined, locale?: Locale): string {
  const fallback = localizeHref(ACCOUNT_HOME, locale ?? "en");
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\x00-\x20]/.test(decoded) || decoded.startsWith("//")) return fallback;
    const url = new URL(value, "https://migosai.design");
    if (url.origin !== "https://migosai.design" || ["/sign-in", "/sign-up"].includes(stripLocale(decodeURIComponent(url.pathname)))) return fallback;
    const destination = url.pathname + url.search + url.hash;
    return localizeHref(destination, locale ?? localeFromPath(url.pathname));
  } catch {
    return fallback;
  }
}

export function authReturnTo(location: Pick<Location, "pathname" | "search">): string {
  const pathname = stripLocale(location.pathname);
  if (pathname !== "/sign-in" && pathname !== "/sign-up") return `${location.pathname}${location.search}`;
  return safeAuthReturnTo(new URLSearchParams(location.search).get("returnTo"), localeFromPath(location.pathname));
}
