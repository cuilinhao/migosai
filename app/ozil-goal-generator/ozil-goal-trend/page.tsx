import { localizeMetadata } from "@/lib/i18n/server";
import { OzilGoalPage, ozilMetadata } from "@/components/ozil-goal/page-content";

export async function generateMetadata() { return localizeMetadata(ozilMetadata("ozil-goal-trend")); }
export default async function Page() { return <OzilGoalPage slug="ozil-goal-trend" />; }
