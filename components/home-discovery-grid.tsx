"use client";

import { useRef, useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import Link from "@/components/i18n/localized-link";
import type { DiscoveryBadge } from "@/content/home-discovery";

export type HomeDiscoveryItem = {
  href: string;
  title: string;
  blurb: string;
  poster: string;
  video?: string;
  type: string;
  badge: { kind: Exclude<DiscoveryBadge, null>; label: string } | null;
  meta: string;
  campaign: boolean;
  cta: string;
  offer?: { amount: string; label: string; dates: string };
};

/** Cards render on the server; the muted preview video is only created on hover, so it never affects page load. */
export function HomeDiscoveryGrid({ items }: { items: HomeDiscoveryItem[] }) {
  return <ul className="home-discovery-grid">{items.map(item => <li key={item.href}><DiscoveryCard item={item}/></li>)}</ul>;
}

function canPreview() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function DiscoveryCard({ item }: { item: HomeDiscoveryItem }) {
  const [previewing, setPreviewing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const hovering = useRef(false);
  const start = () => {
    hovering.current = true;
    if (!item.video || !canPreview()) return;
    setPreviewing(true);
    const element = video.current;
    if (element) { element.currentTime = 0; void element.play().catch(() => undefined); }
  };
  const stop = () => { hovering.current = false; setPlaying(false); video.current?.pause(); };
  const onPlaying = () => { if (hovering.current) setPlaying(true); else video.current?.pause(); };
  return <Link className="home-discovery-card" href={item.href} onMouseEnter={start} onMouseLeave={stop} data-offer={item.offer ? "" : undefined} data-playing={playing ? "" : undefined}>
    <span className="home-discovery-media">
      <img src={item.poster} alt="" width={480} height={600} loading="lazy" decoding="async"/>
      {previewing && item.video && <video ref={video} src={item.video} muted loop playsInline autoPlay preload="none" aria-hidden="true" onPlaying={onPlaying}/>}
      {item.offer && <span className="home-discovery-offer" aria-hidden="true"><strong>{item.offer.amount}</strong><span>{item.offer.label}<br/>{item.offer.dates}</span></span>}
      <span className="home-discovery-badges">
        {item.badge && <span className="home-discovery-badge" data-badge={item.badge.kind}>{item.badge.label}</span>}
        <span className="home-discovery-type">{item.type}</span>
      </span>
      {item.video && !item.offer && <span className="home-discovery-play" aria-hidden="true"><Play size={12} fill="currentColor"/></span>}
    </span>
    <span className="home-discovery-body">
      <span className="home-discovery-title">{item.title}</span>
      <span className="home-discovery-blurb">{item.blurb}</span>
      <span className="home-discovery-meta" data-campaign={item.campaign ? "" : undefined}><span>{item.meta}</span><span className="home-discovery-go" aria-hidden="true">{item.cta}<ArrowRight size={13}/></span></span>
    </span>
  </Link>;
}
