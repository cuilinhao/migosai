// Read-only smoke checks against a local Next.js or Cloudflare preview.
const origin = process.argv[2] || 'http://127.0.0.1:3100';
const locales = ['en', 'ko', 'ja', 'fr', 'es', 'zh-TW'];
const paths = ['/', '/pricing', '/showcases', '/ai-rap-song-generator', '/privacy-policy', '/terms-of-service', '/refund-policy', '/acceptable-use-policy', '/contact', '/hotel-lobby-ai-video-generator', '/hotel-lobby-ai-video-generator-free', '/hotel-lobby-ai-template', '/hotel-lobby-ai-filter', '/hotel-lobby-ai-generator', '/blog/best-hotel-lobby-ai-video-generators-2026', '/sign-in', '/sign-up', '/app/video-generator', '/app/my-videos', '/app/my-orders', '/app/my-credits'];
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
const xml = await (await fetch(origin + '/sitemap.xml')).text();
const sitemapCount = [...xml.matchAll(/<loc>/g)].length;
if (sitemapCount !== 90) failures.push({route:'/sitemap.xml',errors:[`expected 90 URLs, found ${sitemapCount}`]});
for (const path of ['/de', '/fr/not-a-page', '/ko/api/me']) {
  const response = await fetch(origin + path);
  if (response.status !== 404) failures.push({route:path,errors:[`expected 404, got ${response.status}`]});
}
console.log(JSON.stringify({checked, sitemapCount, failures}, null, 2));
if (failures.length) process.exitCode = 1;
