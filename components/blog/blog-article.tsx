import type { Metadata } from "next";
import Link from "@/components/i18n/localized-link";
import { GeoCta, GeoRelatedLinks, JsonLd } from "@/components/geo/geo-page";
import { localizeMetadata } from "@/lib/i18n/server";
import { SITE_URL } from "@/content/public-pages";
import { BLOG_PATH, COMPARISON_PATH, blogIndexCopy, blogPosts, getBlogPost } from "@/content/blog";
import { BlogBlocks, BlogBreadcrumb, formatBlogDate, getBlogTranslator, plainText, renderInline } from "./blog-shared";

const AUTHOR = { "@type": "Organization", name: "LobbyDuo editorial team", url: SITE_URL };
const PUBLISHER = { "@type": "Organization", name: "LobbyDuo", url: SITE_URL };

/** Build the metadata and page component for one blog article (used by the English and localized routes). */
export function blogArticlePage(slug: string) {
  const post = getBlogPost(slug);
  const url = `${SITE_URL}${post.path}`;

  async function generateMetadata(): Promise<Metadata> {
    const { t } = await getBlogTranslator();
    const title = t(post.metaTitle);
    const description = t(post.description);
    return localizeMetadata({
      title: { absolute: title },
      description,
      alternates: { canonical: url },
      openGraph: { title, description, url, type: "article", siteName: "LobbyDuo", locale: "en_US", publishedTime: post.datePublished, modifiedTime: post.dateModified },
      twitter: { card: "summary", title, description },
    });
  }

  async function BlogArticle() {
    const { locale, t } = await getBlogTranslator();
    const published = formatBlogDate(post.datePublished, locale);
    const byline = t("By the LobbyDuo editorial team · Published {date}", { date: published });
    const [beforeDate, afterDate = ""] = byline.split(published);
    const others = blogPosts.filter((item) => item.slug !== post.slug);
    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BlogPosting",
          "@id": `${url}#article`,
          headline: t(post.title),
          description: t(post.description),
          url,
          mainEntityOfPage: url,
          datePublished: post.datePublished,
          dateModified: post.dateModified,
          inLanguage: "en",
          author: AUTHOR,
          publisher: PUBLISHER,
          isPartOf: { "@type": "Blog", "@id": `${SITE_URL}${BLOG_PATH}#blog`, url: `${SITE_URL}${BLOG_PATH}` },
          citation: post.sources.map((source) => source.url),
        },
        {
          "@type": "FAQPage",
          "@id": `${url}#faq`,
          mainEntity: post.faqs.map((faq) => ({ "@type": "Question", name: plainText(t(faq.question)), acceptedAnswer: { "@type": "Answer", text: plainText(t(faq.answer)) } })),
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: t("Home"), item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: t("Blog"), item: `${SITE_URL}${BLOG_PATH}` },
            { "@type": "ListItem", position: 3, name: t(post.label), item: url },
          ],
        },
      ],
    };

    return <article className="geo-page blog-article">
      <JsonLd data={schema} />
      <header className="geo-header section-container">
        <BlogBreadcrumb t={t} current={t(post.label)} />
        <p className="eyebrow">{t(post.eyebrow)}</p>
        <h1>{t(post.title)}</h1>
        <p className="geo-intro">{renderInline(t(post.intro))}</p>
        <p className="geo-note blog-byline">{beforeDate}<time dateTime={post.datePublished}>{published}</time>{afterDate}</p>
      </header>

      {post.sections.map((section) => <section key={section.id} className="geo-section section-container" id={section.id}>
        <h2>{t(section.title)}</h2>
        <div className="geo-prose blog-prose"><BlogBlocks blocks={section.blocks} t={t} /></div>
      </section>)}

      <section className="geo-section section-container blog-faq" id="faq">
        <h2>{t("Frequently asked questions")}</h2>
        <div className="faq-grid">{post.faqs.map((faq, index) => <article className="faq-item" key={faq.question}>
          <span className="faq-number">{index + 1}</span>
          <div><h3>{t(faq.question)}</h3><p>{renderInline(t(faq.answer))}</p></div>
        </article>)}</div>
      </section>

      <section className="geo-section section-container" id="sources">
        <h2>{t("Sources")}</h2>
        <ul className="blog-sources">{post.sources.map((source) => <li key={source.url}><a href={source.url} rel="noopener">{t(source.label)}</a></li>)}</ul>
      </section>

      <aside className="geo-related section-container blog-more" aria-label={t("More from the LobbyDuo blog")}>
        <h2>{t("More from the LobbyDuo blog")}</h2>
        <div className="geo-link-grid">
          {others.map((item) => <Link key={item.slug} href={item.path}>{t(item.label)}<span aria-hidden="true"> ↗</span></Link>)}
          <Link href={COMPARISON_PATH}>{t(blogIndexCopy.comparisonTitle)}<span aria-hidden="true"> ↗</span></Link>
        </div>
        <p><Link href={BLOG_PATH}>{t("All articles")}</Link></p>
      </aside>

      <GeoCta />
      <GeoRelatedLinks current={post.path} />
    </article>;
  }

  return { generateMetadata, BlogArticle };
}
