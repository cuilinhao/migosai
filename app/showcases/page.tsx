import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import { ShowcaseGrid } from "@/components/showcase-grid";
import { VideoExamples } from "@/components/video-examples";

export async function generateMetadata() { return localizeMetadata({ title: "Hotel Lobby AI Reference Examples", description: "Explore reference clips of the Hotel Lobby orange-booth duo format, then create your own video with LobbyDuo.", alternates: { canonical: "https://migosai.design/showcases" } }); }

export default async function ShowcasesPage() {
  const t = await getTranslations();
  return localizePageContent(<><div className="mi-showcases-page">
    <h1 className="mi-sr-only">Hotel Lobby AI Reference Examples</h1>
    <h2>Hotel Lobby AI Reference Examples</h2>
    <p>Watch reference clips of the orange-booth duo format, with a hanging microphone and side-by-side performances.</p>
    <ShowcaseGrid />
  </div><VideoExamples showAll /></>, t);
}
