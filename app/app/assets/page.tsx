import { Assets } from '@/components/account/assets';
import { localizeMetadata } from '@/lib/i18n/server';

export async function generateMetadata() { return localizeMetadata({title:'My assets'}); }
export default function AssetsPage() { return <Assets/>; }
