"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ChevronDown, Menu, Sun, X } from "lucide-react";
import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import styles from "./landing.module.css";

const reference = "/landing/reference/";
const slides = [
  { image: "1d20d4416701db4d.avif", alt: "Platinum-haired model wearing sculptural blue fabric", first: "Tastefully", second: "crafted", title: "AI IMAGES & VIDEOS", description: "Turn a spark of an idea into something you can see, hear and share. Create images, bring photos to life and make your own music.", href: "/ai-image-generator" },
  { image: "f18a4b7793111e32.webp", alt: "Illustrated explorer facing a creature among ancient ruins", first: "Wildly", second: "imagined", title: "MAKE IT YOUR OWN", description: "Start with a few words or your own reference images. Explore a new visual direction with Nano Banana 2.", href: "/ai-image-generator" },
  { image: "934b8e32c2d4bf3b.webp", alt: "Red editorial art direction", first: "Unexpectedly", second: "together", title: "IDEAS IN MOTION", description: "Two portraits, one microphone. Make your own Hotel Lobby duo, then discover more ways to put your photos in motion.", href: "/hotel-lobby-ai-video-generator" },
] as const;

const gallery = [
  { image: "2f7a0b4082d5e436.avif", alt: "Natural-light close-up portrait with fine skin details", label: "Every little detail" },
  { image: "649e5188b6b1dc99.webp", alt: "Friends in colorful jackets in a dramatic volcanic landscape", label: "A world of possibilities" },
  { image: "1d20d4416701db4d.avif", alt: "Platinum-haired model wearing sculptural blue fabric", label: "A different point of view" },
  { image: "64ae39ce81e6bf62.avif", alt: "Two dancers with braided hair in a black-and-white editorial photograph", label: "A style of your own" },
];

export function RecraftLanding() {
  const t = useTranslations();
  const [slide, setSlide] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const current = slides[slide];
  const move = (direction: number) => setSlide(value => (value + direction + slides.length) % slides.length);
  const scrollGallery = (direction: number) => {
    const rail = galleryRef.current;
    if (!rail) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({ left: direction * rail.clientWidth * .8, behavior: reduced ? "instant" : "smooth" });
  };
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
  const sliderKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); }
  };
  const nav = (close = false) => <>
    <Link href="/" onClick={() => close && setMenuOpen(false)}>{t("MigosAI Studio")}<ChevronDown size={13}/></Link>
    <Link href="#image" onClick={() => close && setMenuOpen(false)}>{t("AI images")}<ChevronDown size={13}/></Link>
    <Link href="#video" onClick={() => close && setMenuOpen(false)}>{t("AI video")}<ChevronDown size={13}/></Link>
    <Link href="/ai-rap-song-generator" onClick={() => close && setMenuOpen(false)}>{t("AI music")}</Link>
    <Link href="#inspiration" onClick={() => close && setMenuOpen(false)}>{t("Inspiration")}</Link>
    <Link href="/pricing" onClick={() => close && setMenuOpen(false)}>{t("Pricing")}</Link>
  </>;

  return <div className={styles.page}>
    <a className={styles.skip} href="#landing-content">{t("Skip to content")}</a>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="MigosAI"><Sun size={28} strokeWidth={2.5} aria-hidden="true"/><b>MigosAI</b></Link>
      <nav className={styles.desktopNav} aria-label={t("Primary navigation")}>{nav()}</nav>
      <div className={styles.headerActions}><Link className={styles.signIn} href="/sign-in">{t("Sign in")}</Link><Link className={styles.limeButton} href="/ai-image-generator">{t("Try MigosAI")}</Link></div>
      <button ref={menuButton} type="button" className={styles.menuButton} aria-expanded={menuOpen} aria-controls="landing-mobile-menu" aria-label={t(menuOpen ? "Close menu" : "Open menu")} onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X/> : <Menu/>}</button>
      {menuOpen && <nav ref={menuRef} className={styles.mobileNav} id="landing-mobile-menu" aria-label={t("Mobile navigation")}>{nav(true)}<Link href="/sign-in" onClick={() => setMenuOpen(false)}>{t("Sign in")}</Link><LanguageSwitcher/></nav>}
    </header>
    <div className={styles.announcement}><span>{t("Meet Nano Banana 2. Your next idea starts here.")}</span><Link href="/ai-image-generator">{t("Explore the model")}<ArrowRight size={15}/></Link></div>

    <main id="landing-content">
      <section className={styles.heroSection} aria-roledescription="carousel" aria-label={t("Creative possibilities")} onKeyDown={sliderKeys}>
        <div className={styles.hero} id="landing-slide" role="group" aria-roledescription="slide" aria-label={`${slide + 1} / ${slides.length}`}>
          <img key={current.image} className={styles.heroImage} src={reference + current.image} alt={t(current.alt)} width={1920} height={1097} fetchPriority="high"/>
          <div className={styles.heroShade}/>
          <div className={styles.heroCopy}>
            <h1><span><i>{t(current.first)}</i> {t(current.second)}</span><span>{t(current.title)}</span></h1>
            <p>{t(current.description)}</p>
            <div className={styles.heroActions}><Link className={styles.limeButton} href={current.href}>{t("Start creating")}</Link><Link className={styles.whiteButton} href="/">{t("Explore tools")}</Link></div>
          </div>
          <div className={styles.dots} aria-label={t("Choose a slide")}>{slides.map((item, index) => <button type="button" key={item.image} aria-label={t("Show slide {number}", { number: index + 1 })} aria-current={slide === index ? "true" : undefined} onClick={() => setSlide(index)}/>)}</div>
        </div>
        <button type="button" className={`${styles.sliderArrow} ${styles.previous}`} aria-label={t("Previous slide")} aria-controls="landing-slide" onClick={() => move(-1)}><ArrowLeft/></button>
        <button type="button" className={`${styles.sliderArrow} ${styles.next}`} aria-label={t("Next slide")} aria-controls="landing-slide" onClick={() => move(1)}><ArrowRight/></button>
        <span className={styles.screenReader} role="status" aria-live="polite">{t(current.title)} · {slide + 1} / {slides.length}</span>
      </section>

      <section className={styles.modelBand} aria-label={t("One place. More possibilities.")}>
        <p>{t("One place. More possibilities.")}</p><div><span className={styles.nano}>Nano Banana <b>2</b></span><span>Hotel Lobby</span><span className={styles.flying}>Flying Car ↗</span><span>Özil Goal</span><span className={styles.music}>AI RAP <i>♫</i></span></div>
      </section>

      <section id="image" className={styles.featureSection}>
        <div className={styles.featureImage}><img src={reference + "64ae39ce81e6bf62.avif"} alt={t("Two dancers with braided hair in a black-and-white editorial photograph")} width={2048} height={1170} loading="lazy"/><span className={styles.imageLabel}>{t("A new perspective starts with you.")}</span></div>
        <div className={styles.featureCopy}><h2>{t("YOUR IDEAS.")}<br/>{t("IN EVERY DETAIL.")}</h2><div><p>{t("Create with Nano Banana 2")}</p><p className={styles.muted}>{t("Describe your idea or upload reference images. Choose your aspect ratio, image size and JPG or PNG, then make something worth a second look.")}</p><Link className={styles.textLink} href="/ai-image-generator">{t("Make your first image")}<ArrowRight size={20}/></Link><div className={styles.creditPills}><span>{t("1K · 5 credits")}</span><span>{t("2K · 8 credits")}</span><span>{t("4K · 12 credits")}</span></div></div></div>
      </section>

      <section id="inspiration" className={styles.gallerySection}>
        <div className={styles.sectionTop}><h2>{t("REAL FEELING.")}<br/>{t("UNREAL POSSIBILITIES.")}</h2><div><p>{t("From a quiet portrait to an entirely new world. Find a direction, then make it yours.")}</p><div className={styles.railControls}><button type="button" aria-label={t("Previous images")} aria-controls="landing-image-gallery" onClick={() => scrollGallery(-1)}><ArrowLeft/></button><button type="button" aria-label={t("Next images")} aria-controls="landing-image-gallery" onClick={() => scrollGallery(1)}><ArrowRight/></button></div></div></div>
        <div className={styles.galleryRail} ref={galleryRef} id="landing-image-gallery" tabIndex={0} role="region" aria-label={t("Image inspiration gallery")}>{gallery.map(item => <figure key={item.image}><img src={reference + item.image} alt={t(item.alt)} width={900} height={1060} loading="lazy"/><figcaption><span>{t(item.label)}</span><ArrowDown size={16}/></figcaption></figure>)}</div>
      </section>

      <section className={styles.collageSection}>
        <div className={styles.collageCopy}><span>{t("Let your imagination take the lead")}</span><h2>{t("GO BEYOND")}<br/>{t("THE ORDINARY.")}</h2><p>{t("Portraits, illustrations, posters and playful experiments. One image model, so many directions to explore.")}</p><Link className={styles.blackButton} href="/ai-image-generator">{t("Create something unexpected")}<ArrowRight size={18}/></Link></div>
        <div className={styles.collageArt} aria-label={t("A mix of illustration and photographic styles")}><img className={styles.collageOne} src={reference + "061ae2158390ed68.avif"} alt={t("Playful red illustration of a character in a sombrero")} width={600} height={600} loading="lazy"/><img className={styles.collageTwo} src={reference + "d7eb0e5d4207720b.webp"} alt={t("Animated-style cyclist riding through a starry landscape")} width={600} height={600} loading="lazy"/><img className={styles.collageThree} src={reference + "a028b8c05b36ee9f.avif"} alt={t("Expressive red decorative alphabet on a cream background")} width={600} height={400} loading="lazy"/><span className={styles.collageSticker}>{t("MAKE")}<br/>{t("SOMETHING")}<br/><i>{t("you.")}</i></span></div>
      </section>

      <section id="video" className={styles.videoSection}>
        <div className={styles.sectionTop}><h2>{t("STILL IMAGES.")}<br/>{t("NEW MOVES.")}</h2><div><p>{t("A duo at the mic. A car that takes flight. Your own goal celebration. Give your photos a story to tell.")}</p><Link className={styles.textLink} href="/hotel-lobby-ai-video-generator">{t("Discover AI video")}<ArrowRight size={20}/></Link></div></div>
        <div className={styles.videoGrid}>{[
          { name: "Hotel Lobby", caption: "Two photos. One unforgettable duo.", image: "/posters/lobbyduo/seedance-2-corgi-rap.jpg", href: "/hotel-lobby-ai-video-generator" },
          { name: "Flying Car", caption: "Take your next idea off the ground.", image: "/flyingcar/real/overpass-launch.jpg", href: "/flying-car-ai-video-generator" },
          { name: "Özil Goal", caption: "Make it your moment.", image: "/ozil-goal/samples/ai-shot1.jpg", href: "/ozil-goal-generator" },
        ].map(item => <Link key={item.name} href={item.href} className={styles.videoCard}><div><img src={item.image} alt={item.name} width={600} height={720} loading="lazy"/><span className={styles.roundArrow}><ArrowRight/></span></div><h3>{item.name}</h3><p>{t(item.caption)}</p></Link>)}</div>
      </section>

      <section className={styles.soundSection}><div className={styles.soundArtwork} aria-hidden="true"><span>♪</span><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><div><p className={styles.kicker}>{t("GIVE YOUR IDEA A SOUNDTRACK")}</p><h2>{t("A LITTLE RHYTHM.")}<br/>{t("A LOT OF YOU.")}</h2><p>{t("Start with a prompt or your own lyrics. Create an AI rap song, listen to the result and download your track.")}</p><Link className={styles.limeButton} href="/ai-rap-song-generator">{t("Make some music")}<ArrowRight size={18}/></Link></div></section>

      <section className={styles.finalCta}><p>{t("YOUR NEXT IDEA IS WAITING")}</p><h2>{t("LET’S MAKE")}<br/><i>{t("something.")}</i></h2><Link className={styles.limeButton} href="/ai-image-generator">{t("Try MigosAI")}<ArrowRight size={22}/></Link><span>{t("Sign in and purchase credits to generate. No free credits are included at registration.")}</span></section>
    </main>

    <footer className={styles.footer}><div className={styles.footerTop}><Link href="/" className={styles.footerBrand}>MigosAI<span>↗</span></Link><p>{t("More imagination. Fewer limits.")}</p><LanguageSwitcher/></div><div className={styles.footerLinks}><div><h3>{t("Create")}</h3><Link href="/ai-image-generator">{t("AI images")}</Link><Link href="/hotel-lobby-ai-video-generator">Hotel Lobby</Link><Link href="/flying-car-ai-video-generator">Flying Car</Link><Link href="/ozil-goal-generator">Özil Goal</Link><Link href="/ai-rap-song-generator">{t("AI music")}</Link></div><div><h3>{t("Explore")}</h3><Link href="/">{t("MigosAI Studio")}</Link><Link href="/showcases">{t("Video examples")}</Link><Link href="/pricing">{t("Pricing")}</Link><Link href="/blog">{t("Blog")}</Link></div><div><h3>{t("Your account")}</h3><Link href="/sign-in">{t("Sign in")}</Link><Link href="/app/assets">{t("Your creations")}</Link><Link href="/app/my-credits">{t("Your credits")}</Link></div><div><h3>{t("Useful things")}</h3><Link href="/contact">{t("Contact")}</Link><Link href="/privacy-policy">{t("Privacy Policy")}</Link><Link href="/terms-of-service">{t("Terms of Service")}</Link><Link href="/refund-policy">{t("Refund Policy")}</Link><Link href="/acceptable-use-policy">{t("Acceptable Use Policy")}</Link></div></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} MigosAI</span><span>{t("Make something that feels like you.")}</span></div></footer>
  </div>;
}
