"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";

const clips = [
  { id: "grandma-and-grandson", label: "Grandma and grandson" },
  { id: "best-friends", label: "Best friends" },
  { id: "man-and-dog", label: "Man and his dog" },
  { id: "young-couple", label: "Young couple" },
] as const;

function HeroClip({ id, label, active, onToggle }: { id: string; label: string; active: boolean; onToggle: () => void }) {
  const t = useTranslations();
  const videoRef = useRef<HTMLVideoElement>(null);
  const preview = `/videos/home-hero/reel/site-${id}.mp4`;
  const fullVideo = `/videos/home-hero/site-${id}.mp4`;
  const src = active ? fullVideo : preview;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      if (visible && !document.hidden && (active || !motion.matches)) {
        void video.play().catch(() => { /* Keep the poster visible if autoplay is unavailable. */ });
      } else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: 0.2 });
    observer.observe(video);
    document.addEventListener("visibilitychange", update);
    motion.addEventListener("change", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      motion.removeEventListener("change", update);
      video.pause();
    };
  }, [active, src]);

  const toggle = () => {
    const video = videoRef.current;
    if (video) {
      // Start the audio version in the user gesture, including on mobile Safari.
      video.src = active ? preview : fullVideo;
      video.muted = active;
      void video.play().catch(() => { /* The user can retry using the same control. */ });
    }
    onToggle();
  };

  return <li className="home-hero-clip">
    <figure>
      <video ref={videoRef} src={src} poster={`/posters/home-hero/site-${id}.webp`} muted={!active} loop playsInline preload="none" width="540" height="960" aria-label={t(label)} />
      <figcaption>{t(label)}</figcaption>
      <button type="button" onClick={toggle} aria-pressed={active} aria-label={t(active ? "Turn sound off: {label}" : "Turn sound on: {label}", { label: t(label) })}>
        <span>{active ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}</span>
      </button>
    </figure>
  </li>;
}

function HangingMic() {
  return <svg className="home-hero-mic" viewBox="0 0 80 220" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="home-mic-metal"><stop stopColor="#6f767f"/><stop offset=".22" stopColor="#c9ced4"/><stop offset=".48" stopColor="#fff"/><stop offset=".7" stopColor="#bfc5cc"/><stop offset="1" stopColor="#5f666e"/></linearGradient>
      <linearGradient id="home-mic-grille"><stop stopColor="#4c525a"/><stop offset=".5" stopColor="#d8dce1"/><stop offset="1" stopColor="#474c53"/></linearGradient>
    </defs>
    <path d="M40 0V70" stroke="#2a1d14" strokeOpacity=".55" strokeWidth="2.2"/>
    <rect x="30" y="68" width="20" height="12" rx="3" fill="url(#home-mic-metal)"/>
    <rect x="33" y="79" width="14" height="8" rx="2" fill="#3b3f45"/>
    <rect x="21" y="85" width="38" height="72" rx="12" fill="url(#home-mic-metal)"/>
    <rect x="19" y="154" width="42" height="58" rx="21" fill="url(#home-mic-grille)"/>
    {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M22 ${162 + i * 5.4}H58`} stroke="#1d140e" strokeOpacity=".28" strokeWidth="1.2"/>)}
    <rect x="19" y="150" width="42" height="8" rx="3" fill="#2d3136"/>
  </svg>;
}

export function HomeHero() {
  const t = useTranslations();
  const [activeClip, setActiveClip] = useState<string | null>(null);
  return <section id="hero" className="home-hero" aria-labelledby="home-hero-title">
    <HangingMic />
    <div className="home-hero-container">
      <div className="home-hero-copy">
        <p className="home-hero-badge"><span aria-hidden="true" />{t("Your photos. Your rap duo.")}</p>
        <h1 id="home-hero-title">{t("Make Your Own Hotel Lobby Video with AI")}</h1>
        <p className="home-hero-description">{t("LobbyDuo is an AI rap duo video generator for the Hotel Lobby trend.")}</p>
        <Link className="home-hero-action" href="/#generator"><span aria-hidden="true">🎵</span><span>{t("Use your own song? Start here")}</span><span aria-hidden="true">→</span></Link>
      </div>
      <div className="home-hero-reel">
        <div className="home-hero-scroll">
          <ul aria-label={t("Video examples")}>
            {clips.map(clip => <HeroClip key={clip.id} {...clip} active={activeClip === clip.id} onToggle={() => setActiveClip(current => current === clip.id ? null : clip.id)} />)}
          </ul>
        </div>
        <a className="home-hero-credit" href="https://hotellobbyvideo.net/" target="_blank" rel="noreferrer">{t("Reference videos from Hotel Lobby Video")}</a>
      </div>
    </div>
  </section>;
}
