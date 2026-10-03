import { localizeMetadata } from "@/lib/i18n/server";
import { MyCredits } from "@/components/account/account-pages";

export async function generateMetadata() { return localizeMetadata({ title: "My Credits" }); }
export default function MyCreditsPage() { return <MyCredits/>; }
