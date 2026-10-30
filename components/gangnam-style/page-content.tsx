import { createElement, Fragment, Suspense, type CSSProperties, type ReactNode } from 'react';
import source from '@/content/gangnam-style-page.json';
import { SITE_URL } from '@/content/public-pages';
import { getLocale } from '@/lib/i18n/server';
import { localizeHref, type Locale } from '@/lib/i18n/routing';
import { PricingEntry } from '@/components/black-friday/pricing-entry';
import { PricingCards } from '@/components/pricing-cards';
import { GangnamStyleGenerator } from './generator';
import { GangnamHeroMedia, GangnamExamples } from './media';
import { GangnamBlogPreview } from './blog';
import { GangnamFacts } from './facts';
import { GangnamEntities, GangnamPageSchema } from './structured-data';
import { GANGNAM_BLOG_PATH } from '@/content/gangnam-style-blog/shared';
import { getGangnamTranslator } from '@/lib/i18n/gangnam-style';
import './reference.css';
import './page.css';

export const GANGNAM_STYLE_PATH = '/gangnam-style-ai-video-generator';
type Node = string | { slot: string } | { tag: string; attrs: Record<string, string | null>; children: Node[] };
const attrNames: Record<string, string> = { class: 'className', tabindex: 'tabIndex', viewbox: 'viewBox', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', 'fill-rule': 'fillRule', 'clip-rule': 'clipRule', for: 'htmlFor', autoplay: 'autoPlay', playsinline: 'playsInline', crossorigin: 'crossOrigin' };
const boolAttrs = new Set(['autoplay','playsinline','muted','loop','controls','open','disabled']);
const excluded = new Set(['script','style','iframe','object','embed','link','meta','dialog']);
function elements(node: Node, tag: string): Extract<Node, { tag: string }>[] {
  if (typeof node === 'string' || !('tag' in node)) return [];
  return [...(node.tag === tag ? [node] : []), ...node.children.flatMap(child => elements(child, tag))];
}
function render(node: Node, locale: Locale, offerTime: number, key: string): ReactNode {
  const t = getGangnamTranslator(locale);
  if (typeof node === 'string') return t(node);
  if ('slot' in node) {
    const slots: Record<string, ReactNode> = {
      'hero-media': <GangnamHeroMedia/>, examples: <GangnamExamples/>, generator: <><GangnamFacts locale={locale}/><GangnamStyleGenerator/></>,
      pricing: <section id="pricing" className="gns-local-pricing"><header><p className="gns-eyebrow">{t("SIMPLE, SHARED MIGOSAI CREDITS")}</p><h2>{t("Your next trio,")}<br/><em>{t("your existing credits.")}</em></h2><p>{t("Use your MigosAI balance for every template. Choose a credit pack or subscription below. The generator shows the cost before you create.")}</p></header>
        <Suspense fallback={<PricingCards offerTime={offerTime}/>}><PricingEntry offerTime={offerTime}/></Suspense>
        <div className="gns-pricing-notes"><article><h3>{t("Your photos stay private")}</h3><p>{t("Photos are submitted to our video provider to generate your clip. Account records are private to you.")}</p></article><article><h3>{t("Download and keep it")}</h3><p>{t("Save the finished MP4 promptly. Provider download links can expire.")}</p></article><article><h3>{t("AI has limits")}</h3><p>{t("Likeness, hands and timing can vary. New videos include the original soundtrack from the Gangnam Style trio reference clip.")}</p></article></div>
        <p className="gns-pricing-links"><a href={localizeHref('/refund-policy', locale)}>{t("Read the refund policy ↗")}</a><a href={localizeHref('/privacy-policy', locale)}>{t("Privacy")}</a><a href={localizeHref('/terms-of-service', locale)}>{t("Terms")}</a><a href={localizeHref('/contact', locale)}>{t("Contact support")}</a></p>
      </section>,
    };
    return <Fragment key={key}>{slots[node.slot]}</Fragment>;
  }
  if (excluded.has(node.tag)) return null;
  const props: Record<string, unknown> = { key };
  for (const [name,value] of Object.entries(node.attrs)) {
    if (/^on/i.test(name)) continue;
    if (name === 'style') {
      props.style = Object.fromEntries((value ?? '').split(';').filter(Boolean).map(part => { const i=part.indexOf(':'); const property=part.slice(0,i).trim(); return [property.startsWith('--') ? property : property.replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase()),part.slice(i+1).trim()]; })) as CSSProperties;
    } else if (name === 'href') props.href=localizeHref(value ?? '', locale);
    else if (['alt', 'title', 'aria-label', 'placeholder'].includes(name)) props[attrNames[name] ?? name]=t(value ?? '');
    else if (boolAttrs.has(name)) props[attrNames[name] ?? name]=value !== 'false';
    else props[attrNames[name] ?? name]=value ?? '';
  }
  const children=node.children.map((child,index)=>render(child,locale,offerTime,`${key}.${index}`));
  return children.length ? createElement(node.tag,props,children) : createElement(node.tag,props);
}
export async function GangnamStylePage() {
  const locale=await getLocale();
  const t = getGangnamTranslator(locale);
  const content=source.content as Node;
  const url=`${SITE_URL}${localizeHref(GANGNAM_STYLE_PATH, locale)}`;
  const translatedText = (node: Node): string => typeof node === 'string' ? t(node) : 'children' in node ? node.children.map(translatedText).join('') : '';
  const faq={ '@context':'https://schema.org','@type':'FAQPage',url,inLanguage:locale,mainEntity:elements(content,'details').map(detail=>({ '@type':'Question',name:elements(detail,'summary').map(translatedText).join(' '),acceptedAnswer:{ '@type':'Answer',text:detail.children.filter(n=>typeof n==='string'||!('tag' in n)||n.tag!=='summary').map(translatedText).join('').trim() } })) };
  return <>
    <GangnamEntities locale={locale}/>
    <GangnamPageSchema locale={locale}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faq).replace(/</g,'\\u003c')}}/>
    <div className="gangnam-page" lang={locale}>
      <nav className="gns-page-nav" aria-label={t("Gangnam Style navigation")}><a href="#studio" className="gns-wordmark">{t("Gangnam Style")}<span> ↗</span></a><div><a href="#studio">{t("Generator")}</a><a href="#how">{t("How to")}</a><a href="#faq">{t("FAQ")}</a><a href="#pricing">{t("Pricing")}</a><a href={localizeHref(GANGNAM_BLOG_PATH, locale)}>{t("Blog")}</a></div></nav>
      {render(content,locale,Date.now(),'page')}
      <aside className="gns-attribution">{t("Reference examples and page content: ")}<a href="https://gangnamstyle.io/" target="_blank" rel="noreferrer">{t("Groove / gangnamstyle.io")}</a>{t(". Sample videos are third-party references, not MigosAI-generated results. MigosAI is an independent AI creative service.")}</aside>
    </div>
    <GangnamBlogPreview locale={locale}/>
  </>;
}
