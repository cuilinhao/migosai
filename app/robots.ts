import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/app/', '/sign-in', '/sign-up'] },
    sitemap: 'https://migosai.design/sitemap.xml',
  };
}
