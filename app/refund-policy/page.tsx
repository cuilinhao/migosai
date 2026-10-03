import Link from "@/components/i18n/localized-link";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/content/support";
import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import { LegalPage } from "@/components/sections/legal-page";

export async function generateMetadata() { return localizeMetadata({ title: "Refund Policy" }); }

const sections = [
  { id: "one-time-purchases", title: "One-time Credit Purchases", body: <p>LobbyDuo sells one-time credit packs through Stripe. There are no subscriptions or automatic renewals. This policy applies to credit-pack purchases and supplements our Terms of Service.</p> },
  { id: "unused-packs", title: "Unused Credit Packs", body: <p>You may request a refund within 14 days of purchase if none of the credits from that pack have been used. We check the order and credit ledger to confirm eligibility. Approved refunds remove the corresponding credits from your account.</p> },
  { id: "payment-and-service-issues", title: "Payment and Service Issues", body: <p>Contact us about duplicate charges, paid credits that did not arrive, or a prolonged service outage that prevents use of purchased credits. We will investigate the payment and service records and arrange an appropriate correction or refund where warranted.</p> },
  { id: "failed-generations", title: "Failed Generations", body: <p>Credits deducted for a generation that is confirmed as failed are returned to your balance. This is a credit restoration, not a cash refund. If credits are missing or a task remains unresolved, send support the generation ID so we can investigate.</p> },
  { id: "used-credits", title: "Used Credits and AI Results", body: <p>Credits consumed by a successful generation are generally not refundable. AI results can vary, so dissatisfaction with a completed result does not by itself qualify for a refund. This does not remove any remedies required by applicable consumer law.</p> },
  { id: "request-a-refund", title: "How to Request a Refund", body: <><p>Email us from your account address with your order ID, purchase date, and a short explanation. We aim to respond within five business days, but complex cases may take longer. Approved refunds are sent to the original payment method; the processor and your bank determine when they appear.</p><p><a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a></p></> },
  { id: "consumer-rights", title: "Your Consumer Rights", body: <><p>Nothing in this policy limits mandatory consumer rights, including any cancellation, withdrawal, or refund rights that apply where you live.</p><p><Link href="/terms-of-service">Terms of Service</Link> · <Link href="/acceptable-use-policy">Acceptable Use Policy</Link></p></> },
];

export default async function RefundPolicyPage() {
  const t = await getTranslations();
  return localizePageContent(<LegalPage title="Refund Policy" subtitle="Payments, unused credits, and failed generations" sections={sections}/>, t);
}
