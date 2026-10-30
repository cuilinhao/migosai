import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GangnamStylePage } from '@/components/gangnam-style/page-content';
import { LocaleProvider } from '@/components/i18n/locale-provider';
import { getMessages } from '@/lib/i18n';
import { locales, localizeHref, type Locale } from '@/lib/i18n/routing';

const request = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-migos-locale': request.locale }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/components/auth-provider', () => ({ useAuth: () => ({ user: null, credits: 0, loading: false, openSignIn: () => {}, refresh: async () => {}, ensureGuest: async () => null }) }));

async function renderPage(locale: Locale) {
  request.locale = locale;
  const page = await GangnamStylePage();
  return renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}>{page}</LocaleProvider>);
}
function entities(html: string): Record<string, any>[] {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap(match => { const data = JSON.parse(match[1]); return data['@graph'] ?? [data]; });
}
const specLabels: Record<Locale, string> = { en: 'Aspect ratio', ko: '화면 비율', ja: '画面比率', fr: 'Format', es: 'Relación de aspecto', 'zh-TW': '畫面比例' };

describe('Gangnam visible facts and MigosAI entity relationships', () => {
  it.each(locales)('%s exposes fixed output facts and both real credit quotes before the studio', async locale => {
    const html = await renderPage(locale);
    const table = html.match(/<table\b[^>]*class="gns-facts-table"[^>]*>[\s\S]*?<\/table>/)?.[0];
    expect(table).toBeDefined();
    expect(table).toContain('<caption');
    expect(table).toContain(`<th scope="row">${specLabels[locale]}</th>`);
    expect(table).toContain('16:9');
    expect(table).toContain('480p');
    expect(table).toContain('720p');
    expect(table).toContain('15');
    expect(table).toContain('MP4');
    expect(table).toMatch(/480p[^<]*150/);
    expect(table).toMatch(/720p[^<]*300/);
    expect(table).not.toMatch(/\{\w+\}/);
    expect(html.indexOf('gns-facts-table')).toBeLessThan(html.indexOf('class="gns-form"'));
    expect(html.match(/<details\b/g)).toHaveLength(11);
    expect(entities(html).find(entity => entity['@type'] === 'FAQPage')?.mainEntity).toHaveLength(11);
  });

  it.each(locales)('%s identifies the host organization, website and independent inner-page software', async locale => {
    const html = await renderPage(locale);
    const nodes = entities(html);
    const organization = nodes.filter(node => node['@type'] === 'Organization');
    expect(organization).toHaveLength(1);
    expect(organization[0]).toMatchObject({ '@id': 'https://migosai.design/#org', name: 'MigosAI', url: 'https://migosai.design/', logo: { url: 'https://migosai.design/logo.png', width: 447, height: 447 } });
    expect(organization[0]).not.toHaveProperty('sameAs');
    const website = nodes.find(node => node['@type'] === 'WebSite');
    expect(website).toMatchObject({ '@id': 'https://migosai.design/#website', name: 'MigosAI', publisher: { '@id': 'https://migosai.design/#org' } });
    const url = `https://migosai.design${localizeHref('/gangnam-style-ai-video-generator', locale)}`;
    const software = nodes.find(node => node['@type'] === 'SoftwareApplication');
    expect(software).toMatchObject({ '@id': `${url}#software`, url, publisher: { '@id': 'https://migosai.design/#org' }, mainEntityOfPage: { '@id': `${url}#webpage` } });
    expect(software?.disambiguatingDescription).toContain('PSY');
    expect(software?.disambiguatingDescription).toContain('YG Entertainment');
    expect(nodes.find(node => node['@type'] === 'WebPage')).toMatchObject({ '@id': `${url}#webpage`, url, inLanguage: locale, isPartOf: { '@id': 'https://migosai.design/#website' }, mainEntity: { '@id': `${url}#software` } });
    expect(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')).toContain(software!.disambiguatingDescription);
  });
});
