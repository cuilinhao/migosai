import { VideoCard } from "@/components/video-card";

export function ShowcaseGrid({ limit = 8, portrait = false }: { limit?: number; portrait?: boolean }) {
  return <div className={`mi-showcase-grid ${portrait ? "mi-showcase-home" : ""}`}>
    {Array.from({ length: Math.min(limit, 8) }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return <VideoCard key={number} src={`/videos/showcase-${number}.mp4`} poster={`/posters/showcase-${number}.jpg`} label={`Hotel Lobby AI video ${number}`} portrait={portrait} />;
    })}
  </div>;
}
