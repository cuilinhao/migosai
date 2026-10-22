import { PortalCollection } from "@/components/portal/portal-home";
import { localizeMetadata } from "@/lib/i18n/server";
export async function generateMetadata() { return localizeMetadata({ title: "Explore Creations", description: "Create AI images, videos and music with MigosAI." }); }
export default function Page() { return <PortalCollection kind="explore"/>; }
