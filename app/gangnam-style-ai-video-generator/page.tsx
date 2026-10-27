import { GangnamStylePage } from '@/components/gangnam-style/page-content';
import source from '@/content/gangnam-style-page.json';
import { localizeMetadata } from '@/lib/i18n/server';

export async function generateMetadata() {
  return localizeMetadata({
    title: source.title, description: source.description,
    openGraph: { title: source.title, description: source.description, type: 'website', images: [{ url: '/gangnam-style/photo-trio-seoul.jpg', width: 1080, height: 1080, alt: 'Gangnam Style AI trio video example' }] },
    twitter: { card: 'summary_large_image', title: source.title, description: source.description, images: ['/gangnam-style/photo-trio-seoul.jpg'] },
  });
}
export default function Page() { return <GangnamStylePage/>; }
