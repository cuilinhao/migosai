import { PortalCollection } from "@/components/portal/portal-home";
import { localizeMetadata } from "@/lib/i18n/server";
export async function generateMetadata() { return localizeMetadata({ title: "AI Tools", description: "Create AI images, videos and music with MigosAI." }); }
export default function Page() { return <PortalCollection kind="tools"/>; }
