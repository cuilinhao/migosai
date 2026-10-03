import type { MetadataRoute } from 'next';
import { locales, localizeHref } from '@/lib/i18n/routing';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', ...locales.flatMap(locale => ['/app/', '/sign-in', '/sign-up'].map(path => localizeHref(path, locale)))] },
    sitemap: 'https://migosai.design/sitemap.xml',
  };
}
