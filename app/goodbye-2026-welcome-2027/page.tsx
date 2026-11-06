import { TrendVideoSchema } from '@/components/trend-video/structured-data';
import { TrendVideoPage } from '@/components/trend-video/page-content';
import { getTrendVideoCopy } from '@/content/trend-video';
import { getLocale, localizeMetadata } from '@/lib/i18n/server';

export async function generateMetadata() {
  const copy = getTrendVideoCopy('goodbye-2026-welcome-2027', await getLocale());
  return localizeMetadata({ title: { absolute: copy.seoTitle }, description: copy.seoDescription, openGraph: { title: copy.seoTitle, description: copy.seoDescription, type: 'website', images: [{ url: '/trend-video/goodbye-2026-welcome-2027.webp', alt: copy.navTitle }] } });
}
export default async function Page() {
  const locale = await getLocale();
  return <><TrendVideoSchema effectId="goodbye-2026-welcome-2027" locale={locale} /><TrendVideoPage effectId="goodbye-2026-welcome-2027" /></>;
}
