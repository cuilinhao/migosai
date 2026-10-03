"use client";

import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { VideoCard } from "@/components/video-card";
import { HOTEL_LOBBY_PATH } from "@/content/public-pages";

export function ShowcaseGrid({ limit = 9, portrait = false }: { limit?: number; portrait?: boolean }) {
  const t = useTranslations();
  return <div className={`mi-showcase-grid ${portrait ? "mi-showcase-home" : ""}`}>
    {Array.from({ length: Math.min(limit, 9) }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return <div className="geo-showcase-item" key={number}>
        <VideoCard src={`/videos/showcase-${number}.mp4`} poster={`/posters/showcase-${number}.jpg`} label={t("Hotel Lobby reference example {number}", { number })} portrait={portrait} />
        <Link className="geo-showcase-link" href={HOTEL_LOBBY_PATH}>{t("Make your own with the Hotel Lobby AI Video Generator")}</Link>
      </div>;
    })}
  </div>;
}
