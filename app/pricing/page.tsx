import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import { PricingCards } from "@/components/pricing-cards";
import { CheckoutReturnStatus } from "@/components/ui/checkout-return-status";

export async function generateMetadata() { return localizeMetadata({ title: "Pricing", description: "Compare one-time credit packs for Hotel Lobby AI videos. Credit cost depends on the model, settings, and reference duration.", alternates: { canonical: "https://migosai.design/pricing" } }); }

export default async function PricingPage() {
  const t = await getTranslations();
  return localizePageContent(<section className="pricing-page"><div className="section-container">
    <h1>LobbyDuo <span className="gradient-text">Pricing and Credit Plans</span></h1>
    <p className="pricing-page-intro">Pick a one-time credit pack that fits your workflow. Every pack includes Hotel Lobby AI duo video generation — no subscription and no watermark added by LobbyDuo.</p>
    <CheckoutReturnStatus/>
    <PricingCards/>
  </div></section>, t);
}
