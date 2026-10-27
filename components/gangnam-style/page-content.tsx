import { createElement, Fragment, Suspense, type CSSProperties, type ReactNode } from 'react';
import source from '@/content/gangnam-style-page.json';
import { SITE_URL } from '@/content/public-pages';
import { getLocale } from '@/lib/i18n/server';
import { localizeHref, type Locale } from '@/lib/i18n/routing';
import { PricingEntry } from '@/components/black-friday/pricing-entry';
import { PricingCards } from '@/components/pricing-cards';
import { GangnamStyleGenerator } from './generator';
import { GangnamHeroMedia, GangnamExamples } from './media';
import './reference.css';
import './page.css';

export const GANGNAM_STYLE_PATH = '/gangnam-style-ai-video-generator';
type Node = string | { slot: string } | { tag: string; attrs: Record<string, string | null>; children: Node[] };
const attrNames: Record<string, string> = { class: 'className', tabindex: 'tabIndex', viewbox: 'viewBox', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', 'fill-rule': 'fillRule', 'clip-rule': 'clipRule', for: 'htmlFor', autoplay: 'autoPlay', playsinline: 'playsInline', crossorigin: 'crossOrigin' };
const boolAttrs = new Set(['autoplay','playsinline','muted','loop','controls','open','disabled']);
const excluded = new Set(['script','style','iframe','object','embed','link','meta','dialog']);
function text(node: Node): string { return typeof node === 'string' ? node : 'children' in node ? node.children.map(text).join('') : ''; }
function elements(node: Node, tag: string): Extract<Node, { tag: string }>[] {
  if (typeof node === 'string' || !('tag' in node)) return [];
  return [...(node.tag === tag ? [node] : []), ...node.children.flatMap(child => elements(child, tag))];
}
function render(node: Node, locale: Locale, offerTime: number, key: string): ReactNode {
  if (typeof node === 'string') return node;
  if ('slot' in node) {
    const slots: Record<string, ReactNode> = {
      'hero-media': <GangnamHeroMedia/>, examples: <GangnamExamples/>, generator: <GangnamStyleGenerator/>,
      pricing: <section id="pricing" className="gns-local-pricing"><header><p className="gns-eyebrow">SIMPLE, SHARED MIGOSAI CREDITS</p><h2>Your next trio,<br/><em>your existing credits.</em></h2><p>Use your MigosAI balance for every template. Choose a credit pack or subscription below. The generator shows the cost before you create.</p></header>
        <Suspense fallback={<PricingCards offerTime={offerTime}/>}><PricingEntry offerTime={offerTime}/></Suspense>
        <div className="gns-pricing-notes"><article><h3>Your photos stay private</h3><p>Photos are submitted to our video provider to generate your clip. Account records are private to you.</p></article><article><h3>Download and keep it</h3><p>Save the finished MP4 promptly. Provider download links can expire.</p></article><article><h3>AI has limits</h3><p>Likeness, hands and timing can vary. Videos are silent; add only music you have permission to use.</p></article></div>
        <p className="gns-pricing-links"><a href={localizeHref('/refund-policy', locale)}>Read the refund policy ↗</a><a href={localizeHref('/privacy-policy', locale)}>Privacy</a><a href={localizeHref('/terms-of-service', locale)}>Terms</a><a href={localizeHref('/contact', locale)}>Contact support</a></p>
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
    else if (boolAttrs.has(name)) props[attrNames[name] ?? name]=value !== 'false';
    else props[attrNames[name] ?? name]=value ?? '';
  }
  const children=node.children.map((child,index)=>render(child,locale,offerTime,`${key}.${index}`));
  return children.length ? createElement(node.tag,props,children) : createElement(node.tag,props);
}
export async function GangnamStylePage() {
  const locale=await getLocale();
  const content=source.content as Node;
  const url=`${SITE_URL}${localizeHref(GANGNAM_STYLE_PATH, locale)}`;
  const faq={ '@context':'https://schema.org','@type':'FAQPage',url,inLanguage:'en',mainEntity:elements(content,'details').map(detail=>({ '@type':'Question',name:elements(detail,'summary').map(text).join(' '),acceptedAnswer:{ '@type':'Answer',text:detail.children.filter(n=>typeof n==='string'||!('tag' in n)||n.tag!=='summary').map(text).join('').trim() } })) };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faq).replace(/</g,'\\u003c')}}/>
    <div className="gangnam-page" lang="en">
      <nav className="gns-page-nav" aria-label="Gangnam Style navigation"><a href="#studio" className="gns-wordmark">Gangnam Style<span> ↗</span></a><div><a href="#studio">Generator</a><a href="#how">How to</a><a href="#faq">FAQ</a><a href="#pricing">Pricing</a></div></nav>
      {render(content,locale,Date.now(),'page')}
      <aside className="gns-attribution">Reference examples and page content: <a href="https://gangnamstyle.io/" target="_blank" rel="noreferrer">Groove / gangnamstyle.io</a>. Sample videos are third-party references, not MigosAI-generated results. MigosAI is an independent AI creative service.</aside>
    </div>
  </>;
}
