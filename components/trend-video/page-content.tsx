'use client';

import { ArrowRight, Check, ChevronDown, Clapperboard, Download, ImagePlus, LockKeyhole, Mountain, Sparkles, Undo2 } from 'lucide-react';
import Link from '@/components/i18n/localized-link';
import { useLocale } from '@/components/i18n/locale-provider';
import { getTrendVideoCopy, trendVideoReferences } from '@/content/trend-video';
import { TREND_VIDEO_COST, type TrendEffectId } from '@/lib/trend-video';
import { TrendVideoGenerator } from './generator';
import { ReferencePlayer } from './reference-player';
import styles from './trend-video.module.css';

const stepIcons = [ImagePlus, Clapperboard, Download];
const trustIcons = [LockKeyhole, Undo2, Download];

export function TrendVideoPage({ effectId }: { effectId: TrendEffectId }) {
  const copy = getTrendVideoCopy(effectId, useLocale());
  const references = trendVideoReferences(effectId);
  return <div className={styles.page}>
    <section className={styles.hero}><span className={styles.trendPill}><Sparkles size={13} />{copy.badge}</span><h1>{copy.heroTitle}<br /><span>{copy.heroAccent}</span></h1><p>{copy.heroDescription}</p><div className={styles.benefits}>{copy.heroBenefits.map(text => <span key={text}><Check size={14} />{text}</span>)}</div></section>
    <div className={styles.container}>
      <TrendVideoGenerator key={effectId} effectId={effectId} />
      <div className={styles.trust}>{copy.trust.map((text,index) => { const Icon = trustIcons[index]; return <span key={text}><Icon size={15} />{text}</span>; })}</div>
      <section className={styles.section} id="trend-video-about"><div className={styles.sectionHeading}><div><span className={styles.kicker}>{copy.principleKicker}</span><h2>{copy.introTitle}</h2></div><p>{copy.intro}</p></div><div className={styles.sequence}>{copy.sequence.map((item,index) => <article key={item.title}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div></section>
      <section className={styles.section} id="trend-video-examples"><div className={styles.sectionHeading}><div><span className={styles.kicker}>{copy.examplesKicker}</span><h2>{copy.examplesTitle}</h2></div><p>{copy.examplesDescription}</p></div><div className={`${styles.exampleGrid} ${references.length === 5 ? styles.fiveExamples : ''}`}>{references.map((reference,index) => <figure className={styles.exampleCard} key={reference.video}><ReferencePlayer reference={reference} title={copy.examples[index].title} copy={copy} /><figcaption><h3>{copy.examples[index].title}</h3><p>{copy.examples[index].description}</p></figcaption></figure>)}</div><p className={styles.attribution}>{copy.previewDisclosure}</p></section>
      <section className={`${styles.section} ${styles.howSection}`} id="trend-video-how-it-works"><div className={styles.sectionHeading}><div><span className={styles.kicker}>{copy.howKicker}</span><h2>{copy.howTitle}</h2></div></div><div className={styles.steps}>{copy.steps.map((step,index) => { const Icon = stepIcons[index]; return <article key={step.title}><span className={styles.stepArt}><Icon size={26} /><b>0{index + 1}</b></span><h3>{step.title}</h3><p>{step.description}</p></article>; })}</div><aside className={styles.photoTips}><span className={styles.tipIcon}><ImagePlus size={25} /></span><div><h3>{copy.tipsTitle}</h3><ul>{copy.tips.map(tip => <li key={tip}>{tip}</li>)}</ul></div></aside></section>
      <section className={styles.section}><div className={styles.sectionHeading}><div><span className={styles.kicker}>{copy.usesKicker}</span><h2>{copy.usesTitle}</h2></div></div><div className={styles.uses}>{copy.uses.map((use,index) => <article key={use.title}><span>{index === 0 ? <Sparkles size={20} /> : index === 1 ? <Clapperboard size={20} /> : <Mountain size={20} />}</span><h3>{use.title}</h3><p>{use.description}</p></article>)}</div></section>
      <section className={`${styles.section} ${styles.faq}`} id="trend-video-faq"><div><span className={styles.kicker}>{copy.faqTitle}</span><h2>{copy.faqDescription}</h2><p>{copy.priceNote.replace('{credits}',String(TREND_VIDEO_COST))} <Link href="/pricing">{copy.buyCredits}<ArrowRight size={13} /></Link></p></div><div>{[...copy.faqs,...copy.commonFaqs].map(faq => <details key={faq.question}><summary>{faq.question}<ChevronDown size={18} /></summary><p>{faq.answer.replaceAll('{credits}',String(TREND_VIDEO_COST))}</p></details>)}</div></section>
      <section className={styles.lastCall}><span className={styles.ctaIcon}><Sparkles size={27} /></span><h2>{copy.ctaTitle}</h2><p>{copy.ctaDescription}</p><a className={styles.button} href="#trend-video-generator">{copy.ctaButton}<ArrowRight size={17} /></a><small>{copy.priceNote.replace('{credits}',String(TREND_VIDEO_COST))}</small></section>
    </div>
  </div>;
}
