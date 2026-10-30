import source from '@/content/gangnam-style-page.json';
import { SITE_URL } from '@/content/public-pages';
import { GANGNAM_GENERATOR_PATH } from '@/content/gangnam-style-blog/shared';
import { getGangnamTranslator } from '@/lib/i18n/gangnam-style';
import { gangnamFactsCopy } from '@/lib/i18n/messages/gangnam-facts';
import { locales, localizeHref, type Locale } from '@/lib/i18n/routing';

export function GangnamEntities({ locale }: { locale: Locale }) {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', '@id': `${SITE_URL}/#org`,
        name: 'MigosAI', url: `${SITE_URL}/`,
        description: gangnamFactsCopy[locale].organizationDescription,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 447, height: 447 },
      },
      {
        '@type': 'WebSite', '@id': `${SITE_URL}/#website`,
        name: 'MigosAI', url: `${SITE_URL}/`,
        publisher: { '@id': `${SITE_URL}/#org` }, inLanguage: [...locales],
      },
    ],
  };
  return <script id="gangnam-site-entities" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}/>;
}

export function GangnamPageSchema({ locale }: { locale: Locale }) {
  const t = getGangnamTranslator(locale);
  const url = `${SITE_URL}${localizeHref(GANGNAM_GENERATOR_PATH, locale)}`;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': `${url}#webpage`, url,
        name: t(source.title), description: t(source.description), inLanguage: locale,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        publisher: { '@id': `${SITE_URL}/#org` },
        mainEntity: { '@id': `${url}#software` },
      },
      {
        '@type': 'SoftwareApplication', '@id': `${url}#software`, url,
        name: t(source.title), description: t(source.description),
        applicationCategory: 'MultimediaApplication', operatingSystem: 'Web browser', inLanguage: locale,
        publisher: { '@id': `${SITE_URL}/#org` },
        mainEntityOfPage: { '@id': `${url}#webpage` },
        disambiguatingDescription: gangnamFactsCopy[locale].independence,
      },
    ],
  };
  return <script id="gangnam-page-entities" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}/>;
}
