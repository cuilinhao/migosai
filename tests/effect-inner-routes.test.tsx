import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EffectPage, { generateMetadata } from '@/app/effects/[slug]/page';
import LocalizedPage, { generateMetadata as localizedMetadata } from '@/app/[locale]/[[...path]]/page';
import { SiteShell } from '@/components/site-shell';
import { AuthProvider } from '@/components/auth-provider';
import { LocaleProvider } from '@/components/i18n/locale-provider';
import { getMessages, locales, localizeHref, type Locale } from '@/lib/i18n';
import { getEffectTemplate, type EffectTemplate } from '@/content/effect-templates';

const request = vi.hoisted(() => ({ pathname: '/effects/003-ai-money-flex', locale: 'en' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-migos-locale': request.locale, 'x-migos-pathname': request.pathname }) }));
vi.mock('next/navigation', () => ({
  usePathname: () => localizeHref(request.pathname, request.locale as Locale),
  notFound: () => { throw new Error('NOT_FOUND'); },
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
  permanentRedirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
}));

const effectId = '003-ai-money-flex';
async function resolveLocalizedElement(locale: string, slug = effectId) {
  const element = await LocalizedPage({ params: Promise.resolve({ locale, path: ['effects', slug] }) });
  if (isValidElement(element) && typeof element.type === 'function') {
    return await (element.type as (props: unknown) => Promise<ReactElement>)(element.props);
  }
  return element;
}

describe('effect creation inner routes', () => {
  it('passes the exact selected effect and prompt to an isolated workspace', async () => {
    const template = getEffectTemplate(effectId)!;
    const page = await EffectPage({ params: Promise.resolve({ slug: effectId }) });
    expect(page.key).toBe(effectId);
    expect(page.props.template).toEqual(template);
    expect(page.props.template.effect.title).toBe('Money Flex');
    expect(page.props.template.prompt.length).toBeGreaterThan(40);
  });

  it('returns not found for unknown effect identifiers', async () => {
    await expect(EffectPage({ params: Promise.resolve({ slug: 'not-a-template' }) })).rejects.toThrow('NOT_FOUND');
    await expect(generateMetadata({ params: Promise.resolve({ slug: 'not-a-template' }) })).rejects.toThrow('NOT_FOUND');
    await expect(resolveLocalizedElement('fr', 'not-a-template')).rejects.toThrow('NOT_FOUND');
    await expect(resolveLocalizedElement('not-a-locale')).rejects.toThrow('NOT_FOUND');
    await expect(LocalizedPage({ params: Promise.resolve({ locale: 'fr', path: ['effects', effectId, 'unexpected'] }) })).rejects.toThrow('NOT_FOUND');
  });

  it.each(locales)('renders the selected template and one workspace shell on a direct %s URL', async locale => {
    request.pathname = `/effects/${effectId}`;
    request.locale = locale;
    const page = await resolveLocalizedElement(locale) as ReactElement<{ template: EffectTemplate }>;
    expect(page.props.template.effect.id).toBe(effectId);
    const html = renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><AuthProvider><SiteShell>{page}</SiteShell></AuthProvider></LocaleProvider>);
    expect(html.match(/<main(?:\s|>)/g)).toHaveLength(1);
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(html).toContain('portal-video-workspace');
    expect(html).not.toContain('portal-inner-page');
    expect(html).not.toContain('portal-footer');
    expect(html).toContain('Money Flex');
    expect(html).toContain('src="/effects/piclumen/003-ai-money-flex.mp4"');
    const activeLinks = [...html.matchAll(/<a\b([^>]*)>/g)].filter(([, attributes]) => attributes.includes('aria-current="page"')).map(([, attributes]) => attributes.match(/href="([^"]+)"/)?.[1]);
    expect(activeLinks).toEqual([localizeHref('/effects', locale)]);
    const metadata = await localizedMetadata({ params: Promise.resolve({ locale, path: ['effects', effectId] }) });
    expect(metadata.title).toContain('Money Flex');
    expect(metadata.alternates?.canonical).toBe(`https://migosai.design${localizeHref(`/effects/${effectId}`, locale)}`);
  });

  it.each(locales)('redirects the three existing templates to their dedicated localized generators in %s', async locale => {
    request.locale = locale;
    const cases = [
      ['001-hotel-lobby-rap-duo', '/hotel-lobby-ai-video-generator#generator'],
      ['002-flying-roadster', '/flying-car-ai-video-generator#create'],
      ['005-ozil-goal-ai', '/ozil-goal-generator#generator'],
    ];
    for (const [slug, destination] of cases) {
      request.pathname = `/effects/${slug}`;
      await expect(resolveLocalizedElement(locale, slug)).rejects.toThrow(`REDIRECT:${localizeHref(destination, locale)}`);
    }
  });
});
