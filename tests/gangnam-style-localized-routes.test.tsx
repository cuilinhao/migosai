import { describe, expect, it, vi } from 'vitest';
import { getGangnamTranslator } from '@/lib/i18n/gangnam-style';
import type { Locale } from '@/lib/i18n/routing';
import LocalizedPage, { generateMetadata } from '@/app/[locale]/[[...path]]/page';

const request = vi.hoisted(() => ({ locale: 'ko' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-migos-locale': request.locale, 'x-migos-pathname': '/gangnam-style-ai-video-generator' }) }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); }, permanentRedirect: () => { throw new Error('REDIRECT'); } }));

describe('localized Gangnam Style route resolution', () => {
  it.each(['ko','ja','fr','es','zh-TW'])('resolves the actual %s page and metadata instead of a 404', async locale => {
    request.locale = locale;
    const props = { params: Promise.resolve({ locale, path: ['gangnam-style-ai-video-generator'] }) };
    const page = await LocalizedPage(props);
    expect(page).toBeTruthy();
    const metadata = await generateMetadata(props);
    expect(metadata.title).toBe(getGangnamTranslator(locale as Locale)('Gangnam Style AI Video Generator & Trio Templates'));
    expect(metadata.title).not.toBe('Gangnam Style AI Video Generator & Trio Templates');
    expect(metadata.alternates?.canonical).toBe(`https://migosai.design/${locale}/gangnam-style-ai-video-generator`);
  });
});
