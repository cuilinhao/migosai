import { TrendVideoSchema } from '@/components/trend-video/structured-data';
import { TrendVideoPage } from '@/components/trend-video/page-content';
import { getTrendVideoCopy } from '@/content/trend-video';
import { getLocale, localizeMetadata } from '@/lib/i18n/server';

export async function generateMetadata() {
  const copy = getTrendVideoCopy('stones-to-castle-ai', await getLocale());
  return localizeMetadata({ title: { absolute: copy.seoTitle }, description: copy.seoDescription, openGraph: { title: copy.seoTitle, description: copy.seoDescription, type: 'website', images: [{ url: '/trend-video/stones-to-castle-ai.webp', alt: copy.navTitle }] } });
}
export default async function Page() {
  const locale = await getLocale();
  return <><TrendVideoSchema effectId="stones-to-castle-ai" locale={locale} /><TrendVideoPage effectId="stones-to-castle-ai" /></>;
}
