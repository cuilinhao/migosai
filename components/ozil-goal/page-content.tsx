import { createElement, Fragment, type ReactNode, type CSSProperties } from 'react';
import pages from '@/content/ozil-goal-pages.json';
import { SITE_URL } from '@/content/public-pages';
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
import { OzilBlogPreview } from './blog';
import { OzilGoalExamples } from './examples';
import './reference.css';
import './ozil.css';
export type OzilPageSlug = Exclude<keyof typeof pages, 'footer'>;
type SourceNode = string | { slot: string } | { tag: string; attrs: Record<string, string | null>; children: SourceNode[] };
type SourceElement = Extract<SourceNode, { tag: string }>;
const attributeNames: Record<string, string> = { class: 'className', tabindex: 'tabIndex', viewbox: 'viewBox', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', autoplay: 'autoPlay', playsinline: 'playsInline', colspan: 'colSpan', rowspan: 'rowSpan', for: 'htmlFor' };
const booleanAttributes = new Set(['autoplay', 'playsinline', 'muted', 'loop', 'controls', 'inert']);
function text(value: string) { return value.replaceAll('{{OZIL_GOAL_COST}}', String(OZIL_GOAL_COST)); }
function elements(node: SourceNode, tag: string): SourceElement[] {
  if (typeof node === 'string' || !('tag' in node)) return [];
  return [...(node.tag === tag ? [node] : []), ...node.children.flatMap(child => elements(child, tag))];
}
function readableText(node: SourceNode): string {
  if (typeof node === 'string') return text(node);
  if (!('tag' in node) || node.attrs['aria-hidden'] === 'true') return '';
  return node.children.map(readableText).join('').replace(/\s+/g, ' ').trim();
}
function homeSchema(content: SourceNode, locale: Locale) {
  const url = new URL(localizeHref('/ozil-goal-generator', locale), SITE_URL).href;
  const publisher = { '@type': 'Organization', name: 'LobbyDuo', url: SITE_URL };
  const instructions = elements(content, 'section').find(section =>
    elements(section, 'h2').some(heading => readableText(heading) === 'How to make the Ozil AI goal video'));
  const steps = instructions ? elements(instructions, 'ol')[0] : undefined;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage', '@id': `${url}#faq`, url, inLanguage: 'en', publisher,
        mainEntity: elements(content, 'details').map(detail => ({
          '@type': 'Question',
          name: elements(detail, 'summary').map(readableText).join(' '),
          acceptedAnswer: { '@type': 'Answer', text: elements(detail, 'p').map(readableText).join(' ') },
        })),
      },
      {
        '@type': 'HowTo', '@id': `${url}#how-to`, url, inLanguage: 'en', publisher,
        name: 'How to make the Ozil AI goal video',
        step: steps ? elements(steps, 'li').map((step, index) => ({
          '@type': 'HowToStep', position: index + 1,
          name: elements(step, 'h3').map(readableText).join(' '),
          text: elements(step, 'p').map(readableText).join(' '),
        })) : [],
      },
    ],
  };
}
function renderNode(node: SourceNode, locale: Locale, key: string): ReactNode {
  if (typeof node === 'string') return text(node);
  if ('slot' in node) {
    const slots: Record<string, ReactNode> = { generator: <OzilGoalGenerator />, prompt: <PromptBuilder />, 'template-check': <TemplateCheck />, 'photo-check': <PhotoCheck />, captions: <CaptionBoard />, timeline: <BeatTimeline />, sample: <SampleVideo />, 'guide-sample-video': <GuideSampleVideo />, credits: <OzilCredits />, 'route-chooser': <RouteChooser />, 'video-examples': <OzilGoalExamples /> };
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
  const content = pages[slug].content as SourceNode;
  const disclosure = elements(pages.footer as SourceNode, 'p').find(node => readableText(node).startsWith('An independent tool.'));
  return <>
    {slug === 'home' && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeSchema(content, locale)).replace(/</g, '\\u003c') }} />}
    <OzilShell>{renderNode(content, locale, slug)}{slug === 'home' && <OzilBlogPreview />}{disclosure && <aside className="og-container pb-8" aria-label="About this tool">{renderNode(disclosure, locale, 'disclosure')}</aside>}</OzilShell>
  </>;
}
export function ozilMetadata(slug: OzilPageSlug) {
  const page = pages[slug];
  return { title: page.title, description: text(page.description), openGraph: { title: page.title, description: text(page.description), images: ['/ozil-goal/samples/ai-shot1.jpg'] } };
}
