import { GangnamBlogIndex } from '@/components/gangnam-style/blog';
import { gangnamBlogMetadata } from '@/components/gangnam-style/blog-metadata';
export function generateMetadata() { return gangnamBlogMetadata(); }
export default function Page() { return <GangnamBlogIndex/>; }
