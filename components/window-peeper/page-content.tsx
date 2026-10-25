"use client";

import { Suspense, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Clapperboard, Download, ImagePlus, LockKeyhole, Play, Sparkles, Undo2 } from 'lucide-react';
import { useLocale } from '@/components/i18n/locale-provider';
import { PricingEntry } from '@/components/black-friday/pricing-entry';
import { PricingCards } from '@/components/pricing-cards';
import { getWindowPeeperCopy, windowPeeperSources, type WindowPeeperCopy } from '@/content/window-peeper';
import { WINDOW_PEEPER_CONFIG, WINDOW_PEEPER_COST } from '@/lib/window-peeper';
import { WindowPeeperGenerator } from './generator';
import styles from './window-peeper.module.css';

const stepIcons = [ImagePlus, Clapperboard, Download];
const trustIcons = [LockKeyhole, Undo2, Download];
const examples = [
  { poster: '/window-peeper/original-poster.jpg', video: WINDOW_PEEPER_CONFIG.referencePath, source: windowPeeperSources.original },
  { poster: '/window-peeper/burger.jpg', video: '/window-peeper/burger.mp4', source: windowPeeperSources.variations },
  { poster: '/window-peeper/cat.jpg', video: '/window-peeper/cat.mp4', source: windowPeeperSources.variations },
];

function ExampleCard({ index, copy }: { index: number; copy: WindowPeeperCopy }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const example = examples[index];
  const text = copy.examples[index];
  return <figure className={styles.exampleCard}>
    <div className={styles.exampleMedia}>
      {playing && !failed ? <video src={example.video} poster={example.poster} autoPlay controls playsInline preload="metadata" aria-label={`${copy.playExample}: ${text.title}`} onError={() => setFailed(true)} /> : <img src={example.poster} alt={text.title} loading="lazy" />}
      {!playing && <><span className={styles.exampleBadge}>{text.badge}</span><button className={styles.playButton} type="button" aria-label={`${copy.playExample}: ${text.title}`} onClick={() => setPlaying(true)}><Play size={25} fill="currentColor" /></button></>}
      {failed && <a className={styles.videoFallback} href={example.source.url} target="_blank" rel="noreferrer">{copy.exampleError}<ArrowUpRight size={15} /></a>}
    </div>
    <figcaption><h3>{text.title}</h3><p>{text.description}</p><a href={example.source.url} target="_blank" rel="noreferrer">{example.source.author}<ArrowUpRight size={13} /></a></figcaption>
  </figure>;
}

export function WindowPeeperPage({ offerTime = 0 }: { offerTime?: number }) {
  const copy = getWindowPeeperCopy(useLocale());
  return <div className={styles.page}>
    <section className={styles.hero}>
      <span className={styles.trendPill}><span className={styles.liveDot} />{copy.badge}<Sparkles size={13} /></span>
      <h1>{copy.heroTitle}<br /><span>{copy.heroAccent}</span></h1>
      <p>{copy.heroDescription}</p>
      <div className={styles.benefits}>{copy.heroBenefits.map(text => <span key={text}><Check size={14} />{text}</span>)}</div>
    </section>
    <div className={styles.container}>
      <WindowPeeperGenerator />
      <div className={styles.trust}>{copy.trust.map((text, index) => { const Icon = trustIcons[index]; return <span key={text}><Icon size={15} />{text}</span>; })}</div>
      <section className={styles.section} id="window-peeper-how-it-works">
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>{copy.howKicker}</span><h2>{copy.howTitle}</h2></div><p>{copy.howDescription}</p></div>
        <div className={styles.steps}>{copy.steps.map((step, index) => { const Icon = stepIcons[index]; return <article key={step.title}><span className={styles.stepArt}><Icon size={29} /><b>0{index + 1}</b></span><div><h3>{step.title}</h3><p>{step.description}</p></div></article>; })}</div>
      </section>
      <section className={styles.section} id="window-peeper-examples">
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>{copy.examplesKicker}</span><h2>{copy.examplesTitle}</h2></div><p>{copy.examplesDescription}</p></div>
        <div className={styles.exampleGrid}>{examples.map((example, index) => <ExampleCard key={example.poster} index={index} copy={copy} />)}</div>
        <p className={styles.attribution}>{copy.attribution}</p>
        <div className={styles.galleryHeading}><h3>{copy.galleryTitle}</h3><p>{copy.galleryDescription}</p></div>
        <div className={styles.tiktokGrid}>{windowPeeperSources.tiktok.map(source => <figure key={source.id}><a className={styles.tiktokPoster} href={source.url} target="_blank" rel="noreferrer" aria-label={`${copy.watchTikTok}: ${source.author}`}><img src={`/window-peeper/${source.id}.avif`} alt={`Window Peeper · ${source.author}`} loading="lazy" /><span className={styles.tiktokLabel}>TikTok ↗</span><span className={styles.tiktokPlay}><Play size={23} fill="currentColor" /></span></a><figcaption><a href={source.url} target="_blank" rel="noreferrer">{source.author}<ArrowUpRight size={12} /></a></figcaption></figure>)}</div>
      </section>
      <section className={`${styles.section} ${styles.pricing}`} id="window-peeper-pricing">
        <div className={styles.centeredHeading}><span className={styles.kicker}>{copy.pricingKicker}</span><h2>{copy.pricingTitle}</h2><p>{copy.pricingDescription.replace('{credits}', String(WINDOW_PEEPER_COST))}</p></div>
        <Suspense fallback={<PricingCards offerTime={offerTime} />}><PricingEntry offerTime={offerTime} /></Suspense>
      </section>
      <section className={`${styles.section} ${styles.faq}`} id="window-peeper-faq">
        <div><span className={styles.kicker}>{copy.faqKicker}</span><h2>{copy.faqTitle}</h2><p>{copy.faqDescription}</p></div>
        <div>{copy.faqs.map(faq => <details key={faq.question}><summary>{faq.question}<ChevronDown size={18} /></summary><p>{faq.answer.replace('{credits}', String(WINDOW_PEEPER_COST))}</p></details>)}</div>
      </section>
      <section className={styles.lastCall}><span className={styles.ctaIcon}><Sparkles size={27} /></span><h2>{copy.ctaTitle}</h2><p>{copy.ctaDescription}</p><a className={styles.button} href="#window-peeper-generator">{copy.ctaButton}<ArrowRight size={17} /></a></section>
    </div>
  </div>;
}
