"use client";

import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { VideoCard } from "@/components/video-card";
import { ownExamples, type OwnExample } from "@/content/own-examples";
import { HOTEL_LOBBY_PATH } from "@/content/public-pages";

export function ShowcaseGrid({ examples = ownExamples, limit = examples.length, portrait = false, captionLabel = "Made with LobbyDuo" }: { examples?: readonly OwnExample[]; limit?: number; portrait?: boolean; captionLabel?: string }) {
  const t = useTranslations();
  return <div className={`mi-showcase-grid ${portrait ? "mi-showcase-home" : ""}`}>
    {examples.slice(0, limit).map((example) => {
      const caption = `${t(captionLabel)} · ${example.model} · ${t(example.stage)}`;
      return <div className="geo-showcase-item" key={example.id}>
        <VideoCard src={example.src} poster={example.poster} label={caption} portrait={example.portrait ?? portrait} previewOnVisible />
        <p className="geo-showcase-caption">{caption}</p>
        <Link className="geo-showcase-link" href={HOTEL_LOBBY_PATH}>{t("Make your own with the Hotel Lobby AI Video Generator")}</Link>
      </div>;
    })}
  </div>;
}
