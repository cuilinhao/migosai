import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import { localizePageContent } from "@/components/sections/localized-page-content";
import Link from "@/components/i18n/localized-link";
import {
  GeoCta,
  GeoHeader,
  GeoRelatedLinks,
  GeoSection,
  GeoTable,
  JsonLd,
  geoMetadata,
} from "@/components/geo/geo-page";
import { HOTEL_LOBBY_PATH, SITE_URL } from "@/content/public-pages";
import { defaultVideoSettings, getVideoCost } from "@/lib/video-options";

const PAGE_PATH = "/blog/best-hotel-lobby-ai-video-generators-2026";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
const TITLE = "9 Hotel Lobby AI Video Generators Compared (2026)";
const DESCRIPTION = "Compare nine Hotel Lobby AI video tools by photos, prompts, credits and workflow. Official LobbyDuo blog; vendor information checked October 2, 2026.";
const REVIEWED_DATE = "2026-10-02";
const minimumCost = getVideoCost(5, "480p", "wan-3.0");
const defaultCost = getVideoCost(defaultVideoSettings.duration, defaultVideoSettings.resolution, defaultVideoSettings.model);

export async function generateMetadata() { return localizeMetadata(geoMetadata(
  "Best Hotel Lobby AI Video Generators: 9 Compared (2026) | LobbyDuo",
  DESCRIPTION,
  PAGE_PATH,
)); }

const competitors = [
  {
    id: "media-io",
    name: "Media.io",
    url: "https://www.media.io/ai/explore/zone/hotel-lobby-ai-video-trend",
    free: "The Hotel Lobby page does not specify a free allowance or price.",
    prompt: "Required in the published workflow",
    input: "Two separate photos; one subject per image",
    fit: "Creators who want to direct the scene with a prompt",
    paragraphs: [
      "Media.io describes a two-photo workflow for an orange-booth duo performance. Its guide emphasizes separate identities, fixed left and right positions, a hanging microphone and alternating gestures. Friends, couples and pets are among the suggested pairings. This is a useful starting point for someone who wants to describe the scene and adjust the performance through written instructions.",
      "The published workflow asks you to paste a prompt, so allow time for setup and review. It recommends well-lit, unobstructed faces with as much of the body visible as possible. The specialist page does not establish a free generation allowance, exact price or whether signing in is mandatory before generation.",
    ],
    extraSources: [],
  },
  {
    id: "lightx",
    name: "LightX",
    url: "https://www.lightxeditor.com/ai-video/image-to-video/hotel-lobby-ai-video/",
    free: "Platform free credits exist; eligibility for this template is unconfirmed.",
    prompt: "No, according to the template page",
    input: "One clear portrait; add a second for a duo",
    fit: "People who prefer choosing a template to writing a prompt",
    paragraphs: [
      "LightX presents Hotel Lobby as a template-based photo-to-video workflow: upload a portrait, choose the effect and generate. Its page explicitly says no text prompt is required and describes both solo and duo options, along with a longer performance version. For a two-person clip, add a second clear portrait. This suits someone who wants a guided starting point with fewer scene-writing decisions.",
      "LightX advertises platform-level free credits, but the pages reviewed do not confirm that those credits cover this particular template. Check the current generation quote and export conditions first. The specialist page also leaves the exact duration, resolution and mandatory sign-in step unspecified.",
    ],
    extraSources: [{ label: "LightX pricing", url: "https://www.lightxeditor.com/pricing/" }],
  },
  {
    id: "renoise",
    name: "Renoise",
    url: "https://renoise.ai/features/hotel-lobby-ai",
    free: "Follow its account for 20 credits: one default, watermarked, silent clip.",
    prompt: "No prompt needed",
    input: "Two portraits, or one photo containing both subjects",
    fit: "People trying a short clip or starting from a shared photo",
    paragraphs: [
      "Renoise generates a new orange-booth performance from two portraits or one photo containing both subjects. Its default is a four-second, 480p, vertical 9:16 clip costing 20 credits, with no prompt to write. The page offers 20 credits after following its account, making the published entry offer easy to understand. It also states that uploads are stored only after sign-in and generation.",
      "The free clip is watermarked and silent, so audio requires a separate step. Longer or sharper settings cost more. Renoise explicitly distinguishes this workflow from copying the original choreography: it generates new movements rather than preserving the source performance frame by frame.",
    ],
    extraSources: [],
  },
  {
    id: "dreamina",
    name: "Dreamina",
    url: "https://dreamina.capcut.com/ai-video/hotel-lobby-ai-video-trend",
    free: "A free entry point is advertised; this workflow’s free allowance is unspecified.",
    prompt: "Required in the published workflow",
    input: "Two separate, authorized reference photos",
    fit: "Creators who want to direct alternating actions and composition",
    paragraphs: [
      "Dreamina’s guide uses two separate reference photos and a complete prompt to generate an original orange-booth performance. The published instructions select Seedance 2.5 and a vertical 9:16 canvas, then define which subject leads and which reacts. That makes it a useful option for creators who want to direct composition and timing instead of relying entirely on a fixed template.",
      "Expect to write instructions and inspect identity consistency, hands, feet and side placement. Dreamina displays a free entry point and paid plans, but the reviewed page does not establish a free allowance for this specific workflow. Final pricing details require sign-in, so verify the quote before generating.",
    ],
    extraSources: [],
  },
  {
    id: "videotok",
    name: "VideoTok",
    url: "https://www.videotok.app/hotel-lobby-ai-video",
    free: "The guide is free to read; generation uses credits.",
    prompt: "Describe the intended replacements",
    input: "An authorized source video plus replacement reference photos",
    fit: "Editors who already have footage they may modify",
    paragraphs: [
      "VideoTok offers a guide to using its Swap Editor with your own authorized source footage. Sign in, choose a workspace, upload the video, add replacement references and describe which subject each reference should replace. This approach can suit someone who already has a scene and wants to work from it instead of generating an entirely new orange-booth performance.",
      "It is not a preloaded Hotel Lobby template, and the guide says a reliable one-click two-person preset has not been verified. Original performance footage and music are not included. Reading is free, but generation consumes credits; input limits, pricing and processing time depend on the selected editor settings.",
    ],
    extraSources: [],
  },
  {
    id: "mitte",
    name: "Mitte",
    url: "https://mitte.ai/app/hotel-lobby-character-swap",
    free: "Paid: the page requires at least the Creative plan.",
    prompt: "Optional appearance instructions",
    input: "Two photos, one for each performer",
    fit: "People seeking a fixed performance-swap workflow",
    paragraphs: [
      "Mitte’s Hotel Lobby Character Swap page describes a 30-second two-person replacement that retains the original room, choreography and audio. You supply one photo for each side; optional text changes clothing, hair or accessories. Clear, forward-facing, waist-up or full-body references help communicate both identity and outfit. This is a focused choice when preserving the source performance is the intended workflow.",
      "The page requires at least the Creative plan, listed at $36 per month when checked. It does not allow changing the room, song or moves within this app. Its claim that original audio is included is not itself evidence that users receive permission to publish that music.",
    ],
    extraSources: [{ label: "Mitte pricing", url: "https://mitte.ai/pricing" }],
  },
  {
    id: "aireel",
    name: "AIReel",
    url: "https://www.aireel.net/ai-effects/hotel-lobby-ai",
    free: "Paid credit-based effect; the quote appears before generation.",
    prompt: "Preset workflow; no complex prompt described",
    input: "Two separate, well-lit, front-facing photos",
    fit: "Creators who want a preset duo scene, including pet pairings",
    paragraphs: [
      "AIReel provides a preset Hotel Lobby scene with the orange booth, hanging microphone and two-person framing already prepared. Its instructions ask for one well-lit, front-facing image per performer, then generation and review. The page supports people, characters and pets, and describes using different photos of the same person in both roles. That gives creators several casting options without building the scene themselves.",
      "This particular effect is paid and consumes credits; the required amount appears before generation. Audio depends on the template version, while watermark-free export depends on the plan and settings. The page does not promise a fixed completion time, so check the generator rather than assuming an instant result.",
    ],
    extraSources: [],
  },
  {
    id: "summrs",
    name: "Summrs",
    url: "https://www.summrs.com/migos-hotel-lobby-ai-video",
    free: "50 signup credits; whether they cover this template is unspecified.",
    prompt: "The template tutorial does not require a written prompt",
    input: "One clear photo showing the face and upper body",
    fit: "People choosing between standard and extended template versions",
    paragraphs: [
      "Summrs presents standard and extended Hotel Lobby templates, with a one-photo workflow that handles face placement and lighting matching. Its tutorial recommends a clear, evenly lit photo showing your face and upper body, either front-facing or at a slight angle. This can suit someone who wants to select a performance version and supply a reference rather than prepare source footage.",
      "New signups receive 50 credits without a credit card, but the reviewed pages do not state the exact Hotel Lobby template cost. Do not assume the allowance guarantees a finished free video. The tutorial describes processing in minutes, but we have not benchmarked its speed or output quality.",
    ],
    extraSources: [{ label: "Summrs Hotel Lobby tutorial", url: "https://www.summrs.com/blog/how-to-make-migos-hotel-lobby-ai-video" }],
  },
];

const listedTools = [
  { name: "LobbyDuo", url: `${SITE_URL}${HOTEL_LOBBY_PATH}` },
  ...competitors.map(({ name, url }) => ({ name, url })),
];

const articleSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${PAGE_URL}#article`,
      headline: TITLE,
      description: DESCRIPTION,
      url: PAGE_URL,
      mainEntityOfPage: PAGE_URL,
      datePublished: REVIEWED_DATE,
      dateModified: REVIEWED_DATE,
      inLanguage: "en",
      author: { "@type": "Organization", name: "LobbyDuo editorial team", url: SITE_URL },
      publisher: { "@type": "Organization", name: "LobbyDuo", url: SITE_URL },
      about: { "@id": `${PAGE_URL}#tools` },
      citation: competitors.flatMap(({ url, extraSources }) => [url, ...extraSources.map((source) => source.url)]),
    },
    {
      "@type": "ItemList",
      "@id": `${PAGE_URL}#tools`,
      name: TITLE,
      numberOfItems: listedTools.length,
      itemListOrder: "https://schema.org/ItemListUnordered",
      itemListElement: listedTools.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.name,
        url: tool.url,
      })),
    },
  ],
};

export default async function HotelLobbyComparisonPage() {
  const t = await getTranslations();
  return localizePageContent((
    <article className="geo-page">
      <JsonLd data={articleSchema} />
      <GeoHeader
        title={TITLE}
        label="OFFICIAL LOBBYDUO BLOG · TOOL COMPARISON"
        intro="This is the official LobbyDuo blog. Compare nine Hotel Lobby AI video tools by their published workflow, photo requirements, prompts and credit conditions."
      >
        <p><strong>Disclosure:</strong> We build LobbyDuo and place it first as our editorial choice for a built-in two-photo workflow. This order is not an independent quality ranking. We have not run a standardized generation test across these tools and do not assign numerical scores.</p>
        <p className="geo-note">By LobbyDuo editorial team · Official product pages checked <time dateTime={REVIEWED_DATE}>October 2, 2026</time>. Prices, models and trial conditions can change.</p>
      </GeoHeader>

      <GeoSection id="comparison-table" title="Compare the inputs, prompts and free conditions">
        <GeoTable
          caption="Nine tools: published conditions checked October 2, 2026; this is not a tested performance ranking."
          headings={["Tool", "Free conditions / credits", "Prompt", "Input", "Who it may suit"]}
          rows={[
            [
              <a href="#migos-ai" key="migos-ai">LobbyDuo — our tool</a>,
              t("No free signup credits. Purchase a credit pack to generate. A 5-second Wan template costs {credits} credits.", { credits: minimumCost }),
              "Built-in scenes; optional AI rap topic",
              "Two separate photos, one for each side",
              "People seeking selectable stages, music and motion references",
            ],
            ...competitors.map((tool) => [
              <a key={tool.id} href={`#${tool.id}`}>{tool.name}</a>,
              tool.free,
              tool.prompt,
              tool.input,
              tool.fit,
            ]),
          ]}
        />
        <p className="geo-note">“Unspecified” means the reviewed pages did not establish that condition. Platform free credits do not necessarily cover a Hotel Lobby video. Follow each product’s source link below and check the quote before generating.</p>
      </GeoSection>

      <GeoSection id="migos-ai" title="1. LobbyDuo: a built-in two-photo Hotel Lobby workflow">
        <div className="geo-prose">
          <p>Our <Link href={HOTEL_LOBBY_PATH}>Hotel Lobby AI Video Generator</Link> combines two photo references with a selectable stage, model, sound and motion. Choose Hotel Lobby, Luxury lobby, Recording studio or Street cypher. Wan can follow template audio, your song or clip audio; Seedance creates original AI rap from an optional topic. Crop and apply uploaded reference segments before submitting.</p>
          <p>Choose vertical, landscape or square framing, preset durations of 5, 8, 10, 12 or 15 seconds, and resolutions supported by the selected model. Your own motion reference can determine a shorter duration. Movement, identity and audio can vary: reference media guides generation without guaranteeing exact frames or audio samples.</p>
          <h3>Understand the credits before uploading</h3>
          <p><strong>Registration does not include free credits. Purchase a credit pack before generating.</strong> {t("A 5-second Wan template at 480p costs {shortCredits} credits. The default Wan template is {seconds} seconds at 480p for {credits} credits. Model and reference duration also affect cost.", { shortCredits: minimumCost, seconds: defaultVideoSettings.duration, credits: defaultCost })} Sign in with Google and review <Link href="/pricing">current credit packs</Link> before deciding whether to generate.</p>
        </div>
        <div id="migosai-workflow" className="geo-prose">
          <h3>How to make a Hotel Lobby AI video on LobbyDuo</h3>
          <ol className="geo-steps">
            <li><strong>Open the generator and prepare two photos.</strong> Visit the <Link href={`${HOTEL_LOBBY_PATH}#generator`}>Hotel Lobby generator</Link>. Use a clear, front-facing photo of each participant, with one visible face per image and permission to animate it. JPG, PNG and WebP are accepted, up to 10 MB each. If both people are in one picture, prepare two separate crops first.</li>
            <li><strong>Assign the left and right performers.</strong> Add Person 1 to the left upload slot and Person 2 to the right. Check the previews for the correct identity and clear framing. Similar lighting helps the references work together. Half-body or full-body images are useful when the face remains large enough to recognize.</li>
            <li><strong>Choose the format and check the cost.</strong> Start with 9:16 for a vertical social clip. Select a stage, model, sound and motion reference. A 5-second Wan template at 480p uses {minimumCost} credits. The cost and remaining balance appear below the generation controls, so review them after changing settings.</li>
            <li><strong>Sign in and generate.</strong> Use Google sign-in and make sure the account balance covers the displayed cost. Click Generate Video, then follow the upload, review and generation status. Completion time depends on processing and the service queue. Avoid submitting another copy while the current job is still running.</li>
            <li><strong>Preview, inspect and download.</strong> Once the result is completed and approved, watch the full clip. Check both identities, hands, side placement and motion before downloading. You can also revisit completed results in <Link href="/app/my-videos">My Videos</Link>. Select your soundtrack before generation; use a separate editor for later timeline changes and audio you have permission to publish.</li>
          </ol>
        </div>
        <div className="geo-screenshots" aria-label="LobbyDuo upload and settings interface">
          <figure>
            <img
              src="/images/geo/generator-upload.png"
              alt="LobbyDuo upload interface with empty photo slots, Hotel Lobby, Wan 3.0, 9:16, 5 seconds, 720p and a 60-credit cost. The video is a reference preview, not a generated result."
              width={1280}
              height={1430}
              loading="lazy"
            />
            <figcaption>Hotel Lobby with Wan 3.0: 9:16, 5 seconds, 720p and a 60-credit cost. Template motion and soundtrack are selected. Both photo slots are empty; “Sign In to Generate Video” and 0 remaining credits show the signed-out state. The video is a reference preview, not a generated result.</figcaption>
          </figure>
          <figure>
            <img
              src="/images/geo/generator-settings.png"
              alt="LobbyDuo settings interface with empty photo slots, Hotel Lobby, Wan 3.0, 9:16, 10 seconds, 480p and a 60-credit cost. The video is a reference preview, not a generated result."
              width={1280}
              height={1430}
              loading="lazy"
            />
            <figcaption>Hotel Lobby with Wan 3.0: 9:16, 10 seconds, 480p and a 60-credit cost. Template motion and soundtrack are selected. Both photo slots are empty; “Sign In to Generate Video” and 0 remaining credits show the signed-out state. The video is a reference preview, not a generated result.</figcaption>
          </figure>
        </div>
        <div className="geo-prose">
          <h3>Where this workflow fits—and its limits</h3>
          <p>The workflow combines two photo slots with four stages, model settings and sound and motion references. Uploaded references are cropped in the browser before transfer. There is no separate camera-path, lyric or finished-video editor, and reference guidance does not guarantee exact reproduction. Compare the source-video and prompt-based options below for other approaches.</p>
          <p>Our <Link href="/showcases">reference gallery</Link> explains the visual format; it is not a record of standardized tests from this tool. For photo preparation and further details, read the <Link href={`${HOTEL_LOBBY_PATH}#photo-requirements`}>photo requirements</Link> and <Link href={HOTEL_LOBBY_PATH}>Hotel Lobby guide</Link>.</p>
          <p><Link className="pill-gradient-button" href={`${HOTEL_LOBBY_PATH}#generator`}>Open the Hotel Lobby AI Video Generator</Link></p>
        </div>
      </GeoSection>

      <GeoSection id="other-tools" title="Eight other Hotel Lobby tools and workflows">
        <p>These summaries describe each vendor’s published offering, including its stated limits. They are not hands-on output reviews. The order follows our comparison list rather than a measured quality score.</p>
        {competitors.map((tool, index) => (
          <section className="geo-tool" id={tool.id} key={tool.id} aria-labelledby={`${tool.id}-title`}>
            <h3 id={`${tool.id}-title`}>{index + 2}. {tool.name}</h3>
            <div className="geo-prose">{tool.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            <p className="geo-note">Official source: <a href={tool.url}>{tool.name} Hotel Lobby page</a>{tool.extraSources.map((source) => <span key={source.url}> · <a href={source.url}>{source.label}</a></span>)}. Checked October 2, 2026.</p>
          </section>
        ))}
      </GeoSection>

      <GeoSection id="choose-a-workflow" title="Which workflow should you choose?">
        <div className="geo-prose">
          <p>Start with the input you already have. Two separate portraits work with LobbyDuo and several dedicated templates. Renoise also describes accepting a shared photo. VideoTok asks for source footage as well as replacement references. Mitte describes a fixed performance swap, while Media.io and Dreamina give you more scene direction through written prompts.</p>
          <p>Next, separate the cost of trying the interface from the cost of producing a video. A signup reward, a free guide or a free button does not establish a free export. Check the required credits, watermark conditions, audio and account requirements before submitting. If exact timing or choreography matters, verify whether the tool generates new movement or works from existing footage.</p>
          <p>For the visual reference, see <a href="https://www.youtube.com/watch?v=x9yop0nYR9g">COLORS’ official Quavo &amp; Takeoff performance</a>, published June 17, 2022. That date belongs to the original performance; this article does not claim a verified start date for the AI trend. LobbyDuo is independent and is not affiliated with the artists or COLORS.</p>
        </div>
      </GeoSection>
      <GeoCta />
      <GeoRelatedLinks current={PAGE_PATH} />
    </article>
  ), t);
}
