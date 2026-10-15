import { createElement, Fragment, type ReactNode, type CSSProperties } from 'react';
import pages from '@/content/ozil-goal-pages.json';
import { getLocale } from '@/lib/i18n/server';
import { localizeHref, type Locale } from '@/lib/i18n/routing';
import { OZIL_GOAL_COST } from '@/lib/ozil-goal';
import { OzilGoalGenerator } from './generator';
import { PromptBuilder } from './prompt-builder';
import { TemplateCheck, PhotoCheck, CaptionBoard, BeatTimeline } from './guide-tools';
import { SampleVideo, GuideSampleVideo } from './media';
import { OzilShell } from './shell';
import { OzilCredits } from './credits';
import { RouteChooser } from './route-chooser';
import './reference.css';
import './ozil.css';
export type OzilPageSlug = Exclude<keyof typeof pages, 'footer'>;
type SourceNode = string | { slot: string } | { tag: string; attrs: Record<string, string | null>; children: SourceNode[] };
const attributeNames: Record<string, string> = { class: 'className', tabindex: 'tabIndex', viewbox: 'viewBox', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', autoplay: 'autoPlay', playsinline: 'playsInline', colspan: 'colSpan', rowspan: 'rowSpan', for: 'htmlFor' };
const booleanAttributes = new Set(['autoplay', 'playsinline', 'muted', 'loop', 'controls', 'inert']);
function text(value: string) { return value.replaceAll('{{OZIL_GOAL_COST}}', String(OZIL_GOAL_COST)); }
function renderNode(node: SourceNode, locale: Locale, key: string): ReactNode {
  if (typeof node === 'string') return text(node);
  if ('slot' in node) {
    const slots: Record<string, ReactNode> = { generator: <OzilGoalGenerator />, prompt: <PromptBuilder />, 'template-check': <TemplateCheck />, 'photo-check': <PhotoCheck />, captions: <CaptionBoard />, timeline: <BeatTimeline />, sample: <SampleVideo />, 'guide-sample-video': <GuideSampleVideo />, credits: <OzilCredits />, 'route-chooser': <RouteChooser /> };
    return <Fragment key={key}>{slots[node.slot]}</Fragment>;
  }
  const props: Record<string, unknown> = { key };
  for (const [name, value] of Object.entries(node.attrs)) {
    if (name === 'style') { props.style = Object.fromEntries((value ?? '').split(';').filter(Boolean).map(part => { const colon = part.indexOf(':'); return [part.slice(0, colon).trim().replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), part.slice(colon + 1).trim()]; })) as CSSProperties; }
    else if (name === 'href') props.href = localizeHref(value ?? '', locale);
    else if (booleanAttributes.has(name)) props[attributeNames[name] ?? name] = true;
    else props[attributeNames[name] ?? name] = value === null ? '' : text(value);
  }
  const children = node.children.map((child, index) => renderNode(child, locale, `${key}.${index}`));
  return children.length ? createElement(node.tag, props, children) : createElement(node.tag, props);
}
export async function OzilGoalPage({ slug = 'home' }: { slug?: OzilPageSlug }) {
  const locale = await getLocale();
  return <OzilShell>{renderNode(pages[slug].content as SourceNode, locale, slug)}{renderNode(pages.footer as SourceNode, locale, 'footer')}</OzilShell>;
}
export function ozilMetadata(slug: OzilPageSlug) {
  const page = pages[slug];
  return { title: page.title, description: text(page.description), openGraph: { title: page.title, description: text(page.description), images: ['/ozil-goal/samples/ai-shot1.jpg'] } };
}
