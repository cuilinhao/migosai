import { localizeMetadata } from "@/lib/i18n/server";
import { OzilGoalPage, ozilMetadata } from "@/components/ozil-goal/page-content";

export async function generateMetadata() { return localizeMetadata(ozilMetadata("ai-football-video-from-photo")); }
export default async function Page() { return <OzilGoalPage slug="ai-football-video-from-photo" />; }
