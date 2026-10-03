import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import Link from "@/components/i18n/localized-link";
import { GeoCta, GeoHeader, GeoRelatedLinks, GeoSection, GeoTable, geoMetadata } from "@/components/geo/geo-page";
import { defaultVideoSettings, getVideoCost } from "@/lib/video-options";

const path = "/hotel-lobby-ai-generator";
const defaultCost = getVideoCost(defaultVideoSettings.duration, defaultVideoSettings.resolution, defaultVideoSettings.model);

export async function generateMetadata() { return localizeMetadata(geoMetadata(
  "Hotel Lobby AI Generator — Quick Start Guide (2026)",
  "Get started with the Hotel Lobby AI generator: sign in, assign two photo references, choose a format, check credits and track your generated duo video.",
  path,
)); }

export default async function HotelLobbyQuickStartPage() {
  const t = await getTranslations();
  return localizePageContent(<div className="geo-page">
    <GeoHeader title="Hotel Lobby AI Generator: Quick Start" intro="Have two photos ready? This guide takes you from choosing your first configuration to finding the finished video. The orange studio and duo performance instructions are already built in." />

    <GeoSection id="quick-start" title="Start with three decisions">
      <ol className="geo-steps">
        <li><strong>Assign the two performers.</strong> Open the <Link href="/hotel-lobby-ai-video-generator#generator">video generator</Link> and sign in with Google. Put a separate, clear portrait in each slot: Person 1 is the left reference and Person 2 is the right reference. Both files must be JPG, PNG or WebP and no larger than 10 MB each.</li>
        <li><strong>Choose where the clip will go.</strong> Choose one of four stages, then set the model, frame shape, duration and resolution. In Sound and motion, keep template references or crop your own audio and motion video. Seedance creates original AI rap from an optional topic.</li>
        <li><strong>Check the balance, then generate.</strong> {t("Compare the cost with your balance. The default Wan 3.0 template video is {seconds} seconds at 480p for {credits} credits; a 5-second template at 480p costs {shortCredits} credits.", { seconds: defaultVideoSettings.duration, credits: defaultCost, shortCredits: getVideoCost(5, "480p", "wan-3.0") })}</li>
      </ol>
    </GeoSection>

    <GeoSection id="choose-settings" title="Choose settings for your first attempt">
      <GeoTable caption="A short decision guide" headings={["Your priority", "Starting point", "Check before submitting"]} rows={[
        ["Use fewer credits", `5 seconds, 480p: ${getVideoCost(5, "480p", "wan-3.0")} credits`, "Wan template costs are shown here. Choose 5 seconds for a shorter first attempt."],
        ["Request higher resolution", `5 seconds, 720p: ${getVideoCost(5, "720p", "wan-3.0")} credits`, "Resolution is an output setting; the quality of both photo references still matters."],
        ["Request a longer performance", "10 or 15 seconds in the format you need", "Duration affects cost. Read the updated credit amount before generating."],
      ]} />
      <p className="geo-note">New accounts receive 50 welcome credits once, enough for one 5-second video at 480p. No subscription is required. Read the <Link href="/hotel-lobby-ai-video-generator-free">credit and allowance guide</Link> for the full cost matrix.</p>
    </GeoSection>

    <GeoSection id="after-submit" title="What happens after I press Generate?">
      <div className="geo-prose">
        <p>Apply any cropped reference segments first. The form uploads the photos and selected references, then displays the saved request’s progress. Photo review, video generation and the finished video’s review are separate stages. A progress percentage may pause while a stage runs, and completion time varies.</p>
        <p>Wait for the existing request instead of trying to submit it repeatedly. You can return to the generator or open <Link href="/app/my-videos">My Videos</Link> while signed into the same account. Once the result is ready and approved, use the playback controls to check it and the download link to save it.</p>
        <p>If the form reports an unsupported image, export it as JPG, PNG or WebP. If it reports insufficient credits, review the selected settings and balance. A failed or delayed request displays its own status; follow that message before making another attempt.</p>
      </div>
    </GeoSection>

    <GeoSection id="names" title="Looking for the same tool under another name?">
      <div className="geo-prose">
        <p>The phrases “hotel lobby generator”, “hotellobbyaigenerator” and the misspelling “hotel lobby ai generater” can all refer to the two-photo orange-booth workflow described here. They do not identify separate products, downloads or modes on this site.</p>
        <p>For the controls themselves, go to the <Link href="/hotel-lobby-ai-video-generator">Hotel Lobby AI Video Generator</Link>. For the scene, audio and camera details, read the <Link href="/hotel-lobby-ai-template">template guide</Link>.</p>
      </div>
    </GeoSection>

    <GeoCta />
    <GeoRelatedLinks current={path} />
  </div>, t);
}
