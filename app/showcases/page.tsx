import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import { ShowcaseGrid } from "@/components/showcase-grid";
import { VideoExamples } from "@/components/video-examples";
import { SectionHeading } from "@/components/sections/marketing-sections";
import { seedanceExamples } from "@/content/own-examples";

export async function generateMetadata() { return localizeMetadata({ title: "Hotel Lobby AI Reference Examples", description: "Explore reference clips of the Hotel Lobby orange-booth duo format, then create your own video with LobbyDuo.", alternates: { canonical: "https://migosai.design/showcases" } }); }

export default async function ShowcasesPage() {
  const t = await getTranslations();
  return localizePageContent(<><div className="mi-showcases-page">
    <h1 className="mi-sr-only">Hotel Lobby AI Reference Examples</h1>
    <h2>Hotel Lobby AI Reference Examples</h2>
    <p>The first clips below were generated with LobbyDuo. Further down, you will find third-party examples of the trend with links to their sources.</p>
    <ShowcaseGrid />
    <section id="seedance-examples" className="marketing-section">
      <SectionHeading title="Seedance video examples" description="Two Seedance model samples: a text-to-video corgi rap with Seedance 2.0, and a street performance from two original animal photos with Seedance 2.0 Fast. Both use 5-second, 480p, 9:16 settings with audio enabled." />
      <ShowcaseGrid examples={seedanceExamples} captionLabel="Seedance model example" />
    </section>
  </div><VideoExamples showAll /></>, t);
}
