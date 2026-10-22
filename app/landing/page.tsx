import { RecraftLanding } from "@/components/landing/landing-page";
import { localizeMetadata } from "@/lib/i18n/server";

export async function generateMetadata() {
  return localizeMetadata({
    title: { absolute: "MigosAI — Images, Videos & Music for Your Imagination" },
    description: "Create AI images with Nano Banana 2, bring your photos to life with Hotel Lobby, Flying Car and Özil Goal, and make your own AI rap music.",
    alternates: { canonical: "https://migosai.design/landing" },
    openGraph: { title: "MigosAI — Images, Videos & Music for Your Imagination", description: "Your ideas, in a whole new light. Explore image, video and music creation with MigosAI.", url: "https://migosai.design/landing", images: [{ url: "/landing/reference/1d20d4416701db4d.avif", width: 1920, height: 1097 }] },
  });
}

export default function LandingPage() { return <RecraftLanding/>; }
