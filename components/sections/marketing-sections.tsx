"use client";

import type { ReactNode } from "react";
import Link from "@/components/i18n/localized-link";
import { useTranslations } from "@/components/i18n/locale-provider";
import { featureItems, workflowSteps } from "@/content/home";
import { HOTEL_LOBBY_PATH } from "@/content/public-pages";

type TextItem = { title: string; description: string };
type FaqItem = { question: string; answer: string };

export function SectionHeading({ eyebrow, title, description, align = "center" }: { eyebrow?: string; title: ReactNode; description?: string; align?: "center" | "left" }) {
  const t = useTranslations();
  return <div className={`section-heading ${align === "left" ? "section-heading-left" : ""}`}>
    {eyebrow && <p className="eyebrow">{t(eyebrow)}</p>}
    <h2>{typeof title === "string" ? t(title) : title}</h2>
    {description && <p className="section-description">{t(description)}</p>}
  </div>;
}

export function WorkflowSection({ title = "How to Make a Hotel Lobby AI Video in 3 Simple Steps", description = "LobbyDuo keeps the setup short, so you can turn an idea into a share-ready performance. You provide the two stars and generate a share-ready clip.", steps = workflowSteps }: { title?: string; description?: string; steps?: TextItem[] }) {
  const t = useTranslations();
  return <section id="how-it-works" className="marketing-section workflow-section"><div className="section-container">
    <SectionHeading eyebrow="WORKFLOW" title={title} description={description}/>
    <div className="workflow-grid">{steps.map((step, index) => <article className="workflow-card" key={step.title}><span className="step-number">{String(index + 1).padStart(2, "0")}</span><div className="workflow-card-rule"/><h3>{t(step.title)}</h3><p>{t(step.description)}</p></article>)}</div>
    <div className="centered-action"><Link className="geo-inline-link" href={HOTEL_LOBBY_PATH}>{t("Create your video with the Hotel Lobby AI Video Generator")}</Link></div>
  </div></section>;
}

export function FeaturesSection({ title = "Key Features for a LobbyDuo Video Maker", description = "A convincing Hotel Lobby–style video starts with clear faces, a full duo, and a performance that feels ready to share.", features = featureItems }: { title?: string; description?: string; features?: TextItem[] }) {
  const t = useTranslations();
  return <section id="features" className="marketing-section features-section"><div className="section-container">
    <SectionHeading title={title} description={description}/>
    <div className="feature-grid">{features.map((feature, index) => <article className="feature-card" key={feature.title}><span className="feature-icon" aria-hidden="true">✦</span><h3>{t(feature.title)}</h3><p>{t(feature.description)}</p><span className="feature-index">0{index + 1}</span></article>)}</div>
  </div></section>;
}

export function FaqSection({ eyebrow = "FAQ", title = "LobbyDuo Video FAQs", description = "Answers about the LobbyDuo format, photos, music, generation, and pricing.", items }: { eyebrow?: string; title?: string; description?: string; items: FaqItem[] }) {
  const t = useTranslations();
  return <section id="faq" className="marketing-section faq-section"><div className="section-container">
    <SectionHeading eyebrow={eyebrow} title={title} description={description}/>
    <div className="faq-grid">{items.map((item, index) => <article className="faq-item" key={item.question}><span className="faq-number">{index + 1}</span><div><h3>{t(item.question)}</h3><p>{t(item.answer)}</p></div></article>)}</div>
  </div></section>;
}
