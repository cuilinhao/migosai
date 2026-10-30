import { SITE_URL } from '@/content/public-pages';
import { locales, localizeHref, stripLocale, type Locale } from '@/lib/i18n/routing';

/** One canonical/hreflang source for the six translated public routes. */
export function buildAlternates(path: string, locale: Locale = 'en') {
  const pathname = stripLocale(path.split(/[?#]/)[0]).replace(/\/+$/, '') || '/';
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('\\')) {
    throw new Error('SEO paths must be site-relative page paths.');
  }
  const absolute = (language: Locale) => new URL(localizeHref(pathname, language), SITE_URL).href;
  return {
    canonical: absolute(locale),
    languages: Object.fromEntries([...locales.map(language => [language, absolute(language)]), ['x-default', absolute('en')]]),
  };
}
