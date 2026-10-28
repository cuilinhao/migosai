import { notFound } from 'next/navigation';
import { GangnamBlogArticle } from '@/components/gangnam-style/blog';
import { gangnamBlogMetadata } from '@/components/gangnam-style/blog-metadata';
import { gangnamBlogPosts, getGangnamBlogPost } from '@/content/gangnam-style-blog';
import { getLocale } from '@/lib/i18n/server';
type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return gangnamBlogPosts.map(post => ({ slug: post.slug })); }
async function resolvePost(params: Props['params']) { const { slug } = await params; const post = getGangnamBlogPost(slug); if (!post) notFound(); return post; }
export async function generateMetadata({ params }: Props) { return gangnamBlogMetadata(await resolvePost(params), await getLocale()); }
export default async function Page({ params }: Props) { return <GangnamBlogArticle post={await resolvePost(params)} locale={await getLocale()}/>; }
