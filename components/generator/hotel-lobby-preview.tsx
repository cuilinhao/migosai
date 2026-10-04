"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { VideoCard } from "@/components/video-card";
import { videoExamples } from "@/content/video-examples";
import type { VideoSettings } from "@/lib/contracts";
import { defaultVideoSettings, videoModels } from "@/lib/video-options";

export type PreviewSettings = Pick<VideoSettings, "aspect" | "duration" | "resolution" | "model">;

const reference = videoExamples.find((example) => example.id === "noiz-boxer-kangaroo")!;
const thumbnails = videoExamples.filter((example) => example.homeFeatured).slice(0, 6);
const examplesHref = "/showcases#video-examples";

export function HotelLobbyPreview({ settings = defaultVideoSettings }: { settings?: PreviewSettings }) {
  const t = useTranslations();
  const [width, height] = settings.aspect.split(":").map(Number);
  const aspect = width === height ? settings.aspect : t(width > height ? "{ratio} landscape" : "{ratio} portrait", { ratio: settings.aspect });
  const model = videoModels.find((item) => item.id === settings.model)!.label;

  return <aside className="mi-video-preview mi-panel mi-preview-reference" aria-label={t("Video Preview")}>
    <header>
      <h2 className="mi-preview-eyebrow">{t("The Hotel Lobby look")}</h2>
      <p className="mi-preview-intro">{t("Your two photos step into this booth: a plain orange wall, one hanging mic, a lead and a hype partner.")}</p>
    </header>
    <figure className="mi-preview-figure">
      <div className="mi-preview-media">
        <VideoCard src={reference.src} poster={reference.poster} label={reference.title} previewOnVisible />
      </div>
      <figcaption className="mi-preview-meta">
        <div className="mi-preview-tags" role="group" aria-label={t("Video settings")}>
          <span>{aspect}</span>
          <span>{t("{seconds} s", { seconds: settings.duration })}</span>
          <span>{settings.resolution}</span>
          <span>{model}</span>
        </div>
        <a className="mi-preview-source" href={reference.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
          {t("Reference example by {source}", { source: reference.sourceName })}<ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </figcaption>
    </figure>
    <section className="mi-preview-examples" aria-label={t("More Hotel Lobby AI videos")}>
      <div className="mi-preview-examples-heading">
        <h3>{t("More Hotel Lobby AI videos")}</h3>
        <Link href={examplesHref}>{t("See examples")}</Link>
      </div>
      <div className="mi-preview-thumbnails">
        {thumbnails.map((example) => <Link href={examplesHref} key={example.id}>
          <img src={example.poster} alt={t(example.title)} loading="lazy" width={320} height={180} />
        </Link>)}
      </div>
    </section>
  </aside>;
}
