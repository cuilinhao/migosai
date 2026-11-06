import { describe, expect, it } from 'vitest';
import sitemap from '../app/sitemap';
import { publicPages, SITE_URL } from '../content/public-pages';
import { portalTools } from '../content/portal';
import { discoveryPages, getHomeDiscoveryCards, getFooterDiscoveryColumns } from '../content/home-discovery';
import { locales, localizeHref, translate } from '../lib/i18n';

const pages = [
  { path: '/goodbye-2026-welcome-2027', title: 'Goodbye 2026 Welcome 2027', blurb: 'Climb above the clouds and welcome 2027.' },
  { path: '/stones-to-castle-ai', title: 'Stones to Castle AI', blurb: 'Watch a pile of stones become a castle.' },
];

describe('two new video generators are discoverable in every language', () => {
  it.each(pages)('links $path from tools, home discovery and permanent footer', page => {
    expect(portalTools.some(tool => 'href' in tool && tool.href === page.path)).toBe(true);
    expect(publicPages.some(entry => entry.path === page.path)).toBe(true);
    expect(getHomeDiscoveryCards(Date.parse('2026-11-06T12:00:00Z')).some(entry => entry.path === page.path)).toBe(true);
    expect(getFooterDiscoveryColumns().flatMap(group => group.links).some(link => link.path === page.path)).toBe(true);
    expect(discoveryPages.find(entry => entry.path === page.path)?.blurb).toBe(page.blurb);
  });
  it.each(locales)('indexes exactly one canonical URL per new page in %s', locale => {
    const entries = sitemap();
    for (const page of pages) {
      const matches = entries.filter(entry => entry.url === `${SITE_URL}${localizeHref(page.path, locale)}`);
      expect(matches).toHaveLength(1);
      expect(matches[0].lastModified).toBe('2026-11-06');
      expect(matches[0].alternates?.languages?.['x-default']).toBe(`${SITE_URL}${page.path}`);
      expect(Object.keys(matches[0].alternates?.languages ?? {})).toHaveLength(7);
      if (locale !== 'en') for (const text of [page.title, page.blurb]) expect(translate(locale, text)).not.toBe(text);
    }
  });
});
