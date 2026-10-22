"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowRight, AudioLines, ChevronLeft, ChevronRight, Clapperboard, Expand, ImageIcon, Play, Plus, Scissors, Sparkles, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { portalArticles, portalCreations, portalEffects, portalFaqs, portalTools } from "@/content/portal";
import type { OwnExample } from "@/content/own-examples";
import { ViewportVideo } from "./viewport-video";

function SectionHeading({ title, description, href, children }: { title: string; description?: string; href?: string; children?: ReactNode }) {
  const t = useTranslations();
  return <div className="portal-section-heading"><div><h2>{title === "What's New" && <span aria-hidden="true">🚀 </span>}{title === "Hot Video Effects" && <span aria-hidden="true">🔥 </span>}{t(title)}</h2>{description && <p>{t(description)}</p>}</div>{href && <Link href={href} className="portal-see-all">{t("View all")}<ArrowRight size={16}/></Link>}{children}</div>;
}

export function PortalHome() {
  const t = useTranslations();
  const carousel = useRef<HTMLDivElement>(null);
  return <div className="portal-home"><div className="portal-hero-backdrop"/><header className="portal-hero"><h1>{t("Create beyond imagination.")}<br/>{t("AI images, videos & music. All in MigosAI.")}</h1></header>
    <section className="portal-section portal-whats-new"><SectionHeading title="What's New" description="Fresh tools. More ways to bring your ideas to life."><div className="portal-carousel-controls"><button aria-label={t("Previous cards")} onClick={() => carousel.current?.scrollBy({ left: -390, behavior: "smooth" })}><ChevronLeft size={17}/></button><button aria-label={t("Next cards")} onClick={() => carousel.current?.scrollBy({ left: 390, behavior: "smooth" })}><ChevronRight size={17}/></button></div></SectionHeading>
      <div className="portal-news-track" ref={carousel}>
        <NewsCard href="/ai-image-generator" image="/landing/reference/1d20d4416701db4d.avif" title="Nano Banana 2" description="Your ideas, brought to life in stunning detail." badge="NEW" tone="image"><span className="portal-promo-word">NANO<br/><em>BANANA 2</em></span></NewsCard>
        <NewsCard href="/hotel-lobby-ai-video-generator" image="/posters/lobbyduo/wan-3-corgi-cat.jpg" video="/videos/lobbyduo/wan-3-corgi-cat.mp4" title="Hotel Lobby" description="Two photos. One unforgettable rap duo." badge="Popular" tone="lobby"><span className="portal-promo-word">{t("YOUR NEXT")}<br/><em>{t("VIRAL DUO.")}</em></span></NewsCard>
        <NewsCard href="/flying-car-ai-video-generator" image="/flyingcar/real/overpass-launch.jpg" video="/flyingcar/real/overpass-launch.mp4" title="Flying Car" description="Take your car from the street to the sky." badge="Trending" tone="car"><span className="portal-promo-word">{t("READY FOR")}<br/><em>{t("TAKEOFF?")}</em></span></NewsCard>
        <NewsCard href="/ai-rap-song-generator" image="/posters/lobbyduo/seedance-2-corgi-rap.jpg" video="/videos/lobbyduo/seedance-2-corgi-rap.mp4" title="AI Music" description="Original rap tracks from your own ideas." badge="Audio" tone="music"><span className="portal-promo-word">{t("FIND YOUR")}<br/><em>{t("OWN SOUND.")}</em></span></NewsCard>
      </div>
    </section>
    <section className="portal-section"><SectionHeading title="Hot Video Effects" description="Turn a photo into a moment worth sharing." href="/effects"/><EffectsGrid autoplay/></section>
    <section className="portal-section"><SectionHeading title="AI Tools" description="A creative toolkit for every idea." href="/tools"/><ToolsGrid/></section>
    <section className="portal-section"><SectionHeading title="Explore Creations" description="Made with MigosAI. A little inspiration for your next creation." href="/explore"/><CreationsGallery autoplay/></section>
    <section className="portal-section"><SectionHeading title="Inspiration Hub" description="Ideas, guides and a place to get started." href="/blog"/><div className="portal-hub-grid">{portalArticles.map(item => <Link href={item.href} className="portal-hub-card" key={item.href}><img loading="lazy" src={item.image} alt=""/><span>{t("GUIDE")}</span><h3>{t(item.title)}</h3><p>{t(item.description)}</p><ArrowRight size={19}/></Link>)}</div></section>
    <section className="portal-section portal-faq"><SectionHeading title="Frequently Asked Questions"/>{portalFaqs.map(item => <details key={item.question}><summary>{t(item.question)}<Plus size={18}/></summary><p>{t(item.answer)}</p></details>)}</section>
  </div>;
}

function NewsCard({ href, image, video, title, description, badge, tone, children }: { href: string; image: string; video?: string; title: string; description: string; badge: string; tone: string; children: ReactNode }) {
  const t = useTranslations();
  return <Link href={href} className="portal-news-card"><div className={`portal-news-media ${tone}`}>{video ? <ViewportVideo src={video} poster={image}/> : <img src={image} alt=""/>}{children}<span className="portal-news-badge">{t(badge)}</span><span className="portal-news-cta">{t("Try now")}<ArrowRight size={14}/></span></div><h3>{t(title)}<ArrowRight size={16}/></h3><p>{t(description)}</p></Link>;
}

export function EffectsGrid({ autoplay = false }: { autoplay?: boolean } = {}) {
  const t = useTranslations();
  return <div className="portal-effects-grid">{portalEffects.map(item => <Link className="portal-effect-card" href={item.href} key={item.title}><div className="portal-effect-media">{autoplay ? <ViewportVideo src={item.video} poster={item.image}/> : <video muted playsInline loop preload="none" poster={item.image} onMouseEnter={event => { if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) void event.currentTarget.play().catch(() => {}); }} onMouseLeave={event => event.currentTarget.pause()}><source src={item.video} type="video/mp4"/></video>}<span className="portal-effect-tag"><Sparkles size={12}/>{t(item.tag)}</span><span className="portal-effect-play"><Play size={18} fill="currentColor"/></span><span className="portal-effect-action">{t("Try effect")}<ArrowRight size={16}/></span></div><h3>{t(item.title)}</h3></Link>)}</div>;
}

const icons = { image: ImageIcon, video: Clapperboard, audio: AudioLines, sparkles: Sparkles, scissors: Scissors, expand: Expand };
export function ToolsGrid() {
  const t = useTranslations();
  return <div className="portal-tools-grid">{portalTools.map(tool => { const Icon = icons[tool.icon]; const content = <><span className={`portal-tool-icon ${tool.icon}`}><Icon size={23}/></span><span><b>{t(tool.title)}</b><small>{t(tool.description)}</small></span>{"href" in tool ? <ArrowRight className="portal-tool-arrow" size={17}/> : <em>{t("Coming soon")}</em>}</>; return "href" in tool ? <Link className="portal-tool-card" href={tool.href} key={tool.title}>{content}</Link> : <div className="portal-tool-card unavailable" aria-disabled="true" key={tool.title}>{content}</div>; })}</div>;
}

export function CreationsGallery({ autoplay = false }: { autoplay?: boolean } = {}) {
  const t = useTranslations();
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<OwnExample | null>(null);
  const filtered = portalCreations.filter(item => filter === "All" || (filter === "Wan 3.0" ? item.model === filter : item.model.startsWith("Seedance")));
  return <><div className="portal-filters" role="group" aria-label={t("Filter creations")}>{["All", "Wan 3.0", "Seedance 2.0"].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(value)}</button>)}</div><div className="portal-creations-grid">{filtered.map((item, index) => <button className={`portal-creation-card ${item.portrait ? "portrait" : ""}`} key={item.id} onClick={() => setSelected(item)} aria-label={`${t("Play video")}: ${t(item.stage)} — ${item.model}`}>{autoplay ? <ViewportVideo src={item.src} poster={item.poster} paused={selected !== null}/> : <img src={item.poster} alt={`${t(item.stage)} — ${item.model}`} loading="lazy"/>}<span className="portal-creation-play"><Play size={20} fill="currentColor"/></span><span className="portal-creation-info"><b>{t(item.stage)}</b><small>{item.model}</small></span><span className="portal-creation-index">0{index+1}</span></button>)}</div>
  <Dialog.Root open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}><Dialog.Portal><Dialog.Overlay className="portal-preview-overlay"/><Dialog.Content className="portal-preview-dialog"><Dialog.Title>{selected ? t(selected.stage) : t("Creation")}</Dialog.Title><Dialog.Description>{t("Made with MigosAI")} · {selected?.model}</Dialog.Description>{selected && <video key={selected.id} src={selected.src} poster={selected.poster} controls autoPlay playsInline/>}<Link href="/hotel-lobby-ai-video-generator">{t("Create your own")}<ArrowRight size={16}/></Link><Dialog.Close className="portal-preview-close" aria-label={t("Close")}><X size={20}/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root></>;
}

export function PortalCollection({ kind }: { kind: "tools" | "effects" | "video" | "explore" }) {
  const t = useTranslations();
  const titles = { tools: "AI Tools", effects: "Hot Video Effects", video: "AI Video Generator", explore: "Explore Creations" };
  const descriptions = { tools: "A creative toolkit for every idea.", effects: "Turn a photo into a moment worth sharing.", video: "Start with a photo. Create a story.", explore: "Made with MigosAI. A little inspiration for your next creation." };
  return <div className="portal-collection"><header><span className="portal-eyebrow">MigosAI</span><h1>{t(titles[kind])}</h1><p>{t(descriptions[kind])}</p></header>{kind === "tools" ? <ToolsGrid/> : kind === "explore" ? <CreationsGallery/> : <EffectsGrid/>}{kind === "video" && <Link className="portal-collection-cta" href="/hotel-lobby-ai-video-generator">{t("Open video generator")}<ArrowRight size={18}/></Link>}</div>;
}
