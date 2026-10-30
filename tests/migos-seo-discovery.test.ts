import { describe, expect, it, vi } from 'vitest';
import { localizeMetadata } from '@/lib/i18n/server';
import { generateMetadata as homeMetadata } from '@/app/page';
import { gangnamBlogMetadata } from '@/components/gangnam-style/blog-metadata';
import { gangnamBlogPosts } from '@/content/gangnam-style-blog';
import { locales } from '@/lib/i18n/routing';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { buildAlternates } from '@/lib/seo';

const request = vi.hoisted(() => ({ locale: 'en', path: '/' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-migos-locale': request.locale, 'x-migos-pathname': request.path }) }));

describe('MigosAI public page identity', () => {
  it.each(['https://other.test/blog', '//other.test/blog', '/\\other.test/blog'])('rejects non-site-relative canonical input %s', path => {
    expect(() => buildAlternates(path)).toThrow('site-relative');
  });

  it('normalizes localized homepage paths without adding a trailing slash or changing the domain', () => {
    expect(buildAlternates('/ko/?source=test#faq', 'ja').canonical).toBe('https://migosai.design/ja');
    expect(buildAlternates('/fr').canonical).toBe('https://migosai.design/');
    expect(buildAlternates('/es/').languages['x-default']).toBe('https://migosai.design/');
  });

  it('normalizes a localized request into reciprocal canonicals without query data or fragments', async () => {
    request.locale = 'fr';
    request.path = '/ja/gangnam-style-ai-video-generator/?source=test#faq';
    const metadata = await localizeMetadata({ openGraph: { title: 'Generator' }, alternates: { types: { 'application/rss+xml': '/feed.xml' } } });
    expect(metadata.alternates).toEqual({
      canonical: 'https://migosai.design/fr/gangnam-style-ai-video-generator',
      languages: {
        en: 'https://migosai.design/gangnam-style-ai-video-generator',
        ko: 'https://migosai.design/ko/gangnam-style-ai-video-generator',
        ja: 'https://migosai.design/ja/gangnam-style-ai-video-generator',
        fr: 'https://migosai.design/fr/gangnam-style-ai-video-generator',
        es: 'https://migosai.design/es/gangnam-style-ai-video-generator',
        'zh-TW': 'https://migosai.design/zh-TW/gangnam-style-ai-video-generator',
        'x-default': 'https://migosai.design/gangnam-style-ai-video-generator',
      },
      types: { 'application/rss+xml': '/feed.xml' },
    });
    expect(metadata.openGraph?.url).toBe('https://migosai.design/fr/gangnam-style-ai-video-generator');
  });

  it.each([
    ['en', '/', 'Hotel Lobby AI Video Generator | LobbyDuo', 'Create Hotel Lobby–style AI duo videos from two photos with LobbyDuo.'],
    ['ko', '/ko', 'Hotel Lobby AI 동영상 생성기 | LobbyDuo', 'LobbyDuo로 사진 두 장을 Hotel Lobby 스타일의 AI 듀오 동영상으로 만들어 보세요.'],
    ['ja', '/ja', 'Hotel Lobby AI動画生成ツール | LobbyDuo', 'LobbyDuoで2枚の写真からHotel LobbyスタイルのAIデュオ動画を作成。'],
    ['fr', '/fr', 'Générateur vidéo IA Hotel Lobby | LobbyDuo', 'Créez des vidéos de duo dans le style Hotel Lobby à partir de deux photos avec LobbyDuo.'],
    ['es', '/es', 'Generador de vídeos con IA Hotel Lobby | LobbyDuo', 'Crea vídeos de dúos al estilo Hotel Lobby a partir de dos fotos con LobbyDuo.'],
    ['zh-TW', '/zh-TW', 'Hotel Lobby AI 影片產生器 | LobbyDuo', '使用 LobbyDuo，將兩張照片製作成 Hotel Lobby 風格的 AI 雙人影片。'],
  ])('preserves the indexed Hotel Lobby homepage metadata in %s', async (locale, path, title, description) => {
    request.locale = locale;
    request.path = '/';
    const metadata = await homeMetadata();
    expect(metadata.title).toEqual({ absolute: title });
    expect(metadata.description).toBe(description);
    expect(metadata.alternates?.canonical).toBe(`https://migosai.design${path}`);
    expect(metadata.alternates?.languages?.['x-default']).toBe('https://migosai.design/');
    expect(metadata.robots).toBeUndefined();
  });

  it('keeps all Gangnam article metadata on its existing nested route', () => {
    for (const post of gangnamBlogPosts) for (const locale of locales) {
      const metadata = gangnamBlogMetadata(post, locale);
      const prefix = locale === 'en' ? '' : `/${locale}`;
      const url = `https://migosai.design${prefix}/gangnam-style-ai-video-generator/blog/${post.slug}`;
      expect(metadata.alternates?.canonical).toBe(url);
      expect(metadata.openGraph?.url).toBe(url);
      expect(metadata.alternates?.languages?.[locale]).toBe(url);
      expect(Object.keys(metadata.alternates!.languages!)).toHaveLength(7);
    }
  });

  it('keeps Hotel Lobby and nested Gangnam URLs in the sitemap with their own revision dates', () => {
    const entries = sitemap();
    expect(new Set(entries.map(entry => entry.url)).size).toBe(entries.length);
    for (const prefix of ['', '/ko', '/ja', '/fr', '/es', '/zh-TW']) {
      const home = entries.find(entry => entry.url === `https://migosai.design${prefix || '/'}`);
      expect(home?.lastModified).toBe('2026-10-25');
      expect(entries.find(entry => entry.url === `https://migosai.design${prefix}/blog`)?.lastModified).toBe('2026-10-28');
      expect(entries.find(entry => entry.url === `https://migosai.design${prefix}/gangnam-style-ai-video-generator`)?.lastModified).toBe('2026-10-30');
      expect(entries.find(entry => entry.url === `https://migosai.design${prefix}/gangnam-style-ai-video-generator/blog`)?.lastModified).toBe('2026-10-30');
      for (const post of gangnamBlogPosts) {
        const entry = entries.find(entry => entry.url === `https://migosai.design${prefix}/gangnam-style-ai-video-generator/blog/${post.slug}`);
        expect(entry?.lastModified).toBe('2026-10-28');
        expect(Object.keys(entry?.alternates?.languages ?? {})).toHaveLength(7);
        expect(entries.some(candidate => candidate.url === `https://migosai.design${prefix}/blog/${post.slug}`)).toBe(false);
      }
    }
  });

  it('adds guest wallet exclusions in six languages without excluding public AI pages or replacing existing rules', () => {
    const result = robots();
    const expected = ['/api/', ...['', '/ko', '/ja', '/fr', '/es', '/zh-TW'].flatMap(prefix => ['/app/', '/sign-in', '/sign-up', '/guest-wallet'].map(path => `${prefix}${path}`))];
    expect(result.rules).toEqual({ userAgent: '*', allow: '/', disallow: expected });
    expect(result.sitemap).toBe('https://migosai.design/sitemap.xml');
  });
});
