import { notFound } from "next/navigation";
import { OzilBlogArticle } from "@/components/ozil-goal/blog";
import { ozilBlogMetadata } from "@/components/ozil-goal/blog-metadata";
import { getOzilBlogPost, ozilBlogPosts } from "@/content/ozil-blog";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return ozilBlogPosts.map(post => ({ slug: post.slug })); }
async function resolvePost(params: Props["params"]) {
  const { slug } = await params;
  const post = getOzilBlogPost(slug);
  if (!post) notFound();
  return post;
}
export async function generateMetadata({ params }: Props) { return ozilBlogMetadata(await resolvePost(params)); }
export default async function Page({ params }: Props) { return <OzilBlogArticle post={await resolvePost(params)} />; }
