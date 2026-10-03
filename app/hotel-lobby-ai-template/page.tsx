import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import Link from "@/components/i18n/localized-link";
import { GeoCta, GeoHeader, GeoRelatedLinks, GeoSection, GeoTable, geoMetadata } from "@/components/geo/geo-page";
import type { AspectRatio, VideoDuration, VideoResolution } from "@/lib/contracts";
import { aspectRatios, defaultVideoSettings, getVideoCost, videoDurations, videoResolutions } from "@/lib/video-options";

const path = "/hotel-lobby-ai-template";
const defaultCost = getVideoCost(defaultVideoSettings.duration, defaultVideoSettings.resolution, defaultVideoSettings.model);
const configurations: { purpose: string; aspect: AspectRatio; duration: VideoDuration; resolution: VideoResolution; reason: string }[] = [
  { purpose: "First portrait-format attempt", aspect: "9:16", duration: 5, resolution: "480p", reason: "A short Wan template configuration; review the pairing before spending more on another generation." },
  { purpose: "A wider duo composition", aspect: "16:9", duration: 10, resolution: "720p", reason: "A landscape frame and a longer clip for a horizontal placement." },
  { purpose: "A longer vertical performance", aspect: "9:16", duration: 15, resolution: "720p", reason: "The longest available duration in a vertical frame; check the higher cost before submitting." },
];

export async function generateMetadata() { return localizeMetadata(geoMetadata(
  "Hotel Lobby AI Template — Parameters & Setup Guide (2026)",
  "Explore the built-in Hotel Lobby AI template: two photo references, orange studio staging, video sizes, duration, resolution, camera direction and original audio.",
  path,
)); }

export default async function HotelLobbyTemplatePage() {
  const t = await getTranslations();
  return localizePageContent(<div className="geo-page">
    <GeoHeader title="Hotel Lobby AI Template" intro="This template supplies the scene instructions for a two-photo duo performance: a warm orange studio, a hanging microphone and two performers sharing the frame. You choose the output settings without writing a prompt." />

    <GeoSection id="built-in-scene" title="What is built into the template?">
      <div className="geo-prose">
        <p>Choose from four stages: Hotel Lobby, Luxury lobby, Recording studio and Street cypher. The first photo is the left performer and the second is the right performer. Hotel Lobby uses the orange studio and hanging microphone; the other stages use Seedance to generate original AI rap.</p>
        <p>These are directions for a newly generated video. Identity, timing, expressions and the final composition can vary. The template does not reproduce a source performance frame for frame, and a requested detail is not a guarantee that every result will match it.</p>
      </div>
    </GeoSection>

    <GeoSection id="parameters" title="Which template parameters can I change?">
      <GeoTable caption="Controls available in the Hotel Lobby generator" headings={["Parameter", "Available settings", "What it changes"]} rows={[
        ["Photo references", "Two separate JPG, PNG or WebP images, up to 10 MB each", "The left and right performer references"],
        ["Aspect ratio", aspectRatios.join(", "), "The shape of the output frame"],
        ["Duration", videoDurations.map((duration) => `${duration} seconds`).join(", "), "The requested clip length and credit cost"],
        ["Resolution", videoResolutions.join(" or "), "The requested output resolution and credit cost"],
        ["Scene and staging", "Hotel Lobby, Luxury lobby, Recording studio, Street cypher", "Choose a stage; compatible model and sound settings update together"],
        ["Sound and motion", "Template references, your song, clip audio or AI rap", "Crop uploaded audio and video before generation"],
        ["Camera direction", "Template or uploaded motion reference", "No separate camera path, zoom or shot selector"],
      ]} />
      <p className="geo-note">{t("The default is Wan 3.0, 9:16, {seconds} seconds at 480p, costing {credits} credits with template motion.", { seconds: defaultVideoSettings.duration, credits: defaultCost })}</p>
    </GeoSection>

    <GeoSection id="suggested-configurations" title="Three configurations to consider">
      <GeoTable caption="Wan template configurations for different placements" headings={["Use case", "Configuration", "Cost", "Why choose it"]} rows={configurations.map((configuration) => [
        configuration.purpose,
        `${configuration.aspect} · ${configuration.duration} seconds · ${configuration.resolution}`,
        `${getVideoCost(configuration.duration, configuration.resolution, "wan-3.0")} credits`,
        configuration.reason,
      ])} />
      <div className="geo-prose">
        <p>These are recommended combinations of the existing controls, not named template variants. Pick the frame shape for the place you intend to use the clip. A longer duration costs more and requests a longer performance; it does not extend a previously completed video.</p>
        <p>Each new submission creates a new generation. Switching from 480p to 720p for the next attempt does not upscale an earlier result. See the <Link href="/hotel-lobby-ai-video-generator-free#credit-costs">complete credit table</Link> before choosing another configuration.</p>
      </div>
    </GeoSection>

    <GeoSection id="camera-and-photos" title="How should I prepare the two roles?">
      <ol className="geo-steps">
        <li><strong>Choose the left performer first.</strong> Add a clear, front-facing portrait to the first slot. Use one recognizable subject rather than a group photo.</li>
        <li><strong>Choose the right performer separately.</strong> Add the second portrait to its own slot. Similar lighting can make the references easier to compare; each image should show its subject clearly.</li>
        <li><strong>Choose the composition.</strong> Select a portrait, landscape or square frame. Choose template motion or upload and crop a reference video to guide movement. You can use its audio, a separate song or original AI rap with a compatible model.</li>
        <li><strong>Review the finished footage.</strong> Check both identities, framing and motion before downloading or sharing. Revise the input photos for a new attempt if the result does not meet your needs.</li>
      </ol>
    </GeoSection>

    <GeoSection id="audio" title="Does the template use the original Hotel Lobby song?">
      <div className="geo-prose">
        <p>The template soundtrack is a built-in audio reference, not a promise to include the original Hotel Lobby recording. Wan can follow this reference, your song or clip audio. Seedance instead creates original lyrics and music from an optional rap topic. Uploaded audio is a generation reference and is not guaranteed to be reproduced sample for sample.</p>
        <p>In Sound and motion, upload an audio file or a motion video, preview it and crop the segment before generating. There is no lyric editor or finished-video timeline editor. Listen to the result before sharing and use audio you have permission to publish.</p>
      </div>
    </GeoSection>

    <GeoSection id="reference-examples" title="Use the gallery as a visual reference">
      <div className="geo-prose">
        <p>The <Link href="/showcases">reference videos</Link> illustrate the orange-booth format. Their source generation parameters are not documented, so they should not be treated as samples of the configurations above or as guaranteed previews of your result.</p>
        <p>When ready, open the <Link href="/hotel-lobby-ai-video-generator#generator">Hotel Lobby AI Video Generator</Link>, sign in with Google and check the displayed credit cost. Generation and review time vary.</p>
      </div>
    </GeoSection>

    <GeoCta />
    <GeoRelatedLinks current={path} />
  </div>, t);
}
