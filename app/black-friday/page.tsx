import type { Metadata } from "next";
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, Clapperboard, Gem, ImageIcon, Layers3, Plus, Sparkles, Users } from "lucide-react";
import Link from "@/components/i18n/localized-link";
import { CampaignLink } from "@/components/black-friday/campaign-link";
import { blackFridayCopy as copy } from "@/content/black-friday-copy";
import { blackFridayCampaign, getBlackFridayStatus, getCreditPackOffer } from "@/content/black-friday-offer";
import { creditPacks } from "@/content/pricing";
import { ownExamples, seedanceExamples } from "@/content/own-examples";
import { getLocale, getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localeTags, localizeHref } from "@/lib/i18n/routing";
import styles from "@/components/black-friday/black-friday.module.css";

// The campaign's UTC state must be evaluated for each request, never at build time.
export const dynamic = "force-dynamic";

const PRICING_HREF = "/pricing?promo=blackfriday#credit-packs";
const SITE_URL = "https://migosai.design";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return localizeMetadata({
    title: { absolute: copy.metadata.title },
    description: copy.metadata.description,
    alternates: { canonical: `${SITE_URL}/black-friday` },
    openGraph: {
      type: "website",
      title: copy.metadata.title,
      description: copy.metadata.description,
      url: `${SITE_URL}/black-friday`,
      siteName: "MigosAI",
      images: [{ url: `${SITE_URL}${ownExamples[0].poster}`, width: 480, height: 854, alt: t(copy.hero.videoLabel) }],
    },
    twitter: { card: "summary", title: copy.metadata.title, description: copy.metadata.description },
  });
}

export default async function BlackFridayPage() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations()]);
  const status = getBlackFridayStatus();
  const state = status === "upcoming" ? "preview" : status;
  const cta = t(status === "active" ? copy.cta.active : copy.cta.regular);
  const statusNote = t(copy.hero[`${state}Note`]);
  const packNotice = t(copy.packs[`${state}Notice`]);
  const number = new Intl.NumberFormat(localeTags[locale]);
  const money = new Intl.NumberFormat(localeTags[locale], { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  const url = `${SITE_URL}${localizeHref("/black-friday", locale)}`;
  const faqs = [
    { question: t(copy.faq.statusQuestion), answer: t(copy.faq[`${state}Answer`]) },
    ...copy.faq.items.map(item => ({ question: t(item.question), answer: t(item.answer) })),
  ];
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": `${url}#webpage`, url, name: t(copy.metadata.title), description: t(copy.metadata.description), inLanguage: localeTags[locale], breadcrumb: { "@id": `${url}#breadcrumb` } },
      { "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`, inLanguage: localeTags[locale], itemListElement: [
        { "@type": "ListItem", position: 1, name: t(copy.breadcrumb.home), item: `${SITE_URL}${localizeHref("/", locale)}` },
        { "@type": "ListItem", position: 2, name: t(copy.breadcrumb.current), item: url },
      ] },
      { "@type": "FAQPage", "@id": `${url}#faq`, url, inLanguage: localeTags[locale], mainEntity: faqs.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
    ],
  };
  const heroExample = ownExamples[0];
  const samples = [
    { ...ownExamples[1], title: copy.showcase.duoTitle, description: copy.showcase.duoBody, label: copy.showcase.duoLabel },
    { ...seedanceExamples[0], title: copy.showcase.carTitle, description: copy.showcase.carBody, label: copy.showcase.carLabel },
  ];
  const toolHrefs = ["/ai-video-generator", "/ai-image-generator", "/hotel-lobby-ai-video-generator"];
  const toolIcons = [Clapperboard, ImageIcon, Layers3];
  const benefitIcons = [Gem, Users, Check];

  return <div className={styles.page} data-campaign-state={status}>
    <link rel="preload" as="image" href={heroExample.poster} fetchPriority="high" />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <nav className={styles.breadcrumb} aria-label={t(copy.breadcrumb.current)}>
      <Link href="/">{t(copy.breadcrumb.home)}</Link><span aria-hidden="true">/</span><span aria-current="page">{t(copy.breadcrumb.current)}</span>
    </nav>

    <section className={styles.hero} aria-labelledby="black-friday-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{t(copy.hero.eyebrow)}</p>
        <div className={`${styles.status} ${status === "active" ? styles.live : ""}`}><span aria-hidden="true" />{t(copy.status[state])}</div>
        <h1 id="black-friday-title">{t(copy.hero.title)}</h1>
        <p className={styles.heroDescription}>{t(copy.hero.description)}</p>
        <div className={styles.bonus}><Sparkles size={23} aria-hidden="true" /><strong>{t(copy.hero.bonus, { count: blackFridayCampaign.bonusPercent })}</strong></div>
        <p className={styles.bonusNote}>{t(copy.hero.bonusNote)}</p>
        <div className={styles.heroActions}>
          <CampaignLink href={PRICING_HREF} placement="black-friday-hero" className={styles.primaryButton}>{cta}<ArrowUpRight size={18} aria-hidden="true" /></CampaignLink>
          <a href="#examples" className={styles.textButton}>{t(copy.hero.secondaryCta)}<ArrowDown size={16} aria-hidden="true" /></a>
        </div>
        <p className={styles.date}><CalendarDays size={15} aria-hidden="true" />{t(copy.hero.date)}</p>
        <p className={styles.statusNote}>{statusNote}</p>
      </div>
      <figure className={styles.heroMedia}>
        <div className={styles.mediaGlow} aria-hidden="true" />
        <video controls playsInline preload="none" poster={heroExample.poster} aria-label={t(copy.hero.videoLabel)}>
          <source src={heroExample.src} type="video/mp4" />{t(copy.hero.videoFallback)}
        </video>
        <figcaption><span>{t(copy.hero.mediaLabel)}</span><strong>{t(copy.hero.mediaTitle)}</strong></figcaption>
      </figure>
    </section>

    <div className={styles.benefits}>
      {copy.benefits.map((benefit, index) => { const Icon = benefitIcons[index]; return <div className={styles.benefit} key={benefit.title}><Icon size={19} aria-hidden="true" /><div><h2>{t(benefit.title)}</h2><p>{t(benefit.body)}</p></div></div>; })}
    </div>

    <section id="campaign-packs" className={styles.section} aria-labelledby="packs-title">
      <header className={styles.sectionHeader}><p className={styles.eyebrow}>{t(copy.packs.eyebrow)}</p><h2 id="packs-title">{t(copy.packs.title)}</h2><p>{t(copy.packs.description)}</p></header>
      <p className={styles.offerNotice}>{packNotice}</p>
      <div className={styles.packGrid}>
        {creditPacks.map((pack, index) => {
          // Show the advertised campaign allocation even before or after its window.
          // The adjacent notice and CTA explicitly distinguish preview/history from a live quote.
          const offer = getCreditPackOffer(pack, Date.parse(blackFridayCampaign.startsAt));
          return <article key={pack.id} className={`${styles.pack} ${pack.recommended ? styles.featuredPack : ""}`}>
            {pack.recommended && <span className={styles.packBadge}>{t(copy.packs.featured)}</span>}
            <h3>{t(copy.packs.names[index])}</h3>
            <p className={styles.packPrice}>{money.format(pack.price)}</p>
            <p className={styles.packPayment}>{t(copy.packs.oneTime)}</p>
            <div className={styles.packTotal}><Gem size={17} aria-hidden="true" /><strong>{t(copy.packs.total, { total: number.format(offer.credits) })}</strong></div>
            <div className={styles.packBreakdown}><span>{t(copy.packs.base, { base: number.format(offer.baseCredits) })}</span><span>{t(copy.packs.bonus, { bonus: number.format(offer.bonusCredits) })}</span></div>
          </article>;
        })}
      </div>
      <div className={styles.packFooter}><CampaignLink href={PRICING_HREF} placement="black-friday-packs" className={styles.primaryButton}>{cta}<ArrowUpRight size={18} aria-hidden="true" /></CampaignLink><p>{t(copy.packs.note)}</p></div>
      <p className={styles.finePrint}>{t(copy.packs.comparison)}</p>
    </section>

    <section id="examples" className={`${styles.section} ${styles.showcase}`} aria-labelledby="examples-title">
      <div className={styles.showcaseIntro}><p className={styles.eyebrow}>{t(copy.showcase.eyebrow)}</p><h2 id="examples-title">{t(copy.showcase.title)}</h2><p>{t(copy.showcase.description)}</p><p className={styles.finePrint}>{t(copy.showcase.note)}</p></div>
      <div className={styles.sampleGrid}>{samples.map(sample => <figure className={styles.sample} key={sample.id}>
        <video controls playsInline preload="none" poster={sample.poster} aria-label={t(sample.label)}><source src={sample.src} type="video/mp4" />{t(copy.hero.videoFallback)}</video>
        <figcaption><h3>{t(sample.title)}</h3><p>{t(sample.description)}</p></figcaption>
      </figure>)}</div>
    </section>

    <section className={styles.section} aria-labelledby="tools-title">
      <header className={styles.sectionHeader}><p className={styles.eyebrow}>{t(copy.tools.eyebrow)}</p><h2 id="tools-title">{t(copy.tools.title)}</h2><p>{t(copy.tools.description)}</p></header>
      <div className={styles.toolGrid}>{copy.tools.items.map((tool, index) => { const Icon = toolIcons[index]; return <article className={styles.tool} key={tool.title}><span className={styles.toolIcon}><Icon size={22} aria-hidden="true" /></span><h3>{t(tool.title)}</h3><p>{t(tool.body)}</p><Link href={toolHrefs[index]}>{t(tool.cta)}<ArrowUpRight size={16} aria-hidden="true" /></Link></article>; })}</div>
    </section>

    <section className={`${styles.section} ${styles.stepsSection}`} aria-labelledby="steps-title">
      <header className={styles.sectionHeader}><p className={styles.eyebrow}>{t(copy.steps.eyebrow)}</p><h2 id="steps-title">{t(copy.steps.title)}</h2></header>
      <ol className={styles.steps}>{copy.steps.items.map((step, index) => <li key={step.title}><span className={styles.stepNumber} aria-hidden="true">{number.format(index + 1).padStart(2, "0")}</span><h3>{t(step.title)}</h3><p>{t(step.body)}</p></li>)}</ol>
    </section>

    <section id="faq" className={`${styles.section} ${styles.faqSection}`} aria-labelledby="faq-title">
      <header className={styles.sectionHeader}><p className={styles.eyebrow}>{t(copy.faq.eyebrow)}</p><h2 id="faq-title">{t(copy.faq.title)}</h2><p>{t(copy.faq.description)}</p></header>
      <div className={styles.faqList}>{faqs.map(item => <details key={item.question}><summary>{item.question}<Plus size={18} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div>
    </section>

    <section className={styles.closing} aria-labelledby="closing-title">
      <Sparkles size={28} className={styles.closingIcon} aria-hidden="true" />
      <p className={styles.eyebrow}>{t(copy.closing.eyebrow)}</p><h2 id="closing-title">{t(copy.closing.title)}</h2><p>{t(copy.closing.body)}</p>
      <CampaignLink href={PRICING_HREF} placement="black-friday-closing" className={styles.primaryButton}>{cta}<ArrowRight size={18} aria-hidden="true" /></CampaignLink>
      <p className={styles.closingStatus}>{t(copy.status[state])}<span aria-hidden="true"> · </span>{t(copy.hero.date)}</p>
    </section>
    <div className={styles.support}><p>{t(copy.closing.support)} <Link href="/contact">{t(copy.closing.contact)}</Link></p><div><Link href="/terms-of-service">{t(copy.closing.terms)}</Link><Link href="/refund-policy">{t(copy.closing.refunds)}</Link></div></div>
  </div>;
}
