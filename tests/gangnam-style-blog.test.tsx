import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { gangnamBlogPosts, getGangnamBlogPost, GANGNAM_BLOG_PATH, GANGNAM_BLOG_UPDATED } from '../content/gangnam-style-blog';
import { GangnamBlogArticle, GangnamBlogIndex } from '../components/gangnam-style/blog';
import { gangnamBlogMetadata, gangnamBlogText } from '../components/gangnam-style/blog-metadata';
import { publicPages, SITE_URL } from '../content/public-pages';
import { getGangnamStyleCost } from '../lib/gangnam-style';
import { gangnamStylePrompt } from '../lib/prompts/gangnam-style';
import { BlogBlocks } from '../components/blog/blog-shared';
import { locales, localizeHref } from '../lib/i18n/routing';
import sitemap from '../app/sitemap';

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));

const expectedSlugs = [
  'what-is-gangnam-style', 'what-does-gangnam-style-mean', 'how-to-make-gangnam-style-ai-video',
  'best-photos-for-gangnam-style-ai-video', 'gangnam-style-ai-video-from-one-selfie',
  'gangnam-style-ai-pet-video', 'gangnam-style-ai-video-prompt', 'gangnam-style-ai-video-music',
  'gangnam-style-ai-video-format-resolution', 'gangnam-style-ai-video-cost-and-fixes',
];
const inlineLinks = (text: string) => [...text.matchAll(/\]\(([^)\s]+)\)/g)].map(match => match[1]);

describe('Gangnam Style question-led blog', () => {
  it('publishes exactly ten distinct answers and resolves only known slugs', () => {
    expect(gangnamBlogPosts.map(post => post.slug).sort()).toEqual([...expectedSlugs].sort());
    expect(new Set(gangnamBlogPosts.map(post => post.title)).size).toBe(10);
    expect(new Set(gangnamBlogPosts.map(post => post.description)).size).toBe(10);
    expect(getGangnamBlogPost('does-not-exist')).toBeUndefined();
    for (const post of gangnamBlogPosts) expect(getGangnamBlogPost(post.slug)).toBe(post);
  });

  it('indexes all sixty-six canonical localized blog pages with reciprocal alternates', () => {
    const entries = sitemap();
    expect(new Set(entries.map(entry => entry.url)).size).toBe(entries.length);
    for (const path of [GANGNAM_BLOG_PATH, ...gangnamBlogPosts.map(post => post.path)]) {
      const matches = entries.filter(entry => new URL(entry.url).pathname.endsWith(path));
      expect(matches.map(entry => entry.url)).toEqual(locales.map(locale => `${SITE_URL}${localizeHref(path, locale)}`));
      for (const match of matches) {
        expect(match.lastModified).toBe(GANGNAM_BLOG_UPDATED);
        expect(Object.keys(match.alternates?.languages ?? {})).toHaveLength(7);
      }
    }
  });

  it('links the index to all ten articles', () => {
    const html = renderToStaticMarkup(<GangnamBlogIndex/>);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    for (const post of gangnamBlogPosts) expect(html).toContain(`href="${post.path}"`);
  });

  it('uses live template prices in editorial copy', () => {
    expect(gangnamBlogText('{standardCredits}/{hdCredits}')).toBe(`${getGangnamStyleCost('480p')}/${getGangnamStyleCost('720p')}`);
  });

  it('publishes all three complete production prompts as readable text', () => {
    const post = getGangnamBlogPost('gangnam-style-ai-video-prompt')!;
    const html = renderToStaticMarkup(<GangnamBlogArticle post={post}/>);
    const blocks = post.sections.flatMap(section => section.blocks).filter(block => block.type === 'code');
    expect(blocks.map(block => block.text)).toEqual(['friends', 'selfie', 'pets'].map(mode => gangnamStylePrompt(mode as 'friends' | 'selfie' | 'pets')));
    for (const block of blocks) {
      expect(html).toContain(renderToStaticMarkup(<code>{block.text}</code>));
      expect(html).toContain(`aria-label="${block.label}"`);
    }
    expect(html.match(/<pre\b/g)).toHaveLength(3);
    expect(html).toContain('FFmpeg');
  });

  it('keeps code blocks literal, escaped and independent of prose translation', () => {
    const code = 'Edit @Video1.\n<script>alert(1)</script> **literal** {standardCredits}';
    const html = renderToStaticMarkup(<BlogBlocks blocks={[{ type: 'code', label: 'Prompt', text: code }]} t={value => value === 'Prompt' ? 'Video prompt' : 'changed'}/>);
    expect(html).toContain('aria-label="Video prompt"');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain(renderToStaticMarkup(<code>{code}</code>));
    expect(html).not.toContain('<script>');
  });

  it.each(expectedSlugs)('renders a complete, linked, crawlable article: %s', slug => {
    const post = getGangnamBlogPost(slug)!;
    expect(post.path).toBe(`${GANGNAM_BLOG_PATH}/${slug}`);
    expect(post.sections.length).toBeGreaterThanOrEqual(4);
    expect(post.faqs.length).toBeGreaterThanOrEqual(3);
    expect(post.sources.length).toBeGreaterThanOrEqual(2);
    const validPaths = new Set([...publicPages.map(page => page.path), GANGNAM_BLOG_PATH, ...gangnamBlogPosts.map(item => item.path)]);
    for (const href of inlineLinks(JSON.stringify(post)).filter(href => href.startsWith('/'))) {
      expect(validPaths.has(href.split('#')[0]), href).toBe(true);
    }
    const html = renderToStaticMarkup(<GangnamBlogArticle post={post}/>);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/\{(?:standardCredits|hdCredits)\}/);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const match of html.matchAll(/href="#([^"]+)"/g)) expect(ids).toContain(match[1]);
    expect(html).toContain('lang="en"');
    expect(html).toContain('href="/gangnam-style-ai-video-generator#studio"');
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    const graph = scripts[0]['@graph'];
    const article = graph.find((item: Record<string, unknown>) => item['@type'] === 'BlogPosting');
    expect(article.url).toBe(`${SITE_URL}${post.path}`);
    expect(article.headline).toBe(post.title);
    expect(article.inLanguage).toBe('en');
    const metadata = gangnamBlogMetadata(post);
    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}${post.path}`);
    expect(metadata.alternates?.languages).toEqual(Object.fromEntries([...locales.map(locale => [locale, `${SITE_URL}${localizeHref(post.path, locale)}`]), ['x-default', `${SITE_URL}${post.path}`]]));
    expect(metadata.openGraph?.siteName).toBe('MigosAI');
  });

  it('returns 404 for an unknown article instead of generic content', async () => {
    const route = await import('../app/gangnam-style-ai-video-generator/blog/[slug]/page');
    const params = Promise.resolve({ slug: 'does-not-exist' });
    await expect(route.default({ params })).rejects.toThrow('NOT_FOUND');
    await expect(route.generateMetadata({ params })).rejects.toThrow('NOT_FOUND');
  });
});
