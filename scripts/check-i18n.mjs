// Read-only smoke checks against a local Next.js or Cloudflare preview.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Load the TypeScript content registries without writing generated files.
const registryBundle = await build({
  stdin: {
    contents: `
      export { publicPages, SITE_URL } from './content/public-pages';
      export { locales, localizeHref } from './lib/i18n/routing';
      export { videoEffects } from './content/effects';
      export { getEffectCreationHref } from './content/effect-templates';
      export { OZIL_BLOG_PATH, ozilBlogPosts } from './content/ozil-blog';
    `,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { publicPages, SITE_URL, locales, localizeHref, videoEffects, getEffectCreationHref, OZIL_BLOG_PATH, ozilBlogPosts } =
  await import(`data:text/javascript;base64,${Buffer.from(registryBundle.outputFiles[0].text).toString('base64')}`);

const origin = process.argv[2] || 'http://127.0.0.1:3100';
const paths = ['/', '/pricing', '/showcases', '/ai-rap-song-generator', '/privacy-policy', '/terms-of-service', '/refund-policy', '/acceptable-use-policy', '/contact', '/hotel-lobby-ai-video-generator', '/hotel-lobby-ai-video-generator-free', '/hotel-lobby-ai-template', '/hotel-lobby-ai-filter', '/hotel-lobby-ai-generator', '/blog/best-hotel-lobby-ai-video-generators-2026', '/blog', '/blog/what-is-hotel-lobby-ai-video', '/blog/hotel-lobby-ai-trend-song', '/blog/hotel-lobby-ai-video-cat-dog', '/blog/hotel-lobby-ai-video-problems-fixes', '/sign-in', '/sign-up', '/app/video-generator', '/app/my-videos', '/app/my-orders', '/app/my-credits'];
const queue = locales.flatMap(locale => paths.map(path => ({locale, path, route: locale === 'en' ? path : `/${locale}${path === '/' ? '' : path}`})));
const failures = [];
let checked = 0;
await Promise.all(Array.from({length:4}, async () => {
  while (queue.length) {
    const {locale, path, route} = queue.shift();
    const response = await fetch(origin + route);
    const html = await response.text();
    const errors = [];
    if (response.status !== 200) errors.push(`HTTP ${response.status}`);
    if (!html.includes(`<html lang="${locale}"`)) errors.push('wrong document language');
    if (!/<title>[^<]+<\/title>/.test(html)) errors.push('missing title');
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    if (canonical?.replace(/\/$/, '') !== `https://migosai.design${route}`.replace(/\/$/, '')) errors.push(`wrong canonical ${canonical}`);
    if (/^\/(app\/|sign-)/.test(path) && !/<meta name="robots" content="[^"]*noindex/.test(html)) errors.push('private page missing noindex');
    for (const [, href] of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
      if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/api/') && !/\.[^/]+(?:[?#]|$)/.test(href) && locale !== 'en' && !new RegExp(`^/${locale}(?:/|#|\\?|$)`).test(href)) errors.push(`link lost language: ${href}`);
    }
    if (errors.length) failures.push({route, errors:[...new Set(errors)]});
    checked++;
  }
}));
const sitemapResponse = await fetch(origin + '/sitemap.xml');
const xml = await sitemapResponse.text();
const sitemapUrls = [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map(([, url]) => url.replace(/&amp;/g, '&'));
const sitemapCount = sitemapUrls.length;
const sitemapUrlSet = new Set(sitemapUrls);
const translatedPaths = [
  ...publicPages.map(page => page.path),
  ...videoEffects.map(getEffectCreationHref).filter(path => path.startsWith('/effects/')),
];
const expectedSitemapUrls = new Set([
  ...translatedPaths.flatMap(path => locales.map(locale => new URL(localizeHref(path, locale), SITE_URL).href)),
  // Ozil articles use their authored language slugs, without synthetic UI-locale copies.
  ...[OZIL_BLOG_PATH, ...ozilBlogPosts.map(post => post.path)].map(path => new URL(path, SITE_URL).href),
]);
const sitemapErrors = [];
if (sitemapResponse.status !== 200) sitemapErrors.push(`HTTP ${sitemapResponse.status}`);
if (!/<urlset\b/.test(xml) || !/<\/urlset>/.test(xml)) sitemapErrors.push('missing sitemap urlset');
if (sitemapUrlSet.size !== sitemapCount) sitemapErrors.push(`duplicate URLs: ${sitemapCount - sitemapUrlSet.size}`);
const missingUrls = [...expectedSitemapUrls].filter(url => !sitemapUrlSet.has(url));
const unexpectedUrls = [...sitemapUrlSet].filter(url => !expectedSitemapUrls.has(url));
if (missingUrls.length) sitemapErrors.push(`missing ${missingUrls.length} expected URLs: ${missingUrls.join(', ')}`);
if (unexpectedUrls.length) sitemapErrors.push(`unexpected ${unexpectedUrls.length} URLs: ${unexpectedUrls.join(', ')}`);
for (const url of sitemapUrlSet) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== SITE_URL || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.href !== url) {
      sitemapErrors.push(`noncanonical URL: ${url}`);
    }
  } catch {
    sitemapErrors.push(`invalid URL: ${url}`);
  }
}
if (sitemapErrors.length) failures.push({route:'/sitemap.xml',errors:sitemapErrors});
for (const path of ['/de', '/fr/not-a-page', '/ko/api/me']) {
  const response = await fetch(origin + path);
  if (response.status !== 404) failures.push({route:path,errors:[`expected 404, got ${response.status}`]});
}
console.log(JSON.stringify({checked, sitemapCount, expectedSitemapCount: expectedSitemapUrls.size, failures}, null, 2));
if (failures.length) process.exitCode = 1;
