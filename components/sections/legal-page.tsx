import { getLocale, getTranslations } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import type { ReactNode } from "react";
import { CalendarDays, Link2 } from "lucide-react";

export async function LegalPage({ title, subtitle, sections, updatedAt }: { title: string; subtitle: string; updatedAt?: string; sections: { id: string; title: string; body: ReactNode }[] }) {
  const [t,locale] = await Promise.all([getTranslations(),getLocale()]);
  const date = updatedAt ? new Intl.DateTimeFormat(locale,{dateStyle:"long",timeZone:"UTC"}).format(new Date(`${updatedAt}T00:00:00Z`)) : null;
  return localizePageContent(<section className="legal-page"><div className="legal-container">
    <div className="legal-heading"><h1>{title}</h1><p>{subtitle}</p><div className="legal-date"><CalendarDays size={16}/>{date ? t("Last updated {date}",{date}) : " Last updated October 3, 2026"}</div></div>
    <div className="legal-card">{sections.map((section) => <section id={section.id} className="legal-section" key={section.id}><h2><a href={`#${section.id}`} aria-label={t("Link to {title}", { title: section.title })}><Link2 size={16}/></a>{section.title}</h2>{section.body}</section>)}</div>
  </div></section>, t);
}
