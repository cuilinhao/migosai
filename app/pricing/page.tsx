import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import { PricingCards } from "@/components/pricing-cards";
import { CheckoutReturnStatus } from "@/components/ui/checkout-return-status";
import styles from "@/components/pricing-cards.module.css";

export async function generateMetadata() { return localizeMetadata({ title: "Pricing", description: "Compare MigosAI monthly and yearly subscriptions or one-time credit packs for AI images, videos and music.", alternates: { canonical: "https://migosai.design/pricing" } }); }

export default async function PricingPage() {
  const t = await getTranslations();
  return localizePageContent(<section className={`pricing-page ${styles.page}`}><div className="section-container">
    <h1>Power up your creation</h1>
    <p className="pricing-page-intro">Choose a subscription for your monthly creative routine, or top up with a one-time credit pack. Create images, videos and music with MigosAI.</p>
    <CheckoutReturnStatus/>
    <PricingCards/>
  </div></section>, t);
}
