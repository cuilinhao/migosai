import { AccountGeneratorHeading } from "@/components/account/generator-heading";
import { localizeMetadata } from "@/lib/i18n/server";
import { DuoVideoGenerator } from "@/components/generator/duo-video-generator";

export async function generateMetadata() { return localizeMetadata({ title: "Generate Video" }); }

export default function AccountVideoGeneratorPage() { return <div className="dashboard-generator"><AccountGeneratorHeading/><DuoVideoGenerator/></div>; }
