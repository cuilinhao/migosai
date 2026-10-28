import type { Metadata } from "next";
import Link from "@/components/i18n/localized-link";
import { GeoCta, GeoRelatedLinks, JsonLd } from "@/components/geo/geo-page";
import { BlogBreadcrumb, formatBlogDate, getBlogTranslator } from "@/components/blog/blog-shared";
import { localizeMetadata } from "@/lib/i18n/server";
import { SITE_URL } from "@/content/public-pages";
import { BLOG_PATH, BLOG_UPDATED, COMPARISON_PATH, blogIndexCopy, blogPosts } from "@/content/blog";
import { CampaignBanner } from "@/components/black-friday/campaign-banner";
import { GangnamBlogPreview } from "@/components/gangnam-style/blog";

const URL = `${SITE_URL}${BLOG_PATH}`;
const COMPARISON_DATE = "2026-10-02";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getBlogTranslator();
  const title = t(blogIndexCopy.metaTitle);
  const description = t(blogIndexCopy.description);
  return localizeMetadata({
    title: { absolute: title },
    description,
    alternates: { canonical: URL },
    openGraph: { title, description, url: URL, type: "website", siteName: "LobbyDuo", locale: "en_US" },
    twitter: { card: "summary", title, description },
  });
}

export default async function BlogIndexPage() {
  const { locale, t } = await getBlogTranslator();
  const cards = [
    ...blogPosts.map((post) => ({ path: post.path, eyebrow: post.eyebrow, title: post.title, excerpt: post.excerpt, date: post.datePublished })),
    { path: COMPARISON_PATH, eyebrow: blogIndexCopy.comparisonEyebrow, title: blogIndexCopy.comparisonTitle, excerpt: blogIndexCopy.comparisonExcerpt, date: COMPARISON_DATE },
  ];
  const schema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${URL}#blog`,
    name: t(blogIndexCopy.title),
    description: t(blogIndexCopy.description),
    url: URL,
    inLanguage: "en",
    dateModified: BLOG_UPDATED,
    publisher: { "@type": "Organization", name: "LobbyDuo", url: SITE_URL },
    blogPost: cards.map((card) => ({ "@type": "BlogPosting", headline: t(card.title), url: `${SITE_URL}${card.path}`, datePublished: card.date })),
  };

  return <div className="geo-page blog-index">
    <JsonLd data={schema} />
    <header className="geo-header section-container">
      <BlogBreadcrumb t={t} />
      <p className="eyebrow">{t(blogIndexCopy.eyebrow)}</p>
      <h1>{t(blogIndexCopy.title)}</h1>
      <p className="geo-intro">{t(blogIndexCopy.intro)}</p>
    </header>

    <section className="geo-section section-container" id="articles">
      <h2>{t(blogIndexCopy.latest)}</h2>
      <div className="blog-grid" role="list" aria-label={t("Blog articles")}>
        {cards.map((card) => <article className="blog-card" role="listitem" key={card.path}>
          <p className="blog-card-meta">{t(card.eyebrow)}</p>
          <h3><Link href={card.path}>{t(card.title)}</Link></h3>
          <p>{t(card.excerpt)}</p>
          <p className="blog-card-footer"><time dateTime={card.date}>{t("Published {date}", { date: formatBlogDate(card.date, locale) })}</time><Link href={card.path} aria-hidden="true" tabIndex={-1}>{t("Read article")} →</Link></p>
        </article>)}
      </div>
    </section>

    <GangnamBlogPreview/>
    <div className="section-container"><CampaignBanner placement="blog"/></div>
    <GeoCta />
    <GeoRelatedLinks current={BLOG_PATH} />
  </div>;
}
