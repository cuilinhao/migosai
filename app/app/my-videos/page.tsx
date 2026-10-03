import { localizeMetadata } from "@/lib/i18n/server";
import { MyVideos } from "@/components/account/account-pages";

export async function generateMetadata() { return localizeMetadata({ title: "My Videos" }); }
export default function MyVideosPage() { return <MyVideos/>; }
