import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import Link from "@/components/i18n/localized-link";
import { GeoCta, GeoHeader, GeoRelatedLinks, GeoSection, GeoTable, geoMetadata } from "@/components/geo/geo-page";
import { defaultVideoSettings, getVideoCost, videoDurations } from "@/lib/video-options";

const path = "/hotel-lobby-ai-video-generator-free";
const minimumCost = getVideoCost(5, "480p", "wan-3.0");
const defaultCost = getVideoCost(defaultVideoSettings.duration, defaultVideoSettings.resolution, defaultVideoSettings.model);

export async function generateMetadata() {
  const t = await getTranslations();
  return localizeMetadata(geoMetadata(
    "Free Hotel Lobby AI Video Generator? Credits & Limits (2026)",
    t("Is Hotel Lobby AI video generation free? Registration includes no free credits. Review paid credit packs, five-second Wan template costs of {credits} credits, sign-in requirements and watermark details.", { credits: minimumCost }),
    path,
  ));
}

export default async function FreeHotelLobbyGuidePage() {
  const t = await getTranslations();
  return localizePageContent(<div className="geo-page">
    <GeoHeader title="Free Hotel Lobby AI Video Generator? Check the Credits First" intro="LobbyDuo requires purchased credits for every video. Registration does not include free credits. You can browse the guides and reference videos for free." />

    <GeoSection id="free-video" title="Can I generate a Hotel Lobby video for free here?">
      <div className="geo-prose">
        <p>{t("No. Registration does not include free credits. Purchase a credit pack before generating. A five-second Wan template video requires {credits} credits. Viewing the public generator, guides and reference clips does not spend generation credits.", { credits: minimumCost })}</p>
        <p>Before submitting, the <Link href="/hotel-lobby-ai-video-generator#generator">Hotel Lobby AI Video Generator</Link> displays both the selected video cost and your remaining balance. You need enough credits for that configuration.</p>
      </div>
    </GeoSection>

    <GeoSection id="credit-costs" title="How many credits does each video cost?">
      <GeoTable caption="Wan template credits by duration and resolution" headings={["Video duration", "480p", "720p"]} rows={videoDurations.map((duration) => [
        `${duration} seconds`,
        `${getVideoCost(duration, "480p", "wan-3.0")} credits`,
        `${getVideoCost(duration, "720p", "wan-3.0")} credits`,
      ])} />
      <div className="geo-prose">
        <p>{t("These are Wan template costs. The default is {seconds} seconds at 480p for {credits} credits. Model, resolution, output duration and reference-video duration affect cost; aspect ratio does not. A 5-second template at 480p costs {shortCredits} credits.", { seconds: defaultVideoSettings.duration, credits: defaultCost, shortCredits: minimumCost })}</p>
        <p>Credit packs are listed on the <Link href="/pricing">pricing page</Link>. Check the pack, current checkout availability and the generator’s cost before proceeding. The number of videos a balance covers depends on the options you choose.</p>
      </div>
    </GeoSection>

    <GeoSection id="signup" title="Can I use it without signing up?">
      <div className="geo-prose">
        <p>You can read the guides and watch reference clips without an account. Uploading photos to the service and submitting a video require Google sign-in. The same Google sign-in flow creates a new account when needed.</p>
        <p>Selecting photos in the browser does not bypass that requirement. If you are signed out, the generation button opens sign-in. A claim such as “no signup required” would not describe this video workflow.</p>
      </div>
    </GeoSection>

    <GeoSection id="daily-limit" title="Is there a daily free allowance?">
      <div className="geo-prose">
        <p>No. Registration does not include free credits, and there is no daily free-video allowance. Generation uses your available balance, and the form waits for your current video request to finish before accepting another.</p>
        <p>There is no advertised daily reset that makes a paid video free. Keep an eye on the displayed balance and the selected cost instead of planning around a number of free daily attempts.</p>
      </div>
    </GeoSection>

    <GeoSection id="watermark" title="Will the downloaded video have a watermark?">
      <div className="geo-prose">
        <p>LobbyDuo does not add its own watermark to the generated video. That does not guarantee that the images you upload or the generation provider’s output contain no visible marks, text or logos.</p>
        <p>There is no separate free-watermarked versus paid-unwatermarked export setting in this generator. Review the finished video before sharing it, including any marks already present in your reference photos.</p>
      </div>
    </GeoSection>

    <GeoSection id="time-and-preview" title="Can I preview a finished result before spending credits?">
      <div className="geo-prose">
        <p>The public <Link href="/showcases">reference gallery</Link> shows the visual format, but it is not a personalized preview of your photos. A submitted generation reserves its required credits. Preview and download become available after that video finishes and passes its review.</p>
        <p>Completion time varies with photo review, generation and video review. Neither the free-to-view reference clips nor the selected clip duration indicate how quickly your request will finish.</p>
      </div>
    </GeoSection>

    <GeoCta />
    <GeoRelatedLinks current={path} />
  </div>, t);
}
