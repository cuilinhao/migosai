import { localizeMetadata } from '@/lib/i18n/server';
import { FlyingCarPage, flyingCarMetadata } from '@/components/flyingcar/page-content';

export async function generateMetadata() { return localizeMetadata(flyingCarMetadata('home')); }
export default async function Page() { return <FlyingCarPage />; }
