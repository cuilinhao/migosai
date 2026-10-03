import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import { PricingCards } from "@/components/pricing-cards";
import { CheckoutReturnStatus } from "@/components/ui/checkout-return-status";

export async function generateMetadata() { return localizeMetadata({ title: "Pricing", description: "Compare one-time credit packs for Hotel Lobby AI videos. Video generation starts at 50 credits for five seconds at 480p.", alternates: { canonical: "https://migosai.design/pricing" } }); }

export default async function PricingPage() {
  const t = await getTranslations();
  return localizePageContent(<section className="pricing-page"><div className="section-container">
    <h1>Migos AI <span className="gradient-text">Pricing and Credit Plans</span></h1>
    <p className="pricing-page-intro">Pick a one-time credit pack that fits your workflow. Every pack includes Hotel Lobby AI duo video generation — no subscription and no watermark added by Migos AI.</p>
    <CheckoutReturnStatus/>
    <PricingCards/>
  </div></section>, t);
}
