import Link from 'next/link';
import type { BlogPost } from '@/content/blog';
import { BlogBlocks, plainText, renderInline } from '@/components/blog/blog-shared';
import { SITE_URL } from '@/content/public-pages';
import { GANGNAM_BLOG_PATH, GANGNAM_BLOG_INDEX_UPDATED, GANGNAM_GENERATOR_PATH, gangnamBlogPosts } from '@/content/gangnam-style-blog';
import { gangnamBlogText } from './blog-metadata';
import { GangnamEntities } from './structured-data';
import { getGangnamBlogTranslator, translateGangnamPost } from '@/lib/i18n/gangnam-blog';
import { localizeHref, localeTags, type Locale } from '@/lib/i18n/routing';
import '@/app/geo.css';
import './blog.css';

function StructuredData({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}/>;
}
const dateLabel = (date: string, locale: Locale) => new Intl.DateTimeFormat(localeTags[locale], { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

function ArticleCard({ post, locale }: { post: BlogPost; locale: Locale }) {
  const t = getGangnamBlogTranslator(locale);
  return <article className="blog-card">
    <p className="blog-card-meta">{post.eyebrow}</p>
    <h3><Link href={localizeHref(post.path, locale)}>{post.title}</Link></h3>
    <p>{gangnamBlogText(post.excerpt)}</p>
    <p className="blog-card-footer"><time dateTime={post.datePublished}>{dateLabel(post.datePublished, locale)}</time><Link href={localizeHref(post.path, locale)} aria-label={t('Read article: {title}', { title: post.title })}>{t("Read article →")}</Link></p>
  </article>;
}

export function GangnamBlogPreview({ locale = 'en' }: { locale?: Locale } = {}) {
  const t = getGangnamBlogTranslator(locale);
  const posts = gangnamBlogPosts.map(post => translateGangnamPost(post, locale));
  const featured = ['what-is-gangnam-style', 'how-to-make-gangnam-style-ai-video', 'gangnam-style-ai-video-music'];
  return <section className="gangnam-blog-preview" lang={locale} id="gangnam-guides" aria-labelledby="gangnam-guides-title"><div className="section-container">
    <div className="gangnam-blog-heading"><div><p className="eyebrow">{t("GANGNAM STYLE · THE BLOG")}</p><h2 id="gangnam-guides-title">{t("Your questions, answered.")}</h2></div><Link href={localizeHref(GANGNAM_BLOG_PATH, locale)}>{t("Explore all 10 guides ↗")}</Link></div>
    <p className="gangnam-blog-summary">{t("From the meaning of Gangnam Style to making a trio with your own photos. Start with the question on your mind.")}</p>
    <div className="gangnam-blog-featured">{posts.filter(post => featured.includes(post.slug)).map(post => <ArticleCard post={post} locale={locale} key={post.slug}/>)}</div>
    <nav className="geo-related" aria-label={t("More Gangnam Style questions")}><div className="geo-link-grid">{posts.filter(post => !featured.includes(post.slug)).map(post => <Link href={localizeHref(post.path, locale)} key={post.slug}>{post.label} ↗</Link>)}</div></nav>
  </div></section>;
}

function GeneratorCta({ locale }: { locale: Locale }) {
  const t = getGangnamBlogTranslator(locale);
  return <div className="geo-cta section-container"><h2>{t("Turn your photos into a Gangnam Style trio")}</h2><p>{t("Choose three friends, one selfie or three pets. Preview the reference, select your quality and check the credit cost before you generate.")}</p><Link className="pill-gradient-button" href={localizeHref(`${GANGNAM_GENERATOR_PATH}#studio`, locale)}>{t("Open the Gangnam Style generator")}</Link></div>;
}

export function GangnamBlogIndex({ locale = 'en' }: { locale?: Locale } = {}) {
  const t = getGangnamBlogTranslator(locale);
  const posts = gangnamBlogPosts.map(post => translateGangnamPost(post, locale));
  const url = `${SITE_URL}${localizeHref(GANGNAM_BLOG_PATH, locale)}`;
  return <div className="geo-page blog-index gangnam-blog" lang={locale}>
    <StructuredData data={{ '@context': 'https://schema.org', '@type': 'Blog', '@id': `${url}#blog`, url, name: t('Gangnam Style Blog'), description: t('Ten questions about Gangnam Style and making AI trio videos.'), inLanguage: locale, dateModified: GANGNAM_BLOG_INDEX_UPDATED, isPartOf: { '@id': `${SITE_URL}/#website` }, publisher: { '@id': `${SITE_URL}/#org` }, blogPost: posts.map(post => ({ '@type': 'BlogPosting', headline: post.title, url: `${SITE_URL}${localizeHref(post.path, locale)}`, inLanguage: locale, datePublished: post.datePublished })) }}/>
    <GangnamEntities locale={locale}/>
    <header className="geo-header section-container gangnam-blog-hero"><div>
      <nav className="geo-breadcrumb" aria-label={t("Breadcrumb")}><Link href={localizeHref(GANGNAM_GENERATOR_PATH, locale)}>{t("Gangnam Style")}</Link><span aria-hidden="true">/</span><span aria-current="page">{t("Blog")}</span></nav>
      <p className="eyebrow">{t("GANGNAM STYLE · TEN QUESTIONS")}</p><h1>{t("Gangnam Style AI Video: 10 Practical Guides")}</h1>
      <p className="geo-intro">{t("Know the song.")} {t("Make your own trio.")}</p>
      <p className="geo-intro">{t("What it means, where it started and how to make an AI video with your own photos. Ten answers, from the first upload to the finished clip.")}</p>
      <a className="pill-gradient-button" href="#articles">{t("Find your answer ↓")}</a>
    </div><figure className="gangnam-blog-cover"><img src="/gangnam-style/photo-trio-seoul.jpg" width="1280" height="720" alt={t("A performer in the Gangnam Style AI trio reference scene")}/><figcaption>{t("AI trio reference sample · A different scene from PSY’s music video")}</figcaption></figure></header>
    <section className="geo-section section-container" id="articles"><h2>{t("10 questions about Gangnam Style")}</h2><div className="blog-grid">{posts.map(post => <ArticleCard post={post} locale={locale} key={post.slug}/>)}</div></section>
    <GeneratorCta locale={locale}/>
  </div>;
}

export function GangnamBlogArticle({ post: sourcePost, locale = 'en' }: { post: BlogPost; locale?: Locale }) {
  const t = getGangnamBlogTranslator(locale);
  const post = translateGangnamPost(sourcePost, locale);
  const posts = gangnamBlogPosts.map(post => translateGangnamPost(post, locale));
  const url = `${SITE_URL}${localizeHref(post.path, locale)}`;
  const text = (value: string) => plainText(gangnamBlogText(value));
  const schema = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'BlogPosting', '@id': `${url}#article`, headline: post.title, description: text(post.description), url, mainEntityOfPage: url, datePublished: post.datePublished, dateModified: post.dateModified, inLanguage: locale, image: `${SITE_URL}/gangnam-style/photo-trio-seoul.jpg`, author: { '@type': 'Organization', name: t('MigosAI editorial team'), url: SITE_URL }, publisher: { '@id': `${SITE_URL}/#org` }, isPartOf: { '@type': 'Blog', '@id': `${SITE_URL}${localizeHref(GANGNAM_BLOG_PATH, locale)}#blog` }, citation: post.sources.map(source => new URL(localizeHref(source.url, locale), SITE_URL).href) },
    { '@type': 'FAQPage', '@id': `${url}#faq`, inLanguage: locale, mainEntity: post.faqs.map(faq => ({ '@type': 'Question', name: text(faq.question), acceptedAnswer: { '@type': 'Answer', text: text(faq.answer) } })) },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('Gangnam Style'), item: `${SITE_URL}${localizeHref(GANGNAM_GENERATOR_PATH, locale)}` },
      { '@type': 'ListItem', position: 2, name: t('Blog'), item: `${SITE_URL}${localizeHref(GANGNAM_BLOG_PATH, locale)}` },
      { '@type': 'ListItem', position: 3, name: post.label, item: url },
    ] },
  ] };
  return <article className="geo-page blog-article gangnam-blog" lang={locale}>
    <StructuredData data={schema}/>
    <GangnamEntities locale={locale}/>
    <header className="geo-header section-container">
      <nav className="geo-breadcrumb" aria-label={t("Breadcrumb")}><Link href={localizeHref(GANGNAM_GENERATOR_PATH, locale)}>{t("Gangnam Style")}</Link><span aria-hidden="true">/</span><Link href={localizeHref(GANGNAM_BLOG_PATH, locale)}>{t("Blog")}</Link><span aria-hidden="true">/</span><span aria-current="page">{post.label}</span></nav>
      <p className="eyebrow">{post.eyebrow}</p><h1>{post.title}</h1><p className="geo-intro">{renderInline(gangnamBlogText(post.intro))}</p>
      <p className="geo-note blog-byline">{t("By the MigosAI editorial team · Published ")}<time dateTime={post.datePublished}>{dateLabel(post.datePublished, locale)}</time></p>
      <Link className="pill-gradient-button" href={localizeHref(GANGNAM_GENERATOR_PATH, locale)}>{t("Open the Gangnam Style generator")}</Link>
    </header>
    <nav className="section-container gangnam-blog-contents" aria-label={t("In this article")}><strong>{t("In this article")}</strong><ol>{post.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}<li><a href="#faq">{t("Frequently asked questions")}</a></li></ol></nav>
    {post.sections.map(section => <section className="geo-section section-container" key={section.id} id={section.id}><h2>{section.title}</h2><div className="geo-prose blog-prose"><BlogBlocks blocks={section.blocks} t={gangnamBlogText}/></div></section>)}
    <section className="geo-section section-container blog-faq" id="faq"><h2>{t("Frequently asked questions")}</h2><div className="faq-grid">{post.faqs.map((faq, index) => <div className="faq-item" key={faq.question}><span className="faq-number">{index + 1}</span><div><h3>{faq.question}</h3><p>{renderInline(gangnamBlogText(faq.answer))}</p></div></div>)}</div></section>
    <section className="geo-section section-container" id="sources"><h2>{t("Sources and product references")}</h2><ul className="blog-sources">{post.sources.map(source => <li key={source.url}><a href={localizeHref(source.url, locale)} rel="noopener">{source.label}</a></li>)}</ul></section>
    <aside className="geo-related section-container"><h2>{t("More Gangnam Style questions")}</h2><div className="geo-link-grid">{posts.filter(other => other.slug !== post.slug).map(other => <Link key={other.slug} href={localizeHref(other.path, locale)}>{other.label} ↗</Link>)}</div><p><Link href={localizeHref(GANGNAM_BLOG_PATH, locale)}>{t("All 10 guides")}</Link></p></aside>
    <GeneratorCta locale={locale}/>
  </article>;
}
