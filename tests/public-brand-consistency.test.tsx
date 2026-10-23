import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator, translate, getMessages, type Locale } from '../lib/i18n';
import { localizeMetadata } from '../lib/i18n/server';
import { LocaleProvider } from '../components/i18n/locale-provider';
import ContactPage from '../app/contact/page';
import { JsonLd } from '../components/geo/geo-page';
import HotelLobbyPage from '../app/hotel-lobby-ai-video-generator/page';
import FreeGuidePage from '../app/hotel-lobby-ai-video-generator-free/page';
import FilterGuidePage from '../app/hotel-lobby-ai-filter/page';
import PricingPage from '../app/pricing/page';
import { AuthProvider } from '../components/auth-provider';
import { blogArticlePage } from '../components/blog/blog-article';

const request = vi.hoisted(() => ({ locale: 'en', path: '/contact' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-migos-locale': request.locale, 'x-migos-pathname': request.path }) }));

async function resolveAsync(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(async (child, index) => { const resolved = await resolveAsync(child); return isValidElement(resolved) && resolved.key == null ? cloneElement(resolved, { key: `audit-${index}` }) : resolved; }));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === 'function' && element.type.constructor.name === 'AsyncFunction') return resolveAsync(await (element.type as (props: typeof element.props) => Promise<ReactNode>)(element.props));
  return element.props.children === undefined ? element : cloneElement(element, undefined, await resolveAsync(element.props.children));
}

describe('current public product brand without losing existing translations', () => {
  it.each([
    ['en', 'About MigosAI'], ['ko', 'MigosAI 소개'], ['ja', 'MigosAIについて'],
    ['fr', 'À propos de MigosAI'], ['es', 'Acerca de MigosAI'], ['zh-TW', '關於 MigosAI'],
  ] as [Locale, string][])('keeps the existing %s translation while displaying the current brand', (locale, expected) => {
    expect(translate(locale, 'About LobbyDuo')).toBe(expected);
  });
  it('normalizes brand display after lookup without mutating catalog keys', () => {
    const messages = { 'LobbyDuo generated {count} images.': 'LobbyDuo 已產生 {count} 張圖片。' };
    expect(createTranslator(messages)('LobbyDuo generated {count} images.', { count: 3 })).toBe('MigosAI 已產生 3 張圖片。');
    expect(messages['LobbyDuo generated {count} images.']).toBe('LobbyDuo 已產生 {count} 張圖片。');
    expect(createTranslator()('  LOBBYDUO BLOG  ')).toBe('  MIGOSAI BLOG  ');
  });
  it('preserves interpolated user content while normalizing the surrounding product copy', () => {
    const t = createTranslator({ 'LobbyDuo project: {title}': 'LobbyDuo 專案：{title}' });
    expect(t('LobbyDuo project: {title}', { title: 'My LobbyDuo / LOBBYDUO reference' })).toBe('MigosAI 專案：My LobbyDuo / LOBBYDUO reference');
    expect(createTranslator()('Project: {title}', { title: 'LobbyDuo' })).toBe('Project: LobbyDuo');
  });
  it.each(['en', 'ko', 'ja', 'fr', 'es', 'zh-TW'] as Locale[])('uses the current brand in internal blog source labels in %s', async locale => {
    request.locale = locale;
    for (const slug of ['hotel-lobby-ai-video-cat-dog', 'hotel-lobby-ai-video-problems-fixes']) {
      const page = blogArticlePage(slug);
      const node = await resolveAsync(await page.BlogArticle());
      const html = renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}>{node}</LocaleProvider>);
      expect(html).not.toMatch(/LobbyDuo|LOBBYDUO/);
      expect(html).toContain('https://migosai.design/hotel-lobby-ai-template');
    }
  });
  it.each(['en', 'ko', 'ja', 'fr', 'es', 'zh-TW'] as Locale[])('renders Contact with current brand and unchanged support/policy facts in %s', async locale => {
    request.locale = locale;
    const node = await resolveAsync(await ContactPage());
    const html = renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}>{node}</LocaleProvider>);
    expect(html).toContain('MigosAI'); expect(html).not.toMatch(/LobbyDuo|LOBBYDUO/);
    expect(html).toContain('mailto:cuilinhao2021@gmail.com');
    for (const path of ['refund-policy', 'terms-of-service', 'privacy-policy', 'acceptable-use-policy']) expect(html).toContain(`href="${locale === 'en' ? '' : '/' + locale}/${path}"`);
  });
  it('keeps metadata site names and structured-data publishers aligned with the visible brand', async () => {
    request.locale = 'en';
    const metadata = await localizeMetadata({ title: 'About LobbyDuo', openGraph: { siteName: 'LobbyDuo', title: 'About LobbyDuo' } });
    expect(metadata.title).toBe('About MigosAI'); expect(metadata.openGraph).toMatchObject({ siteName: 'MigosAI', title: 'About MigosAI' });
    const html = renderToStaticMarkup(await JsonLd({ data: { '@context': 'https://schema.org', '@type': 'Blog', publisher: { '@type': 'Organization', name: 'LobbyDuo' } } }));
    expect(html).toContain('"name":"MigosAI"'); expect(html).not.toContain('LobbyDuo');
  });
  it('quotes the live Wan template cost in the suggested starting settings', async () => {
    request.locale = 'en';
    const node = await resolveAsync(await HotelLobbyPage());
    const html = renderToStaticMarkup(<AuthProvider>{node}</AuthProvider>);
    expect(html).toContain('Suggested starting settings for your own Wan template: two clear portraits, 9:16, 5 seconds, 480p (30 credits).');
    expect(html).not.toContain('480p (50 credits)');
  });
  it('describes account access without incorrectly requiring Google as the only sign-in method', async () => {
    request.locale = 'en';
    const node = await resolveAsync(await FreeGuidePage());
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).not.toContain('submitting a video require Google sign-in');
    expect(html).toContain('Choose an available sign-in method');
  });
  it('distinguishes our generated examples from third-party reference material', async () => {
    request.locale = 'en';
    const html = renderToStaticMarkup(<>{await resolveAsync(await FilterGuidePage())}</>);
    expect(html).not.toContain('not documented results from this generator');
    expect(html).toContain('MigosAI-generated examples and third-party reference clips');
  });
  it('explains shared credits and exposes both purchase types', async () => {
    request.locale = 'en';
    const html = renderToStaticMarkup(<AuthProvider>{await resolveAsync(await PricingPage())}</AuthProvider>);
    expect(html).toContain('Use across image, video and music tools');
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toContain('Credit packs');
    expect(html).toContain('Subscriptions renew automatically.');
  });
  it.each([
    ['ko', '사용 가능한 로그인 방법'], ['ja', '利用可能なログイン方法'], ['fr', 'méthode de connexion disponible'],
    ['es', 'método de acceso disponible'], ['zh-TW', '可用的登入方式'],
  ] as [Locale, string][])('localizes the corrected account guidance in %s', async (locale, phrase) => {
    request.locale = locale;
    const node = await resolveAsync(await FreeGuidePage());
    const html = renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}>{node}</LocaleProvider>);
    expect(html).toContain(phrase); expect(html).not.toContain('Choose an available sign-in method');
  });
});
