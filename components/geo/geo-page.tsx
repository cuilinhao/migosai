import { getLocale, getTranslations } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "@/components/i18n/localized-link";
import { HOTEL_LOBBY_PATH, SITE_URL, hotelLobbyPages } from "@/content/public-pages";

export function geoMetadata(title: string, description: string, path: string): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title: { absolute: title }, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "Migos AI", locale: "en_US" },
    twitter: { card: "summary", title, description },
  };
}

export async function JsonLd({ data }: { data: unknown }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations()]);
  const humanFields = new Set(["name", "headline", "description", "text"]);
  const urlFields = new Set(["url", "@id", "item", "mainEntityOfPage"]);
  function localize(value: unknown, key = ""): unknown {
    if (Array.isArray(value)) return value.map((item) => localize(item, key));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([field, item]) => [field, localize(item, field)]));
    if (typeof value !== "string") return value;
    if (key === "inLanguage") return locale;
    if (humanFields.has(key)) return t(value);
    if (urlFields.has(key) && value.startsWith(SITE_URL) && locale !== "en") {
      const url = new URL(value);
      url.pathname = `/${locale}${url.pathname === "/" ? "" : url.pathname}`;
      return url.toString();
    }
    return value;
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localize(data)).replace(/</g, "\\u003c") }} />;
}

export async function GeoHeader({ title, intro, label = "HOTEL LOBBY · 2026 GUIDE", children }: { title: string; intro: string; label?: string; children?: ReactNode }) {
  const t = await getTranslations();
  return localizePageContent(<header className="geo-header section-container">
    <nav aria-label="Breadcrumb" className="geo-breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href={HOTEL_LOBBY_PATH}>Hotel Lobby AI</Link></nav>
    <p className="eyebrow">{label}</p><h1>{title}</h1><p className="geo-intro">{intro}</p>{children}
  </header>, t);
}

export async function GeoSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const t = await getTranslations();
  return localizePageContent(<section className="geo-section section-container" id={id}><h2>{title}</h2>{children}</section>, t);
}

export async function GeoTable({ caption, headings, rows }: { caption: string; headings: string[]; rows: ReactNode[][] }) {
  const t = await getTranslations();
  return localizePageContent(<div className="geo-table-scroll" role="region" aria-label={caption} tabIndex={0}>
    <table className="geo-table"><caption>{caption}</caption><thead><tr>{headings.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => cellIndex === 0 ? <th key={cellIndex} scope="row">{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>, t);
}

export async function GeoRelatedLinks({ current }: { current: string }) {
  const t = await getTranslations();
  return localizePageContent(<aside className="geo-related section-container" aria-label="Related Hotel Lobby guides"><h2>Explore Hotel Lobby AI</h2>
    <div className="geo-link-grid">{hotelLobbyPages.filter((page) => page.path !== current).map((page) => <Link key={page.path} href={page.path}>{page.label}<span aria-hidden="true"> ↗</span></Link>)}</div>
    <p><Link href="/showcases">Browse reference videos</Link> · <Link href="/pricing">View pricing</Link> · <Link href="/">Back to home</Link></p>
  </aside>, t);
}

export async function GeoCta({ local = false }: { local?: boolean }) {
  const t = await getTranslations();
  return localizePageContent(<div className="geo-cta section-container"><h2>Create your Hotel Lobby AI video</h2><p>Two photos. A built-in duo template. No prompt to write.</p><Link className="pill-gradient-button" href={local ? "#generator" : `${HOTEL_LOBBY_PATH}#generator`}>Open the Hotel Lobby AI Video Generator</Link><p className="geo-note">Sign-in and credits required. Check the cost before generating.</p></div>, t);
}
