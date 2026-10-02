import type { Metadata } from "next";
import { ShowcaseGrid } from "@/components/showcase-grid";

export const metadata: Metadata = { title: "Showcase", description: "Watch Hotel Lobby AI videos made with Migos AI." };

export default function ShowcasesPage() {
  return <div className="mi-showcases-page">
    <h1 className="mi-sr-only">Migos AI Showcases</h1>
    <h2>Hotel Lobby AI Videos Made with Migos AI</h2>
    <p>Click any video to watch. Friends, couples, pets, and unexpected orange-booth duos — all generated with Migos AI.</p>
    <ShowcaseGrid />
  </div>;
}
