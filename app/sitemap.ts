import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/pricing', '/showcases', '/ai-rap-song-generator', '/privacy-policy', '/terms-of-service'].map((path) => ({
    url: `https://migosai.design${path}`,
    changeFrequency: path.includes('policy') || path.includes('terms') ? 'yearly' as const : 'monthly' as const,
    priority: path === '' ? 1 : 0.7,
  }));
}
