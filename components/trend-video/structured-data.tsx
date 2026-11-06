import { getTrendVideoCopy } from '@/content/trend-video';
import { localeTags, type Locale } from '@/lib/i18n/routing';
import { buildAlternates } from '@/lib/seo';
import { TREND_VIDEO_COST, type TrendEffectId } from '@/lib/trend-video';

export function TrendVideoSchema({ effectId, locale }: { effectId: TrendEffectId; locale: Locale }) {
  const copy = getTrendVideoCopy(effectId, locale);
  const url = buildAlternates(`/${effectId}`, locale).canonical;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: copy.seoTitle, description: copy.seoDescription, inLanguage: localeTags[locale] },
      {
        '@type': 'FAQPage', '@id': `${url}#faq`, url: `${url}#trend-video-faq`, inLanguage: localeTags[locale],
        isPartOf: { '@id': `${url}#webpage` },
        mainEntity: [...copy.faqs, ...copy.commonFaqs].map(faq => ({ '@type': 'Question', name: faq.question, acceptedAnswer: { '@type': 'Answer', text: faq.answer.replaceAll('{credits}', String(TREND_VIDEO_COST)) } })),
      },
    ],
  };
  return <script id={`trend-video-${effectId}-schema`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
