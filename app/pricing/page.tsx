import type { Metadata } from "next";
import { PricingCards } from "@/components/pricing-cards";
import { CheckoutReturnStatus } from "@/components/ui/checkout-return-status";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return <section className="pricing-page"><div className="section-container">
    <h1>Migos AI <span className="gradient-text">Pricing and Credit Plans</span></h1>
    <p className="pricing-page-intro">Pick a one-time credit pack that fits your workflow. Every pack includes Hotel<br className="wide-break"/> Lobby AI duo video generation — no subscriptions, no watermarks.</p>
    <CheckoutReturnStatus/>
    <PricingCards/>
  </div></section>;
}
