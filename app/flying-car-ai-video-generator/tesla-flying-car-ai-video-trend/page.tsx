import { localizeMetadata } from '@/lib/i18n/server';
import { FlyingCarPage, flyingCarMetadata } from '@/components/flyingcar/page-content';

const slug = 'tesla-flying-car-ai-video-trend';
export async function generateMetadata() { return localizeMetadata(flyingCarMetadata(slug)); }
export default async function Page() { return <FlyingCarPage slug={slug} />; }
