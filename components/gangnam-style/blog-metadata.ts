import type { Metadata } from 'next';
import type { BlogPost } from '@/content/blog';
import { SITE_URL } from '@/content/public-pages';
import { GANGNAM_BLOG_PATH } from '@/content/gangnam-style-blog/shared';
import { getGangnamStyleCost } from '@/lib/gangnam-style';

export function gangnamBlogText(source: string): string {
  return source.replaceAll('{standardCredits}', String(getGangnamStyleCost('480p'))).replaceAll('{hdCredits}', String(getGangnamStyleCost('720p')));
}

export function gangnamBlogMetadata(post?: BlogPost): Metadata {
  const title = post?.metaTitle ?? 'Gangnam Style Blog: 10 Questions About the Song & AI Videos';
  const description = gangnamBlogText(post?.description ?? 'What is Gangnam Style? Explore its meaning, AI trio tutorials, photo tips, prompts, music, video formats and costs in ten practical guides.');
  const url = `${SITE_URL}${post?.path ?? GANGNAM_BLOG_PATH}`;
  return {
    title: { absolute: title }, description,
    alternates: { canonical: url, languages: { en: url, 'x-default': url } },
    openGraph: { title, description, url, siteName: 'MigosAI', type: post ? 'article' : 'website', locale: 'en_US', images: [{ url: '/gangnam-style/photo-trio-seoul.jpg', alt: 'Gangnam Style trio reference scene' }], ...(post ? { publishedTime: post.datePublished, modifiedTime: post.dateModified } : {}) },
    twitter: { card: 'summary_large_image', title, description, images: ['/gangnam-style/photo-trio-seoul.jpg'] },
  };
}
