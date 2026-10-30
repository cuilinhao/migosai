import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import NotFound from '@/app/not-found';
import { locales, localizeHref } from '@/lib/i18n/routing';
import { notFoundMessages } from '@/lib/i18n/not-found';

const request = vi.hoisted(() => ({ locale: 'en', pathname: '/' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-migos-locale': request.locale, 'x-migos-pathname': request.pathname }) }));

describe('localized missing-page recovery', () => {
  it.each(locales)('keeps %s recovery links in the requested language and topic', async locale => {
    request.locale = locale;
    request.pathname = '/gangnam-style-ai-video-generator/blog/missing';
    const html = renderToStaticMarkup(await NotFound());
    expect(html).toContain(notFoundMessages[locale].title);
    expect(html).toContain(`href="${localizeHref('/', locale)}"`);
    expect(html).toContain(`href="${localizeHref('/gangnam-style-ai-video-generator/blog', locale)}"`);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it('keeps general missing pages linked to the main blog', async () => {
    request.locale = 'en';
    request.pathname = '/missing';
    const html = renderToStaticMarkup(await NotFound());
    expect(html).toContain('href="/blog"');
    expect(html).not.toContain('href="/gangnam-style-ai-video-generator/blog"');
  });
});
