import type { MetadataRoute } from "next";

export const SITE_URL = "https://migosai.design";
export const HOTEL_LOBBY_PATH = "/hotel-lobby-ai-video-generator";

export type PublicPage = {
  path: string;
  label: string;
  priority: number;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  lastModified?: string;
};

// Add only live public routes. Set lastModified only for a recorded content revision.
export const publicPages: PublicPage[] = [
  { path: "/", label: "Home", priority: 1, changeFrequency: "monthly" },
  { path: HOTEL_LOBBY_PATH, label: "Hotel Lobby AI Video Generator", priority: 0.9, changeFrequency: "monthly", lastModified: "2026-10-02" },
  { path: "/hotel-lobby-ai-video-generator-free", label: "Credits & Limits", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-10-02" },
  { path: "/hotel-lobby-ai-template", label: "Hotel Lobby AI Template", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-10-02" },
  { path: "/hotel-lobby-ai-filter", label: "Hotel Lobby AI Filter & Face Swap", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-10-02" },
  { path: "/hotel-lobby-ai-generator", label: "Hotel Lobby AI Generator Guide", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-10-02" },
  { path: "/blog/best-hotel-lobby-ai-video-generators-2026", label: "Compare Hotel Lobby AI Tools", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-10-02" },
  { path: "/blog", label: "Blog", priority: 0.7, changeFrequency: "weekly", lastModified: "2026-10-04" },
  { path: "/blog/what-is-hotel-lobby-ai-video", label: "What Is a Hotel Lobby AI Video?", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-10-04" },
  { path: "/blog/hotel-lobby-ai-trend-song", label: "What Song Is in the Hotel Lobby AI Trend?", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-10-04" },
  { path: "/blog/hotel-lobby-ai-video-cat-dog", label: "Hotel Lobby AI Video With Your Cat or Dog", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-10-04" },
  { path: "/blog/hotel-lobby-ai-video-problems-fixes", label: "Hotel Lobby AI Video Problems and Fixes", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-10-04" },
  { path: "/pricing", label: "Pricing", priority: 0.7, changeFrequency: "monthly" },
  { path: "/showcases", label: "Reference Examples", priority: 0.7, changeFrequency: "monthly" },
  { path: "/ai-rap-song-generator", label: "AI Rap Song Generator", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy-policy", label: "Privacy Policy", priority: 0.7, changeFrequency: "yearly", lastModified: "2026-10-03" },
  { path: "/terms-of-service", label: "Terms of Service", priority: 0.7, changeFrequency: "yearly", lastModified: "2026-10-03" },
  { path: "/refund-policy", label: "Refund Policy", priority: 0.7, changeFrequency: "yearly", lastModified: "2026-10-03" },
  { path: "/acceptable-use-policy", label: "Acceptable Use Policy", priority: 0.7, changeFrequency: "yearly", lastModified: "2026-10-03" },
  { path: "/contact", label: "Contact", priority: 0.5, changeFrequency: "yearly", lastModified: "2026-10-03" },
];

export const hotelLobbyPages = publicPages.filter((page) => page.path.startsWith("/hotel-lobby-") || page.path.startsWith("/blog/best-hotel-lobby-"));
