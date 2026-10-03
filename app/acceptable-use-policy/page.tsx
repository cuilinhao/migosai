import Link from "@/components/i18n/localized-link";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/content/support";
import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import { LegalPage } from "@/components/sections/legal-page";

export async function generateMetadata() { return localizeMetadata({ title: "Acceptable Use Policy" }); }

const sections = [
  { id: "permission-and-responsibility", title: "Permission and Responsibility", body: <p>Use only photos, audio, video, and other material you own or are authorized to use. Obtain permission from each person depicted; a parent or guardian must authorize images of minors. An image being public online does not give you permission to use it. You are responsible for your inputs and for publishing generated results.</p> },
  { id: "prohibited-content", title: "Prohibited Content and Conduct", body: <><p>The following six categories are prohibited:</p><ul>
    <li>Sexual or exploitative content: nudity, pornography, non-consensual intimate imagery, sexual deepfakes, and any sexualization or exploitation of minors.</li>
    <li>Violence, hate, and harassment: graphic violence, threats, incitement, hateful attacks against protected groups, targeted abuse, or defamatory content.</li>
    <li>Unauthorized impersonation: using a real person, celebrity, or public figure without permission, or making anyone appear to say, do, or endorse something in a misleading way.</li>
    <li>Rights and privacy violations: infringing copyright, trademarks, or likeness rights; publishing private information; or using images, voices, or music without required permission.</li>
    <li>Illegal or deceptive activity: fraud, scams, unlawful goods or services, or fabricated media intended to deceive people about consequential events.</li>
    <li>System abuse: malware, spam, automated abuse, bypassing safety or payment controls, stealing accounts, or disrupting the service or its providers.</li>
  </ul></> },
  { id: "ai-output-and-sharing", title: "AI Output and Sharing", body: <p>Review your output before sharing it and disclose its AI-generated nature where required by law or platform rules. Do not claim a generated performance is a real recording or endorsement. LobbyDuo is an independent service and does not represent the artists or organizations referenced by the Hotel Lobby trend.</p> },
  { id: "review-and-enforcement", title: "Review and Enforcement", body: <p>Generated videos undergo automated SeeAPI safety review before delivery. This is not a guarantee that every violation will be detected, and it does not mean every prompt, photo, or audio input is screened. We may hold results for manual review, investigate reports, restrict access, remove content, or suspend accounts when necessary.</p> },
  { id: "report-content", title: "Report Content or Appeal a Decision", body: <><p>Email us with the relevant URL or generation ID, a description of the concern, and your contact details. For rights complaints, explain your connection to the affected person or rights holder. We review reports and appeals and may request more information before taking action. Do not send passwords, full card numbers, or unnecessary sensitive material.</p><p><a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a></p><p><Link href="/terms-of-service">Terms of Service</Link> · <Link href="/privacy-policy">Privacy Policy</Link> · <Link href="/refund-policy">Refund Policy</Link></p></> },
];

export default async function AcceptableUsePolicyPage() {
  const t = await getTranslations();
  return localizePageContent(<LegalPage title="Acceptable Use Policy" subtitle="Consent, safe creation, and content reports" sections={sections}/>, t);
}
