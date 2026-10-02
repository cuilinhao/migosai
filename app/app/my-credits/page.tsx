import type { Metadata } from "next";
import { MyCredits } from "@/components/account/account-pages";

export const metadata: Metadata = { title: "My Credits" };
export default function MyCreditsPage() { return <MyCredits/>; }
