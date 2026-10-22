import type { Metadata } from "next";
import { PortalHome } from "@/components/portal/portal-home";
import { localizeMetadata } from "@/lib/i18n/server";
const metadata: Metadata = { title: { absolute: "MigosAI — AI Images, Videos & Music" }, description: "Create AI images, videos and music with MigosAI. Explore creative tools, ready-to-use effects and Nano Banana 2 image generation.", openGraph: { title: "MigosAI — AI Images, Videos & Music", description: "Create AI images, videos and music with MigosAI.", images: ["/portal/hero.webp"] } };
export async function generateMetadata() { return localizeMetadata(metadata); }
export default function HomePage() { return <PortalHome/>; }
