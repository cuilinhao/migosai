import { EffectsGallery } from "@/components/effects/effects-gallery";
import { localizeMetadata } from "@/lib/i18n/server";
export async function generateMetadata() { return localizeMetadata({ title: "Hot Video Effects", description: "Create AI images, videos and music with MigosAI." }); }
export default function Page() { return <EffectsGallery/>; }
