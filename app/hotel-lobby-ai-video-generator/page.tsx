import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import Link from "@/components/i18n/localized-link";
import { DuoVideoGenerator } from "@/components/generator/duo-video-generator";
import { ShowcaseGrid } from "@/components/showcase-grid";
import { FaqSection } from "@/components/sections/marketing-sections";
import { GeoHeader, GeoSection, GeoTable, GeoRelatedLinks, GeoCta, JsonLd, geoMetadata } from "@/components/geo/geo-page";
import { hotelLobbyTitle, hotelLobbyDescription, hotelLobbySteps, hotelLobbyFaqs, hotelLobbySchema } from "@/content/hotel-lobby";
import { HOTEL_LOBBY_PATH, SITE_URL } from "@/content/public-pages";

export async function generateMetadata() { return localizeMetadata(geoMetadata(hotelLobbyTitle, hotelLobbyDescription, HOTEL_LOBBY_PATH)); }

export default async function HotelLobbyPage() {
  const t = await getTranslations();
  return localizePageContent(<div className="geo-page">
    <JsonLd data={hotelLobbySchema(`${SITE_URL}${HOTEL_LOBBY_PATH}`)} />
    <GeoHeader title="Hotel Lobby AI Video Generator" intro="Turn two photos into a Hotel Lobby style duo video — no prompt or editing required.">
      <p className="geo-note">Sign in to generate with credits. Videos start at 50 credits. New accounts receive 50 welcome credits once, enough for one 5-second video at 480p. No subscription is required. <Link href="/pricing">See pricing</Link>.</p>
    </GeoHeader>
    <section id="generator" className="generator-section geo-generator" aria-label="Create a Hotel Lobby AI video"><DuoVideoGenerator /></section>
    <GeoSection id="how-it-works" title="How It Works">
      <div className="workflow-grid">{hotelLobbySteps.map((step, i) => <article className="workflow-card" key={step.title}><span className="step-number">0{i + 1}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
    </GeoSection>
    <GeoSection id="trend" title="What is the Hotel Lobby AI video trend?">
      <div className="geo-prose"><p>The Hotel Lobby AI video trend turns two image references into a short, coordinated duo performance in an orange studio booth. Its recognizable visual ingredients are the warm background, a hanging microphone and two performers sharing the frame. The reference is Quavo and Takeoff’s Hotel Lobby performance on COLORS, published in 2022; the AI format reimagines that setting with different people.</p>
      <p>People use the hotel lobby trend to pair friends, partners or collaborators in a playful music-video scene. In this generator, you provide a separate photo for each person and choose the output format. The tool supplies the scene instructions, so you do not need to describe lighting, staging or camera movement yourself.</p>
      <p>The result is newly generated footage, with movement and visual details that can vary. It is not an exact copy of the original performance or a guarantee of matching its choreography. Use images you have permission to animate, review the finished clip, and add any separately licensed soundtrack in your own editor if needed.</p>
      <p className="geo-note">Visual reference: <a href="https://www.youtube.com/watch?v=x9yop0nYR9g">Quavo &amp; Takeoff — HOTEL LOBBY | A COLORS SHOW</a>. This independent tool is not affiliated with the artists or COLORS.</p></div>
    </GeoSection>
    <GeoSection id="photo-requirements" title="Photo requirements & best results">
      <GeoTable caption="Prepare one photo for each performer" headings={["Photo requirement", "Recommended", "Avoid"]} rows={[
        ["File type and size", "JPG, PNG or WebP; up to 10 MB per image", "Unsupported formats or oversized files"],
        ["Faces", "One clear, front-facing person in each photo", "Crowds, hidden faces, sunglasses and heavy filters"],
        ["Framing", "Half-body or full-body photos with a recognizable face", "Cut-off heads, tiny faces or blurred details"],
        ["Lighting", "Even light and similar exposure across both photos", "Strong backlighting and deep shadows"],
        ["Permission", "Your own photos or images you may animate", "Images used without the subject’s permission"],
      ]} />
    </GeoSection>
    <GeoSection id="comparison" title="Hotel Lobby AI video generator vs. general-purpose AI video tools">
      <GeoTable caption="Choose a workflow that matches how much control you need" headings={["Workflow", "This Hotel Lobby generator", "A general-purpose video workflow"]} rows={[
        ["Prompt writing", "No prompt field; scene instructions are built in", "Usually asks you to describe or choose a scene; varies by tool"],
        ["Camera movement", "Template-directed movement; no custom camera control", "Can offer text or reference-based camera direction"],
        ["Time to a finished clip", "Photo upload, generation and review; completion time varies", "Setup, generation and any editing; completion time varies"],
        ["Two-photo input", "Separate left and right performer uploads", "Check whether the model supports two identity references"],
      ]} />
      <p>Some competitors also have dedicated Hotel Lobby tools: <a href="https://www.media.io/ai/explore/zone/hotel-lobby-ai-video-trend">Media.io</a> describes a photo-to-template workflow; <a href="https://www.lightxeditor.com/ai-video/image-to-video/hotel-lobby-ai-video/">LightX</a> offers a Hotel Lobby effect; <a href="https://renoise.ai/features/hotel-lobby-ai">Renoise</a> provides a Hotel Lobby generation page. Compare their input requirements, credits and export conditions before choosing.</p>
    </GeoSection>
    <FaqSection title="Hotel Lobby AI Video Generator FAQ" description="Direct answers about photos, credits, templates and generation." items={hotelLobbyFaqs} />
    <GeoSection id="showcase" title="Hotel Lobby video reference gallery">
      <p>Explore the orange-booth look in these reference clips. They illustrate the visual format; they are not documented generation results from this tool.</p>
      <ShowcaseGrid limit={4} portrait />
      <p className="geo-note">Suggested starting settings for your own clip: two clear portraits, 9:16, 5 seconds, 480p (50 credits). These are recommendations, not the source settings of the reference videos. <Link href="/showcases">See all nine references</Link>.</p>
    </GeoSection>
    <GeoCta local />
    <GeoRelatedLinks current={HOTEL_LOBBY_PATH} />
  </div>, t);
}
