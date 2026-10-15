import { localizeMetadata } from "@/lib/i18n/server";
import { OzilGoalPage, ozilMetadata } from "@/components/ozil-goal/page-content";

export async function generateMetadata() { return localizeMetadata(ozilMetadata("ozil-goal-ai-prompt")); }
export default async function Page() { return <OzilGoalPage slug="ozil-goal-ai-prompt" />; }
