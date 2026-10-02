import type { Metadata } from "next";
import { MyVideos } from "@/components/account/account-pages";

export const metadata: Metadata = { title: "My Videos" };
export default function MyVideosPage() { return <MyVideos/>; }
