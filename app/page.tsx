import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import Link from "@/components/i18n/localized-link";
import { DuoVideoGenerator } from "@/components/generator/duo-video-generator";
import { ShowcaseGrid } from "@/components/showcase-grid";
import { VideoExamples } from "@/components/video-examples";
import { FeaturesSection, FaqSection, SectionHeading, WorkflowSection } from "@/components/sections/marketing-sections";
import { PricingCards } from "@/components/pricing-cards";
import { homeFaqItems } from "@/content/home";
import { HOTEL_LOBBY_PATH } from "@/content/public-pages";

export async function generateMetadata() { return localizeMetadata({ alternates: { canonical: "https://migosai.design" } }); }

export default async function HomePage() {
  const t = await getTranslations();
  return localizePageContent(<>
    <section id="hero" className="hero"><div className="hero-glow"/><div className="section-container hero-inner">
      <div className="trending-badge"><span className="trending-label">TRENDING</span><span className="trending-copy">Make a Hotel Lobby duo video from two photos</span><span className="trending-arrow" aria-hidden="true">›</span></div>
      <h1><span className="gradient-text">Hotel Lobby</span><br className="mobile-break"/> AI Video<br className="desktop-break"/> Generator</h1>
      <p>LobbyDuo turns two photos into a short rap-duo clip in the orange-booth style of the Hotel Lobby AI trend. Choose two performers you have permission to use, pick a stage, model and sound, and get a video ready for TikTok, Reels and Shorts.</p>
      <Link className="geo-inline-link" href={HOTEL_LOBBY_PATH}>Try the Hotel Lobby AI Video Generator</Link>
    </div></section>
    <section id="generator" className="generator-section"><DuoVideoGenerator/></section>
    <section className="trend-section marketing-section"><div className="section-container trend-grid">
      <div><p className="eyebrow">HOTEL LOBBY AI EXAMPLES</p><h2>What is the Hotel Lobby AI video trend?</h2><div className="trend-tags"><span>Two Photos</span><span>One Mic</span><span>Four Stages</span></div></div>
      <div className="trend-copy"><p>The trend borrows the look of a 2022 performance video: two artists in a bright orange room, sharing one microphone that hangs from the ceiling. AI versions keep that framing and swap in new performers, from best friends to pets to original cartoon characters.</p><p>LobbyDuo is built for that two-person setup. Each photo fills its own side of the frame, and the model animates expressions, gestures and turns at the mic so the clip plays like a duet rather than a slideshow.</p><p>The format works best with contrast: a grandparent and a grandchild, a cat and a dog, two coworkers with opposite energy. The more unexpected the pair, the more likely people are to watch it twice.</p></div>
    </div></section>
    <section id="showcase" className="marketing-section home-showcase"><div className="section-container">
      <SectionHeading title="Hotel Lobby AI Videos Made with LobbyDuo" description="Unedited results from this generator using the built-in Hotel Lobby template. Your result depends on your photos and settings."/>
      <ShowcaseGrid portrait/>
      <div className="centered-action"><Link href="/#generator" className="pill-gradient-button">Create a Hotel Lobby AI Video</Link></div>
    </div></section>
    <VideoExamples/>
    <WorkflowSection/>
    <FeaturesSection/>
    <FaqSection items={homeFaqItems}/>
    <section id="pricing" className="marketing-section home-pricing"><div className="section-container"><SectionHeading title="LobbyDuo Pricing and Credit Plans" description="One-time credit packs in US dollars. No subscription, and completely unused packs can be refunded within 14 days."/><PricingCards/></div></section>
    <section id="cta" className="marketing-section home-cta"><div className="section-container"><SectionHeading title="Ready to make your Hotel Lobby AI video?" description="Start with two photos you have the right to use. New accounts get 50 free credits, enough for a 5-second 480p video."/><Link className="pill-gradient-button" href="/#generator">Create Hotel Lobby AI Video</Link></div></section>
  </>, t);
}
