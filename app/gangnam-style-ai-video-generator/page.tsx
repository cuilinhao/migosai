import { GangnamStylePage } from '@/components/gangnam-style/page-content';
import source from '@/content/gangnam-style-page.json';
import { getLocale, localizeMetadata } from '@/lib/i18n/server';
import { getGangnamTranslator } from '@/lib/i18n/gangnam-style';

export async function generateMetadata() {
  const t = getGangnamTranslator(await getLocale());
  return localizeMetadata({
    title: t(source.title), description: t(source.description),
    openGraph: { title: t(source.title), description: t(source.description), type: 'website', images: [{ url: '/gangnam-style/photo-trio-seoul.jpg', width: 1280, height: 720, alt: t('Gangnam Style AI trio video example') }] },
    twitter: { card: 'summary_large_image', title: t(source.title), description: t(source.description), images: ['/gangnam-style/photo-trio-seoul.jpg'] },
  });
}
export default function Page() { return <GangnamStylePage/>; }
