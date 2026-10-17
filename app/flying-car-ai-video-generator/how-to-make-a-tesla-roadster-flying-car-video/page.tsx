import { localizeMetadata } from '@/lib/i18n/server';
import { FlyingCarPage, flyingCarMetadata } from '@/components/flyingcar/page-content';

const slug = 'how-to-make-a-tesla-roadster-flying-car-video';
export async function generateMetadata() { return localizeMetadata(flyingCarMetadata(slug)); }
export default async function Page() { return <FlyingCarPage slug={slug} />; }
