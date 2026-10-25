import { describe, expect, it } from 'vitest';
import sitemap from '../app/sitemap';
import { publicPages, SITE_URL } from '../content/public-pages';
import { portalTools } from '../content/portal';
import { locales, localizeHref } from '../lib/i18n/routing';

const route = '/window-peeper-ai-video-generator';

describe('Window Peeper discovery', () => {
  it('offers the new generator through the existing tools catalogue', () => {
    expect(portalTools.some(tool => 'href' in tool && tool.href === route)).toBe(true);
    expect(publicPages.find(page => page.path === route)?.label).toBe('Window Peeper AI Video Generator');
  });

  it('includes a canonical page and language alternates for every supported locale', () => {
    const entries = sitemap();
    for (const locale of locales) {
      const url = `${SITE_URL}${localizeHref(route, locale)}`;
      const entry = entries.find(item => item.url === url);
      expect(entry, locale).toBeDefined();
      expect(entry?.alternates?.languages?.['x-default']).toBe(`${SITE_URL}${route}`);
      expect(entry?.lastModified).toBe('2026-10-25');
    }
  });
});
