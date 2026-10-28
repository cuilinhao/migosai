import type { Metadata } from 'next';
import type { BlogPost } from '@/content/blog';
import { SITE_URL } from '@/content/public-pages';
import { GANGNAM_BLOG_PATH } from '@/content/gangnam-style-blog/shared';
import { getGangnamStyleCost } from '@/lib/gangnam-style';
import { getGangnamBlogTranslator } from '@/lib/i18n/gangnam-blog';
import { localizeHref, locales, localeTags, type Locale } from '@/lib/i18n/routing';

export function gangnamBlogText(source: string): string {
  return source.replaceAll('{standardCredits}', String(getGangnamStyleCost('480p'))).replaceAll('{hdCredits}', String(getGangnamStyleCost('720p')));
}

export function gangnamBlogMetadata(post?: BlogPost, locale: Locale = 'en'): Metadata {
  const t = getGangnamBlogTranslator(locale);
  const title = t(post?.metaTitle ?? 'Gangnam Style Blog: 10 Questions About the Song & AI Videos');
  const description = gangnamBlogText(t(post?.description ?? 'What is Gangnam Style? Explore its meaning, AI trio tutorials, photo tips, prompts, music, video formats and costs in ten practical guides.'));
  const path = post?.path ?? GANGNAM_BLOG_PATH;
  const url = `${SITE_URL}${localizeHref(path, locale)}`;
  return {
    title: { absolute: title }, description,
    alternates: { canonical: url, languages: Object.fromEntries([...locales.map(language => [language, `${SITE_URL}${localizeHref(path, language)}`]), ['x-default', `${SITE_URL}${path}`]]) },
    openGraph: { title, description, url, siteName: 'MigosAI', type: post ? 'article' : 'website', locale: localeTags[locale].replace('-', '_'), alternateLocale: locales.filter(language => language !== locale).map(language => localeTags[language].replace('-', '_')), images: [{ url: '/gangnam-style/photo-trio-seoul.jpg', alt: t('Gangnam Style trio reference scene') }], ...(post ? { publishedTime: post.datePublished, modifiedTime: post.dateModified } : {}) },
    twitter: { card: 'summary_large_image', title, description, images: ['/gangnam-style/photo-trio-seoul.jpg'] },
  };
}
