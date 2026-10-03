import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import Link from "@/components/i18n/localized-link";
import {
  GeoCta,
  GeoHeader,
  GeoRelatedLinks,
  GeoSection,
  GeoTable,
  geoMetadata,
} from "@/components/geo/geo-page";
import { defaultVideoSettings, getVideoCost } from "@/lib/video-options";
import { HOTEL_LOBBY_PATH } from "@/content/public-pages";

const PAGE_PATH = "/hotel-lobby-ai-filter";
const title = "Hotel Lobby AI Filter & Face Swap (2026) | Migos AI";
const description = "Compare Hotel Lobby filters, face swaps and two-photo AI video generation. Follow the mobile browser steps, photo requirements and HEIC conversion guidance.";

export async function generateMetadata() { return localizeMetadata(geoMetadata(title, description, PAGE_PATH)); }

export default async function HotelLobbyFilterPage() {
  const t = await getTranslations();
  return localizePageContent(<div className="geo-page">
    <GeoHeader
      title="Hotel Lobby AI Filter & Face Swap (2026)"
      intro="Looking for a Hotel Lobby AI filter on your phone? Migos AI generates a new duo video from two separate reference photos. Here is how that differs from a filter or face swap, and how to use the generator in a mobile browser."
    >
      <p className="geo-note">Use the website directly. Migos AI has no separate native app to install. Google sign-in and sufficient credits are required to generate.</p>
    </GeoHeader>

    <GeoSection id="filter-vs-face-swap" title="Hotel Lobby filter, face swap or AI video generator?">
      <div className="geo-prose">
        <p>These terms describe different editing workflows. A filter changes the look of a photo or video. A face swap replaces a face in an existing image or clip. A two-photo video generator uses reference images to create a new moving scene. Knowing which workflow you want helps you prepare the right input.</p>
      </div>
      <GeoTable
        caption="Three ways to approach the Hotel Lobby look"
        headings={["Workflow", "Typical input", "What changes", "Available in Migos AI?"]}
        rows={[
          ["Photo or video filter", "An existing photo, clip or camera feed", "Applies a visual effect, such as a color treatment or overlay; capabilities depend on the filter", "No selectable filter library or live camera filter"],
          ["Face swap", "A source face and an existing target image or video", "Replaces a face within the target scene", "Motion-reference video upload is available; there is no dedicated face-swap editor"],
          ["Two-photo AI video generation", "One separate reference photo for each of two performers", "Generates a new duo performance with an orange booth and hanging microphone", "Yes: this is the current Hotel Lobby workflow"],
        ]}
      />
      <div className="geo-prose">
        <p>The <Link href={HOTEL_LOBBY_PATH}>Hotel Lobby AI Video Generator</Link> supplies scene instructions for four stages. Choose a model, duration, aspect ratio and resolution, then select template or uploaded sound and motion references. Seedance can generate original AI rap from an optional topic.</p>
        <p>Because the footage is newly generated, it can reinterpret faces, clothing, poses and movement. It does not insert your faces into a fixed copy of an existing performance. If you need to preserve every frame of a target video, that is a different workflow from the one offered here.</p>
      </div>
    </GeoSection>

    <GeoSection id="mobile-browser-steps" title="How to make a Hotel Lobby AI video in a mobile browser">
      <div className="geo-prose">
        <p>Prepare both photos on your device, then open the generator in your mobile browser. The website is the place to upload, choose settings and follow your job; there is no app installation step.</p>
      </div>
      <ol className="geo-steps">
        <li><h3>Open the generator and sign in with Google</h3><p>Visit the <Link href={`${HOTEL_LOBBY_PATH}#generator`}>Hotel Lobby generator form</Link>. If you are signed out, tap “Sign In to Generate Video” and complete Google sign-in. Return to the form and check the account balance before starting.</p></li>
        <li><h3>Choose the first performer’s photo</h3><p>Tap “Choose photo” in the “Person 1” slot, labeled “Left performer,” and select an image from your device. Use one clear, front-facing person in the photo and check the preview after selecting it.</p></li>
        <li><h3>Add the second photo in its own slot</h3><p>Repeat the process in “Person 2,” labeled “Right performer.” The form needs two independent image selections. A single group photo in one slot does not fill both slots. Each file must be JPG, PNG or WebP and no larger than 10 MB.</p></li>
        <li><h3>Set the duration, shape and resolution</h3><p>Choose a model, one of four stages and a frame shape, including square or vertical. Preset durations are 5, 8, 10, 12 and 15 seconds, and resolution depends on the model. In Sound and motion, crop your own song or motion reference and apply the segment before generating.</p></li>
        <li><h3>Check the credit cost and generate</h3><p>{t("Check the displayed cost and balance. The default Wan 3.0 template is {seconds} seconds at 480p for {credits} credits; a 5-second template costs {shortCredits} credits. New accounts receive 50 welcome credits once. Model and reference duration also affect cost.", { seconds: defaultVideoSettings.duration, credits: getVideoCost(defaultVideoSettings.duration, defaultVideoSettings.resolution, defaultVideoSettings.model), shortCredits: getVideoCost(5, "480p", "wan-3.0") })} Review <Link href="/pricing">pricing</Link> if your balance is too low, then tap “Generate Video” when ready.</p></li>
        <li><h3>Follow the upload and generation status</h3><p>Let both uploads finish and check the status shown by the form. Photos are reviewed, the video is generated, and the output goes through review before delivery. Completion time varies. A progress percentage can pause while a stage runs and is not a countdown in seconds.</p></li>
        <li><h3>Preview the completed clip and download it</h3><p>Preview and download become available only after generation completes and the video passes review. Watch the result before saving or sharing it. Tap “Download video” when it appears; how the file opens or is saved depends on your browser and device.</p></li>
      </ol>
      <p className="geo-note">A five-second Wan template video at 480p is a lower-cost starting point. Your own short motion clip can have a different quote. Review the displayed cost; any setting can produce variations in the final result.</p>
    </GeoSection>

    <GeoSection id="heic-and-photo-format" title="Can I upload HEIC photos from my phone?">
      <div className="geo-prose">
        <p>HEIC is not an accepted upload format. The supported formats are JPG (JPEG), PNG and WebP, with a 10 MB limit for each image. If a photo on your device is HEIC, export a JPEG or PNG copy with a device image editor or conversion tool before selecting it in the generator.</p>
        <p>Check the exported file’s format and size, then select that copy in the correct performer slot. Changing a filename from “photo.heic” to “photo.jpg” does not convert the image and will not make it a valid JPEG.</p>
        <p>If the exported image is over 10 MB, use your image tool to reduce its dimensions or file size while keeping the face clear. A supported file format allows the upload to proceed; it does not ensure that the source photo will produce a faithful animation.</p>
      </div>
    </GeoSection>

    <GeoSection id="mobile-troubleshooting" title="If a mobile upload or generation does not continue">
      <GeoTable
        caption="Checks for the current browser workflow"
        headings={["What you see", "What to check"]}
        rows={[
          ["A photo format error", "Select a valid JPG, PNG or WebP file. Export HEIC to an accepted format first; renaming the extension is not conversion."],
          ["A file-size error", "Check each image separately. Both files must be 10 MB or smaller before you select them."],
          ["Only one performer has a preview", "Select the second image in its own slot. Both Person 1 and Person 2 need a photo."],
          ["A request to sign in", "Complete Google sign-in, then return to the generator and check that your account is loaded."],
          ["Not enough credits", "Compare the displayed cost with your balance. Duration and resolution affect the cost. Choose settings within your remaining balance or purchase more credits."],
          ["Progress pauses or the video is in review", "Read the current status. Some stages take longer than others; a video is unavailable until generation and review are complete."],
          ["A failure message", "Follow the message shown in the form. Check your selected photos and settings before deciding whether to submit another job."],
        ]}
      />
    </GeoSection>

    <GeoSection id="expectations" title="What to expect from the finished Hotel Lobby clip">
      <div className="geo-prose">
        <p>The built-in scene aims for a coordinated duo in an orange studio booth with a suspended microphone. Clear reference photos can make the intended subjects easier to interpret, but identity, movement and framing can vary between outputs. Review both performers throughout the finished video before sharing it.</p>
        <p>Use the <Link href="/showcases">reference video gallery</Link> to understand the visual style. Those clips are reference material, not documented results from this generator, and their original input settings are not supplied. For the full feature overview and the working form, visit the <Link href={HOTEL_LOBBY_PATH}>Hotel Lobby AI Video Generator</Link>.</p>
      </div>
    </GeoSection>

    <GeoCta />
    <GeoRelatedLinks current={PAGE_PATH} />
  </div>, t);
}
