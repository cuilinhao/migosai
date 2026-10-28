import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../components/auth-provider';
import { LocaleProvider } from '../components/i18n/locale-provider';
import { PortalShell } from '../components/portal/portal-shell';
import LocalizedPage, { generateMetadata as localizedMetadata } from '../app/[locale]/[[...path]]/page';
import { localizeHref, type Locale } from '../lib/i18n/routing';

const request = vi.hoisted(() => ({ pathname: '/', locale: 'en', sourcePath: '/' }));
// App Router context is the boundary; navigation classification and rendering remain real.
vi.mock('next/navigation', () => ({
  usePathname: () => request.pathname,
  notFound: () => { throw new Error('NOT_FOUND'); },
  permanentRedirect: (destination: string) => { throw Object.assign(new Error('PERMANENT_REDIRECT'), { destination }); },
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-migos-locale': request.locale, 'x-migos-pathname': request.sourcePath }) }));
beforeEach(() => { request.pathname = '/'; request.locale = 'en'; request.sourcePath = '/'; });

describe('Gangnam blog navigation boundaries', () => {
  it.each([
    '/gangnam-style-ai-video-generator/blog',
    '/gangnam-style-ai-video-generator/blog/what-is-gangnam-style',
    '/ko/gangnam-style-ai-video-generator/blog/what-is-gangnam-style',
  ])('marks Hub, rather than the generation workspace, as current at %s', pathname => {
    request.pathname = pathname;
    const html = renderToStaticMarkup(<LocaleProvider locale="en" messages={{}}><AuthProvider><PortalShell><article>Guide</article></PortalShell></AuthProvider></LocaleProvider>);
    const navigation = html.match(/<nav class="portal-nav"[^>]*>([\s\S]*?)<\/nav>/)![1];
    const activeLinks = [...navigation.matchAll(/<a\b[^>]*>/g)].map(match => match[0]).filter(tag => tag.includes('aria-current="page"'));
    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0]).toContain('href="/blog"');
  });

  it('continues to mark the Gangnam generator itself as Video', () => {
    request.pathname = '/gangnam-style-ai-video-generator';
    const html = renderToStaticMarkup(<LocaleProvider locale="en" messages={{}}><AuthProvider><PortalShell><div>Generator</div></PortalShell></AuthProvider></LocaleProvider>);
    const navigation = html.match(/<nav class="portal-nav"[^>]*>([\s\S]*?)<\/nav>/)![1];
    const activeLinks = [...navigation.matchAll(/<a\b[^>]*>/g)].map(match => match[0]).filter(tag => tag.includes('aria-current="page"'));
    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0]).toContain('href="/ai-video-generator"');
  });

  it.each([
    ['en', '/gangnam-style-ai-video-generator#studio'],
    ['ko', '/ko/gangnam-style-ai-video-generator#studio'],
    ['ja', '/ja/gangnam-style-ai-video-generator#studio'],
    ['fr', '/fr/gangnam-style-ai-video-generator#studio'],
    ['es', '/es/gangnam-style-ai-video-generator#studio'],
    ['zh-TW', '/zh-TW/gangnam-style-ai-video-generator#studio'],
  ] as const)('localizes articles and generator during a %s language switch', (locale, generatorHref) => {
    expect(localizeHref('/fr/gangnam-style-ai-video-generator/blog/what-is-gangnam-style?from=nav#faq', locale))
      .toBe(`${locale === 'en' ? '' : '/' + locale}/gangnam-style-ai-video-generator/blog/what-is-gangnam-style?from=nav#faq`);
    expect(localizeHref('/gangnam-style-ai-video-generator/blog?from=nav#articles', locale))
      .toBe(`${locale === 'en' ? '' : '/' + locale}/gangnam-style-ai-video-generator/blog?from=nav#articles`);
    expect(localizeHref('/gangnam-style-ai-video-generator#studio', locale)).toBe(generatorHref);
  });
});

describe('localized Gangnam blog routes', () => {
  it.each(['ko', 'ja', 'fr', 'es', 'zh-TW'])('resolves the %s index and article with their own canonical metadata', async locale => {
    for (const path of [
      ['gangnam-style-ai-video-generator', 'blog'],
      ['gangnam-style-ai-video-generator', 'blog', 'what-is-gangnam-style'],
    ]) {
      request.locale = locale;
      request.sourcePath = `/${path.join('/')}`;
      const props = { params: Promise.resolve({ locale, path }) };
      expect(await LocalizedPage(props)).toBeTruthy();
      const metadata = await localizedMetadata(props);
      expect(metadata.alternates?.canonical).toBe(`https://migosai.design/${locale}/${path.join('/')}`);
      expect(Object.keys(metadata.alternates?.languages ?? {})).toHaveLength(7);
    }
  });

  it('does not redirect unrelated slug prefixes or unsupported UI languages into the blog', async () => {
    await expect(LocalizedPage({ params: Promise.resolve({ locale: 'fr', path: ['gangnam-style-ai-video-generator', 'blogger'] }) })).rejects.toThrow('NOT_FOUND');
    await expect(LocalizedPage({ params: Promise.resolve({ locale: 'pt-BR', path: ['gangnam-style-ai-video-generator', 'blog'] }) })).rejects.toThrow('NOT_FOUND');
  });
});

describe('indexed homepage metadata remains independent of the new topic blog', () => {
  it.each([
    ['en', 'Hotel Lobby AI Video Generator | LobbyDuo', 'Create Hotel Lobby–style AI duo videos from two photos with LobbyDuo.', 'https://migosai.design/'],
    ['ko', 'Hotel Lobby AI 동영상 생성기 | LobbyDuo', 'LobbyDuo로 사진 두 장을 Hotel Lobby 스타일의 AI 듀오 동영상으로 만들어 보세요.', 'https://migosai.design/ko'],
    ['ja', 'Hotel Lobby AI動画生成ツール | LobbyDuo', 'LobbyDuoで2枚の写真からHotel LobbyスタイルのAIデュオ動画を作成。', 'https://migosai.design/ja'],
    ['fr', 'Générateur vidéo IA Hotel Lobby | LobbyDuo', 'Créez des vidéos de duo dans le style Hotel Lobby à partir de deux photos avec LobbyDuo.', 'https://migosai.design/fr'],
    ['es', 'Generador de vídeos con IA Hotel Lobby | LobbyDuo', 'Crea vídeos de dúos al estilo Hotel Lobby a partir de dos fotos con LobbyDuo.', 'https://migosai.design/es'],
    ['zh-TW', 'Hotel Lobby AI 影片產生器 | LobbyDuo', '使用 LobbyDuo，將兩張照片製作成 Hotel Lobby 風格的 AI 雙人影片。', 'https://migosai.design/zh-TW'],
  ] as const)('preserves the %s homepage title, description and canonical', async (locale: Locale, title, description, canonical) => {
    request.locale = locale;
    request.sourcePath = '/';
    const metadata = await localizedMetadata({ params: Promise.resolve({ locale, path: [] }) });
    expect(metadata.title).toEqual({ absolute: title });
    expect(metadata.description).toBe(description);
    expect(metadata.alternates?.canonical).toBe(canonical);
    expect(Object.keys(metadata.alternates?.languages ?? {}).sort()).toEqual(['en', 'es', 'fr', 'ja', 'ko', 'x-default', 'zh-TW']);
  });
});
