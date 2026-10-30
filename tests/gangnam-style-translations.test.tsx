import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import source from '../content/gangnam-style-page.json';
import { gangnamBlogPosts } from '../content/gangnam-style-blog';
import { gangnamUiMessages, getGangnamTranslator } from '../lib/i18n/gangnam-style';
import { gangnamBlogMessages, translateGangnamPost } from '../lib/i18n/gangnam-blog';
import { GangnamBlogArticle, GangnamBlogIndex } from '../components/gangnam-style/blog';
import { LocaleProvider } from '../components/i18n/locale-provider';
import { createGangnamMessageTranslator, translateGangnamMessage } from '../components/gangnam-style/use-translations';
import { createTranslator, getMessages } from '../lib/i18n';
import { locales, localizeHref } from '../lib/i18n/routing';

const translated = locales.filter(locale => locale !== 'en');
const placeholders = (text: string) => [...text.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
const links = (text: string) => [...text.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]).sort();
const blogKeys = new Set<string>();
const addBlog = (text: string) => blogKeys.add(text.trim());
for (const post of gangnamBlogPosts) {
  for (const key of ['title', 'metaTitle', 'description', 'label', 'excerpt', 'eyebrow', 'intro'] as const) addBlog(post[key]);
  for (const section of post.sections) {
    addBlog(section.title);
    for (const block of section.blocks) {
      if (block.type === 'code') addBlog(block.label);
      else if ('text' in block) addBlog(block.text);
      else if ('items' in block) block.items.forEach(addBlog);
      else { addBlog(block.caption); block.headings.forEach(addBlog); block.rows.flat().forEach(addBlog); }
    }
  }
  post.faqs.forEach(faq => { addBlog(faq.question); addBlog(faq.answer); });
  post.sources.forEach(item => addBlog(item.label));
}

const uiKeys = new Set<string>([source.title, source.description]);
const blogUiKeys = new Set<string>();
const addUi = (text: string) => { if (/[A-Za-z]/.test(text)) uiKeys.add(text.trim()); };
function visitTree(node: any) {
  if (typeof node === 'string') return addUi(node);
  for (const [key, value] of Object.entries(node.attrs ?? {})) if (['alt', 'aria-label', 'title', 'placeholder'].includes(key) && typeof value === 'string') addUi(value);
  node.children?.forEach(visitTree);
}
visitTree(source.content);
for (const file of ['page-content.tsx', 'generator.tsx', 'media.tsx', 'blog.tsx', 'blog-metadata.ts', 'use-translations.ts']) {
  const ast = ts.createSourceFile(file, readFileSync(`components/gangnam-style/${file}`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function literals(node: ts.Node) {
    if (ts.isStringLiteral(node)) {
      if (['blog.tsx', 'blog-metadata.ts'].includes(file)) blogUiKeys.add(node.text.trim());
      else addUi(node.text);
    }
    else if (ts.isConditionalExpression(node)) { literals(node.whenTrue); literals(node.whenFalse); }
    else ts.forEachChild(node, literals);
  }
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && node.arguments[0]) literals(node.arguments[0]);
    if (['generator.tsx', 'media.tsx'].includes(file) && ts.isPropertyAssignment(node) && ['label', 'title', 'description', 'name', 'solo'].includes(node.name.getText(ast)) && ts.isStringLiteral(node.initializer)) addUi(node.initializer.text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

describe('complete Gangnam translations', () => {
  it.each(translated)('%s translates every article field and page/control string without losing placeholders or links', locale => {
    for (const [keys, messages] of [[blogKeys, gangnamBlogMessages[locale]], [uiKeys, gangnamUiMessages[locale]], [blogUiKeys, { ...gangnamUiMessages[locale], ...gangnamBlogMessages[locale] }]] as const) {
      for (const key of keys) {
        expect(messages[key], `${locale}: ${key}`).toBeTruthy();
        expect(placeholders(messages[key]), key).toEqual(placeholders(key));
        expect(links(messages[key]), key).toEqual(links(key));
        if (key.split(/\s+/).length > 8 && !key.startsWith('0–') && !key.startsWith('12.3')) expect(messages[key], key).not.toBe(key);
      }
    }
    const t = getGangnamTranslator(locale);
    expect(t('Preparing photo {current} of {total}…', { current: 2, total: 3 })).not.toContain('{');
    expect(t('Choose a JPEG, PNG or WebP photo.')).not.toBe('Choose a JPEG, PNG or WebP photo.');
    expect(t('Adding the template soundtrack…')).not.toBe('Adding the template soundtrack…');
    const error = translateGangnamMessage(t, 'Your prepared photo is 200 × 300 pixels. Choose a photo with both sides between 301 and 5999 pixels and a width-to-height ratio greater than 0.4 and less than 2.5.');
    expect(error).not.toContain('Your prepared photo');
    expect(error).toContain('200');
    expect(error).toContain('300');
    expect(error).not.toContain('{');
    const shared = createTranslator(getMessages(locale));
    const runtime = createGangnamMessageTranslator(locale, shared);
    expect(runtime('Request failed (503).')).toBe(shared('Request failed ({status}).', { status: 503 }));
    expect(runtime('Photo upload failed (HTTP 413).')).toBe(shared('Photo upload failed (HTTP {status}).', { status: 413 }));
  });

  it.each(translated)('%s renders translated articles, metadata, local links, and original executable prompts', locale => {
    const index = renderToStaticMarkup(<LocaleProvider locale={locale} messages={{}}><GangnamBlogIndex locale={locale}/></LocaleProvider>);
    expect(index).toContain(`lang="${locale}"`);
    for (const sourcePost of gangnamBlogPosts) {
      const post = translateGangnamPost(sourcePost, locale);
      expect(post.title).not.toBe(sourcePost.title);
      expect(post.description).not.toBe(sourcePost.description);
      expect(index).toContain(`href="${localizeHref(post.path, locale)}"`);
      const html = renderToStaticMarkup(<LocaleProvider locale={locale} messages={{}}><GangnamBlogArticle post={sourcePost} locale={locale}/></LocaleProvider>);
      expect(html).toContain(renderToStaticMarkup(<h1>{post.title}</h1>));
      expect(html).toContain(`"inLanguage":"${locale}"`);
      expect(html).toContain(`href="${localizeHref('/gangnam-style-ai-video-generator#studio', locale)}"`);
      expect(html).not.toMatch(/\{(?:standardCredits|hdCredits)\}/);
      const originals = sourcePost.sections.flatMap(section => section.blocks).filter(block => block.type === 'code');
      for (const block of originals) expect(html).toContain(renderToStaticMarkup(<code>{block.text}</code>));
      for (const href of links(JSON.stringify(post)).filter(href => href.startsWith('/'))) expect(html).toContain(`href="${localizeHref(href, locale)}"`);
    }
  });
});
