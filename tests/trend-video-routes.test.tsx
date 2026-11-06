import { describe, expect, it, vi } from 'vitest';
import LocalizedPage, { generateMetadata } from '../app/[locale]/[[...path]]/page';
import { locales, type Locale } from '../lib/i18n/routing';
const request = vi.hoisted(() => ({ locale: 'ja', path: '/goodbye-2026-welcome-2027' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-migos-locale': request.locale, 'x-migos-pathname': request.path }) }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); }, permanentRedirect: () => { throw new Error('REDIRECT'); } }));
const translated = locales.filter((locale): locale is Exclude<Locale,'en'> => locale !== 'en');
for (const slug of ['goodbye-2026-welcome-2027','stones-to-castle-ai']) describe(slug, () => {
  it.each(translated)('resolves the %s page with translated metadata and reciprocal alternates', async locale => {
    request.locale = locale; request.path = `/${slug}`;
    const props = { params: Promise.resolve({ locale, path: [slug] }) };
    expect(await LocalizedPage(props)).toBeTruthy();
    const metadata = await generateMetadata(props);
    expect(metadata.alternates?.canonical).toBe(`https://migosai.design/${locale}/${slug}`);
    expect(Object.keys(metadata.alternates?.languages ?? {})).toHaveLength(7);
    const translatedDescription = metadata.description;
    expect(translatedDescription).toBeTruthy();
    request.locale = 'en';
    expect(translatedDescription).not.toBe((await generateMetadata(props)).description);
  });
  it('does not turn arbitrary nested paths into duplicate pages', async () => {
    await expect(LocalizedPage({ params: Promise.resolve({ locale: 'ja', path: [slug, 'does-not-exist'] }) })).rejects.toThrow('NOT_FOUND');
  });
});
