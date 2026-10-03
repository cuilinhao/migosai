"use client";

import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { useRef } from "react";
import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { VideoCard } from "@/components/video-card";
import { landscapeVideoExamples, portraitVideoExamples, type VideoExample } from "@/content/video-examples";
import { youtubeShowcaseExamples } from "@/content/youtube-showcase";

function ExampleFigure({ example }: { example: VideoExample }) {
  const t = useTranslations();
  return <figure className={`reference-example reference-example-${example.orientation}`}>
    <VideoCard src={example.src} poster={example.poster} label={example.title} portrait={example.orientation === "portrait"} previewOnVisible />
    <figcaption>
      <h3>{t(example.title)}</h3>
      <a href={example.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
        {t("Reference example by {source}", { source: example.sourceName })}
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    </figcaption>
  </figure>;
}

export function VideoExamples({ showAll = false }: { showAll?: boolean }) {
  const t = useTranslations();
  const railRef = useRef<HTMLDivElement>(null);
  const featured = landscapeVideoExamples.filter((example) => example.homeFeatured);
  const landscape = showAll ? [...featured, ...landscapeVideoExamples.filter((example) => !example.homeFeatured)] : featured;
  const portrait = showAll ? [...youtubeShowcaseExamples, ...portraitVideoExamples] : portraitVideoExamples;
  const scrollRail = (direction: number) => {
    const rail = railRef.current;
    if (rail) rail.scrollBy({ left: direction * rail.clientWidth * 0.8, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return <section id="video-examples" className="reference-examples-section" aria-labelledby="video-examples-title">
    <div className="section-container">
      <header className="reference-examples-intro">
        <p className="reference-examples-eyebrow">{t("The photos, the performance")}</p>
        <h2 id="video-examples-title">{t("Hotel Lobby AI video examples")}</h2>
        <p className="reference-examples-description">{t("Cats, chihuahuas, grandmas, anime heroes, best friends: the orange booth works with any two performers. Explore clips from creators on X and other tools, with the original sources linked below.")}</p>
      </header>
      <div className="reference-landscape-grid">
        {landscape.map((example) => <ExampleFigure key={example.id} example={example} />)}
      </div>

      <section className="reference-portrait-section" aria-labelledby="vertical-video-examples-title">
        <header className="reference-portrait-heading">
          <div>
            <h2 id="vertical-video-examples-title">{t("Vertical Hotel Lobby AI videos for TikTok and Reels")}</h2>
            <p>{t("9:16 versions from other creators. Pick 9:16 in the generator to make yours.")}</p>
          </div>
          {!showAll && <Link href="/showcases#video-examples" className="reference-more-link">{t("More examples of the trend")}<ArrowRight size={18} aria-hidden="true" /></Link>}
        </header>
        <div className="reference-portrait-rail" ref={railRef} id="reference-portrait-rail" tabIndex={0} role="region" aria-label={t("Vertical Hotel Lobby AI videos for TikTok and Reels")}>
          {portrait.map((example) => <ExampleFigure key={example.id} example={example} />)}
        </div>
        <div className="reference-rail-controls">
          <button type="button" onClick={() => scrollRail(-1)} aria-label={t("Previous videos")} aria-controls="reference-portrait-rail"><ArrowLeft size={20} aria-hidden="true" /></button>
          <button type="button" onClick={() => scrollRail(1)} aria-label={t("Next videos")} aria-controls="reference-portrait-rail"><ArrowRight size={20} aria-hidden="true" /></button>
        </div>
      </section>
    </div>
  </section>;
}
