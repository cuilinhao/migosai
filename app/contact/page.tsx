import Link from "@/components/i18n/localized-link";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/content/support";
import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import { LegalPage } from "@/components/sections/legal-page";

export async function generateMetadata() { return localizeMetadata({ title: "Contact", description: "Contact LobbyDuo support for billing, refunds, privacy requests and content reports." }); }

const sections = [
  { id: "email-support", title: "Email Support", body: <><p>Email us at the address below. We aim to reply within two business days.</p><p><a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a></p></> },
  { id: "what-to-include", title: "What to Include", body: <ul><li>Billing or refunds: your account email and the order ID or Stripe receipt.</li><li>Generation problems: the generation ID or the time you submitted it, and what went wrong.</li><li>Privacy requests: the email you sign in with and what you would like us to do.</li><li>Content reports: a link to or description of the content and why it should be removed.</li></ul> },
  { id: "payments-and-refunds", title: "Payments and Refunds", body: <><p>Payments are processed by Stripe. Refund requests follow our Refund Policy. Never send passwords or full card numbers by email.</p><p><Link href="/refund-policy">Refund Policy</Link> · <Link href="/terms-of-service">Terms of Service</Link> · <Link href="/privacy-policy">Privacy Policy</Link> · <Link href="/acceptable-use-policy">Acceptable Use Policy</Link></p></> },
  { id: "about-lobbyduo", title: "About LobbyDuo", body: <p>LobbyDuo is an independent online service at migosai.design for creating AI duo videos and songs. It is not affiliated with migosai.com, Migos, Quavo, Takeoff, Quality Control Music or COLORS.</p> },
];

export default async function ContactPage() {
  const t = await getTranslations();
  return localizePageContent(<LegalPage title="Contact" subtitle="Support, billing, privacy and content reports" sections={sections}/>, t);
}
