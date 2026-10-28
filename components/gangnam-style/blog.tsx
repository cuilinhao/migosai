import Link from 'next/link';
import type { BlogPost } from '@/content/blog';
import { BlogBlocks, plainText, renderInline } from '@/components/blog/blog-shared';
import { SITE_URL } from '@/content/public-pages';
import { GANGNAM_BLOG_PATH, GANGNAM_BLOG_UPDATED, GANGNAM_GENERATOR_PATH, gangnamBlogPosts } from '@/content/gangnam-style-blog';
import { gangnamBlogText } from './blog-metadata';
import '@/app/geo.css';
import './blog.css';

function StructuredData({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}/>;
}
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

function ArticleCard({ post }: { post: BlogPost }) {
  return <article className="blog-card">
    <p className="blog-card-meta">{post.eyebrow}</p>
    <h3><Link href={post.path}>{post.title}</Link></h3>
    <p>{gangnamBlogText(post.excerpt)}</p>
    <p className="blog-card-footer"><time dateTime={post.datePublished}>{dateLabel(post.datePublished)}</time><Link href={post.path} aria-label={`Read article: ${post.title}`}>Read article →</Link></p>
  </article>;
}

export function GangnamBlogPreview() {
  const featured = ['what-is-gangnam-style', 'how-to-make-gangnam-style-ai-video', 'gangnam-style-ai-video-music'];
  return <section className="gangnam-blog-preview" lang="en" id="gangnam-guides" aria-labelledby="gangnam-guides-title"><div className="section-container">
    <div className="gangnam-blog-heading"><div><p className="eyebrow">GANGNAM STYLE · THE BLOG</p><h2 id="gangnam-guides-title">Your questions, answered.</h2></div><Link href={GANGNAM_BLOG_PATH}>Explore all 10 guides ↗</Link></div>
    <p className="gangnam-blog-summary">From the meaning of Gangnam Style to making a trio with your own photos. Start with the question on your mind.</p>
    <div className="gangnam-blog-featured">{gangnamBlogPosts.filter(post => featured.includes(post.slug)).map(post => <ArticleCard post={post} key={post.slug}/>)}</div>
  </div></section>;
}

function GeneratorCta() {
  return <div className="geo-cta section-container"><h2>Turn your photos into a Gangnam Style trio</h2><p>Choose three friends, one selfie or three pets. Preview the reference, select your quality and check the credit cost before you generate.</p><Link className="pill-gradient-button" href={`${GANGNAM_GENERATOR_PATH}#studio`}>Open the Gangnam Style generator</Link></div>;
}

export function GangnamBlogIndex() {
  const url = `${SITE_URL}${GANGNAM_BLOG_PATH}`;
  return <div className="geo-page blog-index gangnam-blog" lang="en">
    <StructuredData data={{ '@context': 'https://schema.org', '@type': 'Blog', '@id': `${url}#blog`, url, name: 'Gangnam Style Blog', description: 'Ten questions about Gangnam Style and making AI trio videos.', inLanguage: 'en', dateModified: GANGNAM_BLOG_UPDATED, publisher: { '@type': 'Organization', name: 'MigosAI', url: SITE_URL }, blogPost: gangnamBlogPosts.map(post => ({ '@type': 'BlogPosting', headline: post.title, url: `${SITE_URL}${post.path}`, inLanguage: 'en', datePublished: post.datePublished })) }}/>
    <header className="geo-header section-container gangnam-blog-hero"><div>
      <nav className="geo-breadcrumb" aria-label="Breadcrumb"><Link href={GANGNAM_GENERATOR_PATH}>Gangnam Style</Link><span aria-hidden="true">/</span><span aria-current="page">Blog</span></nav>
      <p className="eyebrow">GANGNAM STYLE · TEN QUESTIONS</p><h1>Know the song.<br/>Make your own trio.</h1>
      <p className="geo-intro">What it means, where it started and how to make an AI video with your own photos. Ten answers, from the first upload to the finished clip.</p>
      <a className="pill-gradient-button" href="#articles">Find your answer ↓</a>
    </div><figure className="gangnam-blog-cover"><img src="/gangnam-style/photo-trio-seoul.jpg" width="1280" height="720" alt="A performer in the Gangnam Style AI trio reference scene"/><figcaption>AI trio reference sample · A different scene from PSY’s music video</figcaption></figure></header>
    <section className="geo-section section-container" id="articles"><h2>10 questions about Gangnam Style</h2><div className="blog-grid">{gangnamBlogPosts.map(post => <ArticleCard post={post} key={post.slug}/>)}</div></section>
    <GeneratorCta/>
  </div>;
}

export function GangnamBlogArticle({ post }: { post: BlogPost }) {
  const url = `${SITE_URL}${post.path}`;
  const text = (value: string) => plainText(gangnamBlogText(value));
  const schema = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'BlogPosting', '@id': `${url}#article`, headline: post.title, description: text(post.description), url, mainEntityOfPage: url, datePublished: post.datePublished, dateModified: post.dateModified, inLanguage: 'en', image: `${SITE_URL}/gangnam-style/photo-trio-seoul.jpg`, author: { '@type': 'Organization', name: 'MigosAI editorial team', url: SITE_URL }, publisher: { '@type': 'Organization', name: 'MigosAI', url: SITE_URL }, isPartOf: { '@type': 'Blog', '@id': `${SITE_URL}${GANGNAM_BLOG_PATH}#blog` }, citation: post.sources.map(source => new URL(source.url, SITE_URL).href) },
    { '@type': 'FAQPage', '@id': `${url}#faq`, inLanguage: 'en', mainEntity: post.faqs.map(faq => ({ '@type': 'Question', name: text(faq.question), acceptedAnswer: { '@type': 'Answer', text: text(faq.answer) } })) },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Gangnam Style', item: `${SITE_URL}${GANGNAM_GENERATOR_PATH}` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}${GANGNAM_BLOG_PATH}` },
      { '@type': 'ListItem', position: 3, name: post.label, item: url },
    ] },
  ] };
  return <article className="geo-page blog-article gangnam-blog" lang="en">
    <StructuredData data={schema}/>
    <header className="geo-header section-container">
      <nav className="geo-breadcrumb" aria-label="Breadcrumb"><Link href={GANGNAM_GENERATOR_PATH}>Gangnam Style</Link><span aria-hidden="true">/</span><Link href={GANGNAM_BLOG_PATH}>Blog</Link><span aria-hidden="true">/</span><span aria-current="page">{post.label}</span></nav>
      <p className="eyebrow">{post.eyebrow}</p><h1>{post.title}</h1><p className="geo-intro">{renderInline(gangnamBlogText(post.intro))}</p>
      <p className="geo-note blog-byline">By the MigosAI editorial team · Published <time dateTime={post.datePublished}>{dateLabel(post.datePublished)}</time></p>
    </header>
    <nav className="section-container gangnam-blog-contents" aria-label="In this article"><strong>In this article</strong><ol>{post.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}<li><a href="#faq">Frequently asked questions</a></li></ol></nav>
    {post.sections.map(section => <section className="geo-section section-container" key={section.id} id={section.id}><h2>{section.title}</h2><div className="geo-prose blog-prose"><BlogBlocks blocks={section.blocks} t={gangnamBlogText}/></div></section>)}
    <section className="geo-section section-container blog-faq" id="faq"><h2>Frequently asked questions</h2><div className="faq-grid">{post.faqs.map((faq, index) => <div className="faq-item" key={faq.question}><span className="faq-number">{index + 1}</span><div><h3>{faq.question}</h3><p>{renderInline(gangnamBlogText(faq.answer))}</p></div></div>)}</div></section>
    <section className="geo-section section-container" id="sources"><h2>Sources and product references</h2><ul className="blog-sources">{post.sources.map(source => <li key={source.url}><a href={source.url} rel="noopener">{source.label}</a></li>)}</ul></section>
    <aside className="geo-related section-container"><h2>More Gangnam Style questions</h2><div className="geo-link-grid">{gangnamBlogPosts.filter(other => other.slug !== post.slug).map(other => <Link key={other.slug} href={other.path}>{other.label} ↗</Link>)}</div><p><Link href={GANGNAM_BLOG_PATH}>All 10 guides</Link></p></aside>
    <GeneratorCta/>
  </article>;
}
