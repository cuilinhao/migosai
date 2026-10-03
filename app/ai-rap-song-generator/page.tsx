import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import Link from "@/components/i18n/localized-link";
import { SongGenerator } from "@/components/generator/song-generator";
import { WorkflowSection, FeaturesSection, FaqSection } from "@/components/sections/marketing-sections";

export async function generateMetadata() { return localizeMetadata({ title: "AI Rap Song Generator", description: "Generate a complete rap song from an idea or your own lyrics." }); }

const steps = [
  { title: "Describe your idea or paste lyrics", description: "Write a short prompt for genre, mood, and vocal style, or paste your own lyrics with section tags like [Verse] and [Chorus]. A rough idea is enough to start." },
  { title: "Generate a complete rap song", description: "AI composes, arranges, and performs the full track in a single pass—beat, flow, and expressive vocals included. Clear structure from intro to outro." },
  { title: "Listen, download, and share", description: "Preview your song instantly, then download it or share it. Refine the prompt, try a new style, and regenerate until the track matches your sound." },
];
const features = [
  { title: "Text to Rap", description: "Turn a mood, story, or single line into an original rap track with a complete arrangement." },
  { title: "Lyrics to Music", description: "Bring your written verses and hooks to life with rhythm, melody, and a fitting beat." },
  { title: "Vocal + Instrumental Modes", description: "Create a performed song with vocals or switch to instrumental for a beat-only track." },
  { title: "Studio-Ready Audio", description: "Listen to full tracks with clear beats, expressive delivery, and balanced production." },
  { title: "Multiple Suno Models", description: "Choose V6, V6 Wild, or V6 Mini to explore different sounds." },
  { title: "Download & Keep Creating", description: "Save your favorite result, adjust the direction, and make another version whenever inspiration strikes." },
];
const faqs = [
  { question: "What is the AI Rap Song Generator?", answer: "It is an AI music tool that turns text prompts or your own lyrics into complete rap songs—with beats, structure, and vocals." },
  { question: "Do I need music experience?", answer: "No. Write a short idea or paste lyrics, pick a style, and generate. The model handles composition, arrangement, and performance." },
  { question: "Can I use my own lyrics?", answer: "Yes. Enable Custom Mode, turn off Instrumental, and paste lyrics with optional section tags like [Verse] and [Chorus] for stronger structure." },
  { question: "What styles of rap are supported?", answer: "Describe any hip-hop style in the prompt or style field—trap, boom bap, drill, melodic rap, old-school, and more." },
  { question: "Can I generate instrumental beats only?", answer: "Yes. Toggle Instrumental to generate beat-only tracks without vocals." },
  { question: "How long does generation take?", answer: "Generation time varies with the model and current demand. Once a track is ready, you can listen to it and download the audio." },
];

export default async function RapSongPage() {
  const t = await getTranslations();
  return localizePageContent(<div className="mi-song-page">
    <section className="mi-song-hero"><a className="mi-hero-badge" href="#generator"><span>NEW</span> Generate unlimited AI rap songs — try it free ›</a><h1>AI <span>Rap Song</span> Generator</h1><p>Create studio-quality rap songs instantly with AI. Describe the mood, paste your lyrics, or start from a short idea — get full vocal tracks with beats, flow, and hooks in minutes.</p></section>
    <section id="generator" className="mi-song-generator-section"><h2 className="mi-sr-only">AI Rap Song Generator</h2><SongGenerator /></section>
    <WorkflowSection title="How to Create Rap Songs with AI" description="Go from a creative idea—and optional lyrics—to a complete rap track in one generation. No music theory required." steps={steps} />
    <FeaturesSection title="Advanced Features of AI Rap Song Generator" description="Create studio-quality rap songs instantly. Generate royalty-free vocal tracks in any hip-hop style." features={features} />
    <FaqSection title="FAQs about AI Rap Song Generator" description="Everything you need to know about generating rap songs with AI." items={faqs} />
    <section className="mi-song-cta"><h2>Start Creating AI Rap Songs Today</h2><p>New to AI music or an experienced creator? Generate studio-quality rap tracks fast with our AI Rap Song Generator.</p><Link className="mi-primary-button" href="#generator">Try AI Rap Song Generator ⚡</Link></section>
  </div>, t);
}
