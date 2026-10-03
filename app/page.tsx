import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import Link from "@/components/i18n/localized-link";
import { DuoVideoGenerator } from "@/components/generator/duo-video-generator";
import { VideoCard } from "@/components/video-card";
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
      <div className="trending-badge"><span className="trending-label">TRENDING</span><span className="trending-copy">Create Your Hotel Lobby AI Video</span><span className="trending-arrow" aria-hidden="true">›</span></div>
      <h1><span className="gradient-text">Migos AI</span><br className="mobile-break"/> Hotel Lobby<br className="desktop-break"/> Video Generator</h1>
      <p>Recreate the viral Migos AI video trend with two photos using Migos AI. Turn your chosen duo into a Quavo and Takeoff–inspired Hotel Lobby performance, complete with the recognizable orange COLORS-style backdrop, hanging microphone, and coordinated rap movements.</p>
      <Link className="geo-inline-link" href={HOTEL_LOBBY_PATH}>Try the Hotel Lobby AI Video Generator</Link>
    </div></section>
    <section id="generator" className="generator-section"><DuoVideoGenerator/></section>
    <section className="trend-section marketing-section"><div className="section-container trend-grid">
      <div><p className="eyebrow">HOTEL LOBBY AI EXAMPLES</p><h2>What is the Migos AI video trend?</h2><div className="trend-tags"><span>Two-Photo Duo</span><span>Orange Booth</span><span>Hanging Mic</span></div></div>
      <div className="trend-copy"><p>A hotel-lobby AI video is a short, punchy performance inspired by the 2022 Hotel Lobby visual. Upload two portraits and Migos AI brings them together in the warm orange booth, with a hanging mic overhead and coordinated rap moves.</p><p>Migos AI builds around two recognizable faces. It keeps the performers side by side, using their expressions, hand gestures, and back-and-forth performance to make the pairing feel like a real duet.</p><p>Combine friends, couples, coworkers, characters, or pets. The larger the contrast between your two choices, the more surprising and shareable your Hotel Lobby video becomes.</p></div>
    </div></section>
    <section id="showcase" className="marketing-section home-showcase"><div className="section-container">
      <SectionHeading title="Hotel Lobby AI Reference Examples" description="Explore the orange backdrop, hanging microphone, and duo performance style in these reference clips."/>
      <div className="home-video-grid">{[1,2,3,4].map((number) => <div className="geo-showcase-item" key={number}>
        <VideoCard src={`/videos/showcase-0${number}.mp4`} poster={`/posters/showcase-0${number}.jpg`} label={`Hotel Lobby reference example ${number}`} portrait/>
        <Link className="geo-showcase-link" href={HOTEL_LOBBY_PATH}>Make your own with the Hotel Lobby AI Video Generator</Link>
      </div>)}</div>
      <div className="centered-action"><Link href="/#generator" className="pill-gradient-button">Create a Hotel Lobby AI Video</Link></div>
    </div></section>
    <VideoExamples/>
    <WorkflowSection/>
    <FeaturesSection/>
    <FaqSection items={homeFaqItems}/>
    <section id="pricing" className="marketing-section home-pricing"><div className="section-container"><SectionHeading title="Migos AI Pricing and Credit Plans" description="Pick a one-time credit pack that fits your Hotel Lobby AI workflow."/><PricingCards/></div></section>
    <section id="cta" className="marketing-section home-cta"><div className="section-container"><SectionHeading title="Ready to make your Hotel Lobby AI video?" description="Upload two authorized photos, keep the hanging mic and fixed framing, and generate your Migos AI Hotel Lobby video."/><Link className="pill-gradient-button" href="/#generator">Create Hotel Lobby AI Video</Link></div></section>
  </>, t);
}
