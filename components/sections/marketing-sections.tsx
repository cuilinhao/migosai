import type { ReactNode } from "react";
import { featureItems, workflowSteps } from "@/content/home";

type TextItem = { title: string; description: string };
type FaqItem = { question: string; answer: string };

export function SectionHeading({ eyebrow, title, description, align = "center" }: { eyebrow?: string; title: ReactNode; description?: string; align?: "center" | "left" }) {
  return <div className={`section-heading ${align === "left" ? "section-heading-left" : ""}`}>
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    <h2>{title}</h2>
    {description && <p className="section-description">{description}</p>}
  </div>;
}

export function WorkflowSection({ title = "How to Make a Hotel Lobby AI Video in 3 Simple Steps", description = "Migos AI keeps the setup short, so you can turn an idea into a share-ready performance. You provide the two stars and generate a share-ready clip.", steps = workflowSteps }: { title?: string; description?: string; steps?: TextItem[] }) {
  return <section id="how-it-works" className="marketing-section workflow-section"><div className="section-container">
    <SectionHeading eyebrow="WORKFLOW" title={title} description={description}/>
    <div className="workflow-grid">{steps.map((step, index) => <article className="workflow-card" key={step.title}><span className="step-number">{String(index + 1).padStart(2, "0")}</span><div className="workflow-card-rule"/><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
  </div></section>;
}

export function FeaturesSection({ title = "Key Features for a Migos AI Video Maker", description = "A convincing Hotel Lobby–style video starts with clear faces, a full duo, and a performance that feels ready to share.", features = featureItems }: { title?: string; description?: string; features?: TextItem[] }) {
  return <section id="features" className="marketing-section features-section"><div className="section-container">
    <SectionHeading title={title} description={description}/>
    <div className="feature-grid">{features.map((feature, index) => <article className="feature-card" key={feature.title}><span className="feature-icon" aria-hidden="true">✦</span><h3>{feature.title}</h3><p>{feature.description}</p><span className="feature-index">0{index + 1}</span></article>)}</div>
  </div></section>;
}

export function FaqSection({ eyebrow = "FAQ", title = "Migos AI Video FAQs", description = "Answers about the Migos AI format, photos, music, generation, and pricing.", items }: { eyebrow?: string; title?: string; description?: string; items: FaqItem[] }) {
  return <section id="faq" className="marketing-section faq-section"><div className="section-container">
    <SectionHeading eyebrow={eyebrow} title={title} description={description}/>
    <div className="faq-grid">{items.map((item, index) => <article className="faq-item" key={item.question}><span className="faq-number">{index + 1}</span><div><h3>{item.question}</h3><p>{item.answer}</p></div></article>)}</div>
  </div></section>;
}
