"use client";

import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { VideoCard } from "@/components/video-card";
import { ownExamples } from "@/content/own-examples";
import { HOTEL_LOBBY_PATH } from "@/content/public-pages";

export function ShowcaseGrid({ limit = ownExamples.length, portrait = false }: { limit?: number; portrait?: boolean }) {
  const t = useTranslations();
  return <div className={`mi-showcase-grid ${portrait ? "mi-showcase-home" : ""}`}>
    {ownExamples.slice(0, limit).map((example) => {
      const caption = `${t("Made with LobbyDuo")} · ${example.model} · ${t(example.stage)}`;
      return <div className="geo-showcase-item" key={example.id}>
        <VideoCard src={example.src} poster={example.poster} label={caption} portrait={portrait} />
        <p className="geo-showcase-caption">{caption}</p>
        <Link className="geo-showcase-link" href={HOTEL_LOBBY_PATH}>{t("Make your own with the Hotel Lobby AI Video Generator")}</Link>
      </div>;
    })}
  </div>;
}
