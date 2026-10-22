import { createElement, Fragment, type CSSProperties, type ReactNode } from 'react';
import type { Metadata } from 'next';
import pages from '@/content/flyingcar-pages.json';
import { SITE_URL } from '@/content/public-pages';
import { getLocale } from '@/lib/i18n/server';
import { localizeHref, type Locale } from '@/lib/i18n/routing';
import { getFlyingCarCost } from '@/lib/flyingcar';
import { FlyingCarGenerator } from './generator';
import { FlyingCarCredits } from './credits';
import './reference.css';
import './page.css';

export const FLYING_CAR_PATH = '/flying-car-ai-video-generator';
export type FlyingCarPageSlug = 'home' | 'how-to-make-a-tesla-roadster-flying-car-video' | 'tesla-flying-car-ai-video-trend';
type SourceNode = string | { slot: string } | { tag: string; attrs: Record<string, string | null>; children: SourceNode[] };
type SourceElement = Extract<SourceNode, { tag: string }>;
const attributeNames: Record<string, string> = {
  class: 'className', tabindex: 'tabIndex', viewbox: 'viewBox', 'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', 'fill-rule': 'fillRule',
  'clip-rule': 'clipRule', 'clip-path': 'clipPath', autoplay: 'autoPlay', playsinline: 'playsInline',
  colspan: 'colSpan', rowspan: 'rowSpan', for: 'htmlFor', srcset: 'srcSet', crossorigin: 'crossOrigin',
};
const booleanAttributes = new Set(['autoplay', 'playsinline', 'muted', 'loop', 'controls', 'inert', 'open', 'disabled']);
const excludedTags = new Set(['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta']);
function copy(value: string): string {
  return value.replaceAll('{{FLYING_CAR_MIN_COST}}', String(getFlyingCarCost(5)))
    .replaceAll('{{FLYING_CAR_DEFAULT_COST}}', String(getFlyingCarCost(10)))
    .replaceAll('{{FLYING_CAR_MAX_COST}}', String(getFlyingCarCost(30)));
}
function elements(node: SourceNode, tag: string): SourceElement[] {
  if (typeof node === 'string' || !('tag' in node)) return [];
  return [...(node.tag === tag ? [node] : []), ...node.children.flatMap(child => elements(child, tag))];
}
function readableText(node: SourceNode): string {
  if (typeof node === 'string') return copy(node);
  if (!('tag' in node) || node.attrs['aria-hidden'] === 'true') return '';
  return node.children.map(readableText).join('').replace(/\s+/g, ' ').trim();
}
function renderNode(node: SourceNode, locale: Locale, key: string): ReactNode {
  if (typeof node === 'string') return copy(node);
  if ('slot' in node) {
    const slots: Record<string, ReactNode> = { generator: <FlyingCarGenerator />, credits: <FlyingCarCredits /> };
    return <Fragment key={key}>{slots[node.slot]}</Fragment>;
  }
  if (excludedTags.has(node.tag)) return null;
  const props: Record<string, unknown> = { key };
  for (const [name, value] of Object.entries(node.attrs)) {
    if (/^on/i.test(name)) continue;
    if (name === 'style') {
      props.style = Object.fromEntries((value ?? '').split(';').filter(Boolean).map(part => {
        const colon = part.indexOf(':');
        const property = part.slice(0, colon).trim();
        return [property.startsWith('--') ? property : property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), part.slice(colon + 1).trim()];
      })) as CSSProperties;
    } else if (name === 'href') props.href = localizeHref(value ?? '', locale);
    else if (booleanAttributes.has(name)) props[attributeNames[name] ?? name] = value !== 'false';
    else props[attributeNames[name] ?? name] = value === null ? '' : copy(value);
  }
  const children = node.children.map((child, index) => renderNode(child, locale, `${key}.${index}`));
  return children.length ? createElement(node.tag, props, children) : createElement(node.tag, props);
}
function schema(slug: FlyingCarPageSlug, content: SourceNode, locale: Locale) {
  const path = FLYING_CAR_PATH + (slug === 'home' ? '' : `/${slug}`);
  const url = new URL(localizeHref(path, locale), SITE_URL).href;
  const publisher = { '@type': 'Organization', name: 'LobbyDuo', url: SITE_URL };
  const faqs = elements(content, 'details');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...(faqs.length ? [{
        '@type': 'FAQPage', '@id': `${url}#faq`, url, inLanguage: 'en', publisher,
        mainEntity: faqs.map(detail => ({ '@type': 'Question', name: elements(detail, 'summary').map(readableText).join(' '),
          acceptedAnswer: { '@type': 'Answer', text: detail.children.filter(child => typeof child === 'string' || !('tag' in child) || child.tag !== 'summary').map(readableText).join(' ').trim() } })),
      }] : []),
      ...(slug === 'home' ? [] : [{
        '@type': 'Article', '@id': `${url}#article`, headline: pages[slug].title, description: copy(pages[slug].description),
        image: `${SITE_URL}/flyingcar/real/overpass-launch.jpg`, inLanguage: 'en', publisher,
        author: { '@type': 'Organization', name: 'Flying Car AI' },
        datePublished: '2026-10-17', dateModified: '2026-10-17', mainEntityOfPage: url,
      }]),
    ],
  };
}
export async function FlyingCarPage({ slug = 'home' }: { slug?: FlyingCarPageSlug }) {
  const locale = await getLocale();
  const content = pages[slug].content as SourceNode;
  const disclosure = elements(pages.footer as SourceNode, 'div').find(node => node.attrs.class?.split(/\s+/).includes('footer-disclaimer'));
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema(slug, content, locale)).replace(/</g, '\\u003c') }} />
    <div className="flyingcar-page">
      {renderNode(content, locale, slug)}
      {disclosure && <aside className="section-width" aria-label="About this tool">{renderNode(disclosure, locale, 'disclosure')}</aside>}
    </div>
  </>;
}
export function flyingCarMetadata(slug: FlyingCarPageSlug): Metadata {
  const page = pages[slug];
  return {
    title: page.title, description: copy(page.description),
    openGraph: { title: page.title, description: copy(page.description), images: ['/flyingcar/og-flying-car-v2.png'] },
    twitter: { card: 'summary_large_image', title: page.title, description: copy(page.description), images: ['/flyingcar/og-flying-car-v2.png'] },
  };
}
