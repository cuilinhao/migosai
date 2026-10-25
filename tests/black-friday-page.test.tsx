import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import sitemap from '../app/sitemap';
import { locales, localeTags, localizeHref, type Locale } from '../lib/i18n/routing';
import { getMessages } from '../lib/i18n';
import { LocaleProvider } from '../components/i18n/locale-provider';

const request = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-migos-locale': request.locale, 'x-migos-pathname': '/black-friday' }) }));
afterEach(() => { request.locale = 'en'; vi.useRealTimers(); });

const text = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

async function render(locale: Locale = 'en', date = '2026-10-25T12:00:00Z') {
  request.locale = locale;
  vi.useFakeTimers(); vi.setSystemTime(new Date(date));
  const page = await import('../app/black-friday/page');
  return renderToStaticMarkup(createElement(LocaleProvider, { locale, messages: getMessages(locale), children: await page.default() }));
}

describe('Black Friday discovery and SEO', () => {
  it('lists one permanent campaign route in all six sitemap languages', () => {
    const entries = sitemap().filter(entry => new URL(entry.url).pathname.endsWith('/black-friday'));
    expect(entries.map(entry => entry.url).sort()).toEqual(locales.map(locale => `https://migosai.design${localizeHref('/black-friday', locale)}`).sort());
    for (const entry of entries) expect(Object.keys(entry.alternates!.languages!)).toHaveLength(7);
  });

  it.each(locales)('uses localized canonical, metadata and visible FAQ in %s', async locale => {
    const html = await render(locale);
    const { generateMetadata } = await import('../app/black-friday/page');
    const metadata = await generateMetadata();
    const url = `https://migosai.design${localizeHref('/black-friday', locale)}`;
    expect(metadata.alternates?.canonical).toBe(url);
    expect(Object.keys(metadata.alternates!.languages!)).toHaveLength(7);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    const script = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(script).not.toBeNull();
    const graph = JSON.parse(script![1])['@graph'];
    const faq = graph.find((entry: { '@type': string }) => entry['@type'] === 'FAQPage');
    expect(faq.url).toBe(url);
    expect(faq.inLanguage).toBe(localeTags[locale]);
    const visible = [...html.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/g)].map(([, detail]) => ({
      '@type': 'Question', name: text(detail.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)![1]),
      acceptedAnswer: { '@type': 'Answer', text: text(detail.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)![1]) },
    }));
    expect(visible.length).toBeGreaterThanOrEqual(10);
    expect(faq.mainEntity).toEqual(visible);
    const title = typeof metadata.title === 'string' ? metadata.title : (metadata.title as { absolute?: string })?.absolute;
    if (locale === 'en') expect(title).toBe('AI Video Generator Black Friday Deals 2026 | MigosAI');
    else expect(title).not.toBe('AI Video Generator Black Friday Deals 2026 | MigosAI');
    expect(JSON.stringify(graph)).not.toMatch(/"@type":"(Offer|AggregateRating)"/);
  });

  it('clearly announces a future offer and links to regular pricing before the sale', async () => {
    const html = await render();
    expect(text(html)).toContain('Starts November 20');
    expect(text(html)).toContain('View regular pricing');
    expect(text(html)).not.toContain('Offer live now');
    expect(html).toContain('/pricing?promo=blackfriday#credit-packs');
  });

  it('opens the same page during the campaign and closes it afterwards', async () => {
    expect(text(await render('en', '2026-11-20T00:00:00Z'))).toContain('Offer live now');
    const ended = text(await render('en', '2026-12-02T00:00:00Z'));
    expect(ended).toContain('This offer has ended');
    expect(ended).toContain('View regular pricing');
    expect(ended).not.toContain('Offer live now');
  });
});
