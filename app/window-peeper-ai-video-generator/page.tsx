import { WindowPeeperPage } from '@/components/window-peeper/page-content';
import { getWindowPeeperCopy } from '@/content/window-peeper';
import { getLocale, localizeMetadata } from '@/lib/i18n/server';

export async function generateMetadata() {
  const copy = getWindowPeeperCopy(await getLocale());
  return localizeMetadata({
    title: { absolute: copy.seoTitle },
    description: copy.seoDescription,
    openGraph: {
      title: copy.seoTitle,
      description: copy.seoDescription,
      type: 'website',
      images: [{ url: '/window-peeper/original-poster.jpg', width: 168, height: 300, alt: 'Window Peeper video trend reference' }],
    },
  });
}

export default function Page() {
  return <WindowPeeperPage offerTime={Date.now()} />;
}
