import { GangnamBlogIndex } from '@/components/gangnam-style/blog';
import { gangnamBlogMetadata } from '@/components/gangnam-style/blog-metadata';
import { getLocale } from '@/lib/i18n/server';
export async function generateMetadata() { return gangnamBlogMetadata(undefined, await getLocale()); }
export default async function Page() { return <GangnamBlogIndex locale={await getLocale()}/>; }
