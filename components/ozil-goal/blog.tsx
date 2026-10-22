import Link from "next/link";
import { BlogBlocks, plainText, renderInline } from "@/components/blog/blog-shared";
import { SITE_URL } from "@/content/public-pages";
import { OZIL_BLOG_PATH, OZIL_BLOG_UPDATED, ozilBlogLanguages, ozilBlogPosts } from "@/content/ozil-blog";
import type { OzilBlogPost } from "@/content/ozil-blog/types";
import { ozilBlogText, ozilBlogUi } from "./blog-ui";
import "./blog.css";

function StructuredData({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

function ArticleCard({ post }: { post: OzilBlogPost }) {
  const ui = ozilBlogUi[post.language];
  return <article className="blog-card" lang={post.language}>
    <p className="blog-card-meta">{post.eyebrow}</p>
    <h3><Link href={post.path}>{post.title}</Link></h3>
    <p>{ozilBlogText(post.excerpt)}</p>
    <p className="blog-card-footer"><time dateTime={post.datePublished}>{new Intl.DateTimeFormat(post.language, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${post.datePublished}T00:00:00Z`))}</time><Link href={post.path} aria-label={`${ui.read}: ${post.title}`}>{ui.read} →</Link></p>
  </article>;
}

export function OzilBlogPreview() {
  return <section className="ozil-blog-preview" id="blog" aria-labelledby="ozil-blog-title">
    <div className="section-container">
      <div className="ozil-blog-preview-heading"><div><p className="eyebrow">OZIL GOAL BLOG</p><h2 id="ozil-blog-title">The trend. Your photo. Your next video.</h2></div><Link href={OZIL_BLOG_PATH}>Explore all {ozilBlogPosts.length} articles <span aria-hidden="true">↗</span></Link></div>
      <p className="ozil-blog-preview-intro">Understand the meme, find the right tool and learn how to make your own. Guides in English, Português and Español.</p>
      <div className="ozil-blog-preview-grid">{ozilBlogLanguages.map(group => {
        const post = ozilBlogPosts.find(item => item.language === group.language && item.topic === "trend")!;
        return <div key={group.language} lang={group.language}><p className="ozil-blog-language-label">{group.label}</p><ArticleCard post={post} /></div>;
      })}</div>
    </div>
  </section>;
}

export function OzilBlogIndex() {
  const url = `${SITE_URL}${OZIL_BLOG_PATH}`;
  return <div className="geo-page blog-index ozil-blog">
    <StructuredData data={{ "@context": "https://schema.org", "@type": "Blog", "@id": `${url}#blog`, url, name: "Ozil Goal Blog", inLanguage: ["en", "pt-BR", "es"], dateModified: OZIL_BLOG_UPDATED, publisher: { "@type": "Organization", name: "MigosAI", url: SITE_URL }, blogPost: ozilBlogPosts.map(post => ({ "@type": "BlogPosting", headline: post.title, url: `${SITE_URL}${post.path}`, inLanguage: post.language, datePublished: post.datePublished })) }} />
    <header className="geo-header section-container ozil-blog-hero">
      <div>
        <nav className="geo-breadcrumb" aria-label="Breadcrumb"><Link href="/ozil-goal-generator">Ozil Goal</Link><span aria-hidden="true">/</span><span aria-current="page">Blog</span></nav>
        <p className="eyebrow">OZIL GOAL · THE FIELD GUIDE</p>
        <h1>From “what is this?”<br />to your own goal video.</h1>
        <p className="geo-intro">The Ozil Goal trend, explained. Practical guides to photos, prompts, apps and credits — in English, Português and Español.</p>
        <nav className="ozil-blog-language-nav" aria-label="Article languages">{ozilBlogLanguages.map(group => <a href={`#${group.language}`} lang={group.language} key={group.language}>{group.label}<span>{ozilBlogPosts.filter(post => post.language === group.language).length}</span></a>)}</nav>
      </div>
      <figure className="ozil-blog-cover"><img src="/ozil-goal/samples/ai-shot1.jpg" width="496" height="864" alt="AI reference scene: a woman in everyday clothes on a football pitch as a goalkeeper dives past" /><figcaption>AI reference sample · Ozil Goal</figcaption></figure>
    </header>
    {ozilBlogLanguages.map(group => <section key={group.language} id={group.language} lang={group.language} className="geo-section section-container">
      <h2>{group.label}</h2><p className="ozil-blog-group-intro">{group.description}</p>
      <div className="blog-grid">{ozilBlogPosts.filter(post => post.language === group.language).map(post => <ArticleCard key={post.slug} post={post} />)}</div>
    </section>)}
  </div>;
}

export function OzilBlogArticle({ post }: { post: OzilBlogPost }) {
  const ui = ozilBlogUi[post.language];
  const url = `${SITE_URL}${post.path}`;
  const related = ozilBlogPosts.filter(candidate => candidate.language === post.language && candidate.slug !== post.slug);
  const otherLanguages = ozilBlogPosts.filter(candidate => candidate.topic === post.topic && candidate.language !== post.language);
  const published = new Intl.DateTimeFormat(post.language, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${post.datePublished}T00:00:00Z`));
  const schema = {
    "@context": "https://schema.org", "@graph": [
      { "@type": "BlogPosting", "@id": `${url}#article`, headline: post.title, description: ozilBlogText(post.description), url, mainEntityOfPage: url, datePublished: post.datePublished, dateModified: post.dateModified, inLanguage: post.language, image: `${SITE_URL}/ozil-goal/samples/ai-shot1.jpg`, author: { "@type": "Organization", name: "MigosAI editorial team", url: SITE_URL }, publisher: { "@type": "Organization", name: "MigosAI", url: SITE_URL }, isPartOf: { "@type": "Blog", "@id": `${SITE_URL}${OZIL_BLOG_PATH}#blog` }, citation: post.sources.map(source => new URL(source.url, SITE_URL).href) },
      { "@type": "FAQPage", "@id": `${url}#faq`, inLanguage: post.language, mainEntity: post.faqs.map(faq => ({ "@type": "Question", name: plainText(faq.question), acceptedAnswer: { "@type": "Answer", text: plainText(ozilBlogText(faq.answer)) } })) },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Ozil Goal", item: `${SITE_URL}/ozil-goal-generator` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}${OZIL_BLOG_PATH}` },
        { "@type": "ListItem", position: 3, name: post.label, item: url },
      ] },
    ],
  };
  return <article className="geo-page blog-article ozil-blog" lang={post.language}>
    <StructuredData data={schema} />
    <header className="geo-header section-container">
      <nav className="geo-breadcrumb" aria-label="Breadcrumb"><Link href="/ozil-goal-generator">Ozil Goal</Link><span aria-hidden="true">/</span><Link href={`${OZIL_BLOG_PATH}#${post.language}`}>Blog</Link><span aria-hidden="true">/</span><span aria-current="page">{post.label}</span></nav>
      <p className="eyebrow">{post.eyebrow}</p><h1>{post.title}</h1>
      <p className="geo-intro">{renderInline(ozilBlogText(post.intro))}</p>
      <p className="geo-note blog-byline">{ui.byline} · {ui.published} <time dateTime={post.datePublished}>{published}</time></p>
      {otherLanguages.length > 0 && <nav className="ozil-blog-translations" aria-label={ui.language}>{ui.language}: {otherLanguages.map(candidate => <Link key={candidate.slug} href={candidate.path} hrefLang={candidate.language} lang={candidate.language}>{ozilBlogLanguages.find(group => group.language === candidate.language)!.label}</Link>)}</nav>}
    </header>
    <nav className="section-container ozil-blog-contents" aria-label={ui.contents}><strong>{ui.contents}</strong><ol>{post.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}<li><a href="#faq">{ui.faq}</a></li></ol></nav>
    {post.sections.map(section => <section key={section.id} id={section.id} className="geo-section section-container"><h2>{section.title}</h2><div className="geo-prose blog-prose"><BlogBlocks blocks={section.blocks} t={ozilBlogText} /></div></section>)}
    <section id="faq" className="geo-section section-container blog-faq"><h2>{ui.faq}</h2><div className="faq-grid">{post.faqs.map((faq, index) => <div className="faq-item" key={faq.question}><span className="faq-number">{index + 1}</span><div><h3>{faq.question}</h3><p>{renderInline(ozilBlogText(faq.answer))}</p></div></div>)}</div></section>
    <section id="sources" className="geo-section section-container"><h2>{ui.sources}</h2><ul className="blog-sources">{post.sources.map(source => <li key={source.url}><a href={source.url} rel="noopener">{ozilBlogText(source.label)}</a></li>)}</ul></section>
    <aside className="geo-related section-container"><h2>{ui.more}</h2><div className="geo-link-grid">{related.map(candidate => <Link key={candidate.slug} href={candidate.path}>{candidate.label} ↗</Link>)}</div><p><Link href={`${OZIL_BLOG_PATH}#${post.language}`}>{ui.all}</Link></p></aside>
    <div className="geo-cta section-container"><h2>{ui.cta}</h2><p>{ui.ctaText}</p><Link className="pill-gradient-button" href="/ozil-goal-generator#generator">{ui.button}</Link></div>
  </article>;
}
