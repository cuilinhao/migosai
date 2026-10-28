import type { ReactNode } from "react";
import Link from "@/components/i18n/localized-link";
import { getLocale } from "@/lib/i18n/server";
import { blogMessages } from "@/lib/i18n/messages/blog";
import { createTranslator, type Values } from "@/lib/i18n/translator";
import { localeTags, type Locale } from "@/lib/i18n/routing";
import { getVideoCost } from "@/lib/video-options";
import type { BlogBlock } from "@/content/blog";
import "@/app/blog.css";

/** Values interpolated into blog copy, so prices follow the live quote rules. */
export const blogValues: Values = { shortCredits: getVideoCost(5, "480p", "wan-3.0", 0) };

export type BlogTranslate = (source: string, values?: Values) => string;

export async function getBlogTranslator(): Promise<{ locale: Locale; t: BlogTranslate }> {
  const locale = await getLocale();
  const translate = createTranslator(locale === "en" ? {} : blogMessages[locale]);
  return { locale, t: (source, values) => translate(source, { ...blogValues, ...values }) };
}

export function formatBlogDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(localeTags[locale], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Render **bold** and [label](href) markup; internal links keep the current language. */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    if (match[1] !== undefined) nodes.push(<strong key={key++}>{renderInline(match[1])}</strong>);
    else {
      const href = match[3];
      nodes.push(href.startsWith("/")
        ? <Link key={key++} href={href}>{match[2]}</Link>
        : <a key={key++} href={href} rel="noopener">{match[2]}</a>);
    }
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Plain text for structured data and metadata. */
export function plainText(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1");
}

export function BlogBlocks({ blocks, t }: { blocks: BlogBlock[]; t: BlogTranslate }) {
  return <>{blocks.map((block, index) => {
    switch (block.type) {
      case "p": return <p key={index}>{renderInline(t(block.text))}</p>;
      case "note": return <p key={index} className="geo-note">{renderInline(t(block.text))}</p>;
      case "h3": return <h3 key={index}>{t(block.text)}</h3>;
      case "code": return <pre key={index} className="blog-code" role="region" aria-label={t(block.label)} tabIndex={0}><code>{block.text}</code></pre>;
      case "ul": return <ul key={index} className="blog-list">{block.items.map((item) => <li key={item}>{renderInline(t(item))}</li>)}</ul>;
      case "ol": return <ol key={index} className="geo-steps">{block.items.map((item) => <li key={item}>{renderInline(t(item))}</li>)}</ol>;
      case "table": {
        const caption = t(block.caption);
        return <div key={index} className="geo-table-scroll" role="region" aria-label={caption} tabIndex={0}>
          <table className={`geo-table${block.headings.length === 2 ? " blog-table-compact" : ""}`}>
            <caption>{caption}</caption>
            <thead><tr>{block.headings.map((heading) => <th key={heading} scope="col">{t(heading)}</th>)}</tr></thead>
            <tbody>{block.rows.map((row) => <tr key={row[0]}>{row.map((cell, cellIndex) => cellIndex === 0
              ? <th key={cellIndex} scope="row">{renderInline(t(cell))}</th>
              : <td key={cellIndex}>{renderInline(t(cell))}</td>)}</tr>)}</tbody>
          </table>
        </div>;
      }
    }
  })}</>;
}

export function BlogBreadcrumb({ t, current }: { t: BlogTranslate; current?: string }) {
  return <nav aria-label={t("Breadcrumb")} className="geo-breadcrumb">
    <Link href="/">{t("Home")}</Link><span aria-hidden="true">/</span>
    {current ? <><Link href="/blog">{t("Blog")}</Link><span aria-hidden="true">/</span><span aria-current="page">{current}</span></> : <span aria-current="page">{t("Blog")}</span>}
  </nav>;
}
