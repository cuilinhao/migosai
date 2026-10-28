import ko from './messages/gangnam-blog/ko.json';
import ja from './messages/gangnam-blog/ja.json';
import fr from './messages/gangnam-blog/fr.json';
import es from './messages/gangnam-blog/es.json';
import zhTW from './messages/gangnam-blog/zh-TW.json';
import { createTranslator, type Messages } from './translator';
import { gangnamUiMessages } from './gangnam-style';
import type { Locale } from './routing';
import type { BlogPost } from '@/content/blog';

export const gangnamBlogMessages: Record<Locale, Messages> = { en: {}, ko, ja, fr, es, 'zh-TW': zhTW };
export function getGangnamBlogTranslator(locale: Locale) { return createTranslator({ ...gangnamUiMessages[locale], ...gangnamBlogMessages[locale] }); }
export function translateGangnamPost(post: BlogPost, locale: Locale): BlogPost {
  const t = getGangnamBlogTranslator(locale);
  return { ...post, title: t(post.title), metaTitle: t(post.metaTitle), description: t(post.description), label: t(post.label), excerpt: t(post.excerpt), eyebrow: t(post.eyebrow), intro: t(post.intro),
    sections: post.sections.map(section => ({ ...section, title: t(section.title), blocks: section.blocks.map(block => {
      if (block.type === 'code') return { ...block, label: t(block.label) };
      if ('text' in block) return { ...block, text: t(block.text) };
      if ('items' in block) return { ...block, items: block.items.map(item => t(item)) };
      return { ...block, caption: t(block.caption), headings: block.headings.map(item => t(item)), rows: block.rows.map(row => row.map(item => t(item))) };
    }) })),
    faqs: post.faqs.map(faq => ({ question: t(faq.question), answer: t(faq.answer) })),
    sources: post.sources.map(source => ({ ...source, label: t(source.label) })),
  };
}
