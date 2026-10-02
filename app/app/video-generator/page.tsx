import type { Metadata } from "next";
import { DuoVideoGenerator } from "@/components/generator/duo-video-generator";

export const metadata: Metadata = { title: "Generate Video" };

export default function AccountVideoGeneratorPage() { return <div className="dashboard-generator"><DuoVideoGenerator/></div>; }
