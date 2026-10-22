"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Menu, Pause, Play, Plus, Sun, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { galleryImages, heroSlides, landingCopy as copy, landingFaqs, productCards } from "./landing-content";
import styles from "./landing.module.css";

const assets = "/landing/ideogram/";

export function RecraftLanding() {
  const t = useTranslations();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const videoOpener = useRef<HTMLButtonElement | null>(null);
  const imageOpener = useRef<HTMLButtonElement | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const move = (step: number) => setSlide(value => (value + step + heroSlides.length) % heroSlides.length);
  const moveImage = (step: number) => setPreview(value => value === null ? null : (value + step + galleryImages.length) % galleryImages.length);

  useEffect(() => {
    if (paused || videoOpen || preview !== null || menuOpen) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (!document.hidden && !motion.matches && !document.querySelector('[data-landing-hero]:focus-within')) move(1);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [paused, videoOpen, preview, menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target) && !menuButton.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", outside); };
  }, [menuOpen]);

  const navigation = () => <>
    <Link href="/tools" onClick={() => setMenuOpen(false)}>{t(copy.tools)}</Link>
    <Link href="/effects" onClick={() => setMenuOpen(false)}>{t(copy.exploreEffects)}</Link>
    <Link href="#inspiration" onClick={() => setMenuOpen(false)}>{t("Inspiration")}</Link>
    <Link href="/pricing" onClick={() => setMenuOpen(false)}>{t("Pricing")}</Link>
    <Link href="#faq" onClick={() => setMenuOpen(false)}>{t(copy.faqTitle)}</Link>
  </>;

  return <div className={styles.page}>
    <a className={styles.skip} href="#landing-content">{t("Skip to content")}</a>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="MigosAI"><Sun aria-hidden="true" size={24}/><b>MigosAI</b></Link>
      <nav className={styles.desktopNav} aria-label={t("Primary navigation")}>{navigation()}</nav>
      <div className={styles.headerActions}><Link href="/sign-in">{t("Sign in")}</Link><Link className={styles.button} href="/ai-image-generator">{t(copy.getStarted)}</Link></div>
      <button ref={menuButton} type="button" className={styles.menuButton} aria-expanded={menuOpen} aria-controls="landing-mobile-menu" aria-label={t(menuOpen ? "Close menu" : "Open menu")} onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X/> : <Menu/>}</button>
      {menuOpen && <nav ref={menuRef} id="landing-mobile-menu" className={styles.mobileNav} aria-label={t("Mobile navigation")}>{navigation()}<Link href="/sign-in">{t("Sign in")}</Link><LanguageSwitcher/></nav>}
    </header>
    <main id="landing-content">
      <section className={styles.hero} data-landing-hero aria-roledescription="carousel" aria-label={t("Creative possibilities")} onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); }
      }} tabIndex={0}>
        <div id="landing-slide" role="group" aria-roledescription="slide" aria-label={`${slide + 1} / ${heroSlides.length}`} className={styles.heroMedia}><img key={heroSlides[slide].image} src={assets + heroSlides[slide].image} alt={t(heroSlides[slide].alt)} width={1920} height={1080} fetchPriority="high"/></div>
        <div className={styles.heroShade}/>
        <div className={styles.heroCopy}><p className={styles.eyebrow}>{t(copy.heroEyebrow)}</p><h1>{t(copy.heroTitle)}</h1><p>{t(copy.heroDescription)}</p><div className={styles.actions}><Link className={styles.button} href="/ai-image-generator">{t(copy.getStarted)}</Link><a className={styles.outlineButton} href="#inspiration">{t(copy.seeExamples)}</a></div></div>
        <button className={styles.videoTeaser} type="button" aria-label={t(copy.playVideo)} onClick={event => { videoOpener.current = event.currentTarget; setVideoOpen(true); }}><span><img src="/posters/lobbyduo/seedance-2-corgi-rap.jpg" width={400} height={225} alt=""/><Play aria-hidden="true" size={32}/></span><small>{t(copy.watchVideo)}</small></button>
        <div className={styles.slideshowControls}><button type="button" onClick={() => move(-1)} aria-label={t("Previous slide")} aria-controls="landing-slide"><ArrowLeft size={18}/></button><span>{slide + 1} / {heroSlides.length}</span><button type="button" onClick={() => move(1)} aria-label={t("Next slide")} aria-controls="landing-slide"><ArrowRight size={18}/></button><button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)} aria-label={t(paused ? copy.resumeSlideshow : copy.pauseSlideshow)}>{paused ? <Play size={16}/> : <Pause size={16}/>}</button></div>
      </section>
      <section className={styles.modelBand} aria-label={t("One place. More possibilities.")}><p>{t("One place. More possibilities.")}</p><span>Nano Banana 2</span><span>Hotel Lobby</span><span>Flying Car</span><span>Özil Goal</span><span>AI RAP ♫</span></section>
      <section className={styles.products} id="tools"><h2>{t(copy.onePlatform)}<br/>{t(copy.threeWays)}</h2><div className={styles.productGrid}>{productCards.map(item => <article key={item.name}><Link href={item.href} className={styles.productImage}><img src={assets + item.image} width={600} height={420} alt={t(item.name)} loading="lazy"/></Link><div className={styles.productCopy}><p className={styles.eyebrow}>{t(item.name)}</p><h3>{t(item.title)}</h3><p>{t(item.description)}</p><div className={styles.actions}><Link className={styles.darkButton} href={item.href}>{t(item.action)}</Link>{"secondary" in item && <Link className={styles.textLink} href={item.secondary}>{t(item.secondaryLabel)}<ArrowRight size={15}/></Link>}</div></div></article>)}</div></section>
      <section className={styles.featured}><p className={styles.pill}>{t(copy.featured)}</p><h2>{t(copy.modelTitle)}</h2><p>{t(copy.modelDescription)}</p><Link className={styles.darkButton} href="/ai-image-generator">{t("Create with Nano Banana 2")}</Link><img className={styles.featureImage} src={assets + "4820372c13574bd2.webp"} alt={t(copy.modelImageAlt)} width={1500} height={820} loading="lazy"/></section>
      <section className={styles.promptSection}><div><p className={styles.eyebrow}>{t(copy.promptEyebrow)}</p><h2>{t(copy.promptTitle)}</h2><p>{t(copy.promptDescription)}</p><ul>{[copy.promptFeature1, copy.promptFeature2, copy.promptFeature3, copy.promptFeature4].map(item => <li key={item}>{t(item)}</li>)}</ul><div className={styles.credits}>{["1K · 5 credits", "2K · 8 credits", "4K · 12 credits"].map(item => <span key={item}>{t(item)}</span>)}</div><Link className={styles.darkButton} href="/ai-image-generator">{t(copy.createImage)}<ArrowRight size={16}/></Link></div><div className={styles.promptCard}><span>{t(copy.promptLabel)}</span><p>{t(copy.samplePrompt)}</p><small>{t(copy.promptNote)}</small></div></section>
      <section className={styles.videoSection}><div><p className={styles.eyebrow}>{t(copy.videoEyebrow)}</p><h2>{t(copy.videoHeading)}</h2><p>{t(copy.videoBody)}</p><div className={styles.actions}><Link className={styles.button} href="/hotel-lobby-ai-video-generator">{t(copy.createVideo)}</Link><Link className={styles.outlineButton} href="/effects">{t(copy.exploreEffects)}</Link></div></div><button type="button" className={styles.videoPreview} aria-label={t(copy.playVideo)} onClick={event => { videoOpener.current = event.currentTarget; setVideoOpen(true); }}><img src="/posters/lobbyduo/seedance-2-corgi-rap.jpg" alt={t(copy.videoTitle)} width={720} height={500} loading="lazy"/><span><Play aria-hidden="true"/>{t(copy.watchVideo)}</span></button></section>
      <section className={styles.gallerySection} id="inspiration"><h2>{t(copy.galleryTitle)}</h2><p>{t(copy.galleryDescription)}</p><div className={styles.gallery}>{galleryImages.map((item, index) => <button type="button" key={item.image} style={{ aspectRatio: item.aspect }} aria-label={t(copy.previewImage, { name: t(item.alt) })} onClick={event => { imageOpener.current = event.currentTarget; setPreview(index); }}><img src={assets + item.image} alt={t(item.alt)} width={600} height={800} loading="lazy"/></button>)}</div><Link className={styles.darkButton} href="/ai-image-generator">{t("Start creating")}</Link></section>
      <section className={styles.faq} id="faq"><h2>{t(copy.faqTitle)}</h2><div>{landingFaqs.map(item => <details key={item.question}><summary>{t(item.question)}<Plus aria-hidden="true" size={16}/></summary><p>{t(item.answer)}</p></details>)}</div></section>
    </main>
    <footer className={styles.footer}><div className={styles.footerGrid}><div><Link className={styles.brand} href="/"><Sun aria-hidden="true" size={24}/>MigosAI</Link><p>{t(copy.footerTagline)}</p><LanguageSwitcher/></div><div><h3>{t(copy.product)}</h3><Link href="/ai-image-generator">{t("AI images")}</Link><Link href="/hotel-lobby-ai-video-generator">Hotel Lobby</Link><Link href="/flying-car-ai-video-generator">Flying Car</Link><Link href="/ozil-goal-generator">Özil Goal</Link><Link href="/ai-rap-song-generator">{t("AI music")}</Link></div><div><h3>{t(copy.resources)}</h3><Link href="/">{t("MigosAI Studio")}</Link><Link href="/pricing">{t("Pricing")}</Link><Link href="/blog">{t("Blog")}</Link><Link href="/app/assets">{t("Your creations")}</Link><Link href="/contact">{t(copy.contact)}</Link></div><div><h3>{t("Useful things")}</h3>{[["/privacy-policy", "Privacy Policy"], ["/terms-of-service", "Terms of Service"], ["/refund-policy", "Refund Policy"], ["/acceptable-use-policy", "Acceptable Use Policy"]].map(([href, label]) => <Link key={href} href={href}>{t(label)}</Link>)}</div></div><p className={styles.creditNote}>{t("Sign in and purchase credits to generate. No free credits are included at registration.")}</p><div className={styles.footerBottom}>© {new Date().getFullYear()} MigosAI</div></footer>
    <Dialog.Root open={videoOpen} onOpenChange={setVideoOpen}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={styles.dialog} onCloseAutoFocus={event => { event.preventDefault(); videoOpener.current?.focus(); }}><Dialog.Title>{t(copy.videoTitle)}</Dialog.Title><Dialog.Description>{t(copy.videoFootnote)}</Dialog.Description>{videoOpen && <video src="/videos/lobbyduo/seedance-2-corgi-rap.mp4" poster="/posters/lobbyduo/seedance-2-corgi-rap.jpg" controls autoPlay playsInline/>}<Link className={styles.button} href="/hotel-lobby-ai-video-generator">{t(copy.createVideo)}</Link><Dialog.Close className={styles.close} aria-label={t(copy.closeVideo)}><X/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={preview !== null} onOpenChange={open => { if (!open) setPreview(null); }}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content onCloseAutoFocus={event => { event.preventDefault(); imageOpener.current?.focus(); }} className={`${styles.dialog} ${styles.imageDialog}`} onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); moveImage(event.key === "ArrowLeft" ? -1 : 1); } }}><Dialog.Title>{t(copy.referenceLabel)}</Dialog.Title><Dialog.Description>{preview !== null ? t(galleryImages[preview].alt) : ""}</Dialog.Description>{preview !== null && <img src={assets + galleryImages[preview].image} alt={t(galleryImages[preview].alt)} width={1000} height={1000}/>}<div className={styles.previewControls}><button type="button" onClick={() => moveImage(-1)} aria-label={t(copy.previousImage)}><ArrowLeft/></button><span>{preview !== null ? preview + 1 : 0} / {galleryImages.length}</span><button type="button" onClick={() => moveImage(1)} aria-label={t(copy.nextImage)}><ArrowRight/></button></div><Dialog.Close className={styles.close} aria-label={t(copy.closePreview)}><X/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
