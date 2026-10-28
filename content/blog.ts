import { SITE_URL } from "./public-pages";

// English source copy for the blog. Every visible string is a translation key in
// lib/i18n/messages/blog-<locale>.json. Inline markup: **bold** and [label](/path or https://url).
// {shortCredits} is replaced with the current 5-second 480p Wan template cost.

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "note"; text: string }
  | { type: "h3"; text: string }
  | { type: "code"; label: string; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; caption: string; headings: string[]; rows: string[][] };

export type BlogSection = { id: string; title: string; blocks: BlogBlock[] };
export type BlogFaq = { question: string; answer: string };
export type BlogSource = { label: string; url: string };

export type BlogPost = {
  slug: string;
  path: string;
  /** H1 and schema headline. */
  title: string;
  /** Document title; dated like the other guides. */
  metaTitle: string;
  description: string;
  /** Short label used in the sitemap list, footer-style links and cards. */
  label: string;
  excerpt: string;
  eyebrow: string;
  datePublished: string;
  dateModified: string;
  intro: string;
  sections: BlogSection[];
  faqs: BlogFaq[];
  sources: BlogSource[];
};

export const BLOG_PATH = "/blog";
export const BLOG_UPDATED = "2026-10-28";
export const COMPARISON_PATH = "/blog/best-hotel-lobby-ai-video-generators-2026";

export const blogIndexCopy = {
  metaTitle: "LobbyDuo Blog: Hotel Lobby AI Guides and Trend Explainers (2026)",
  description: "Guides to the viral Hotel Lobby AI video trend from LobbyDuo (migosai.design): what it is, the song it uses, pet versions, fixes for bad results and tool comparisons.",
  eyebrow: "LOBBYDUO BLOG",
  title: "Hotel Lobby AI guides and trend explainers",
  intro: "Everything about the viral orange-booth duo trend: where it comes from, which song it uses, how to make one with friends or pets, and how to fix a result that looks wrong. Written by the team behind LobbyDuo, the two-photo Hotel Lobby AI video generator at migosai.design.",
  latest: "Latest articles",
  comparisonTitle: "9 Hotel Lobby AI Video Generators Compared (2026)",
  comparisonExcerpt: "Nine Hotel Lobby AI video tools compared by photo requirements, prompts, credits and workflow. Authorship is disclosed; this is not an independent quality ranking.",
  comparisonEyebrow: "TOOL COMPARISON",
};

export const blogUiCopy = {
  home: "Home",
  blog: "Blog",
  breadcrumb: "Breadcrumb",
  readArticle: "Read article",
  published: "Published {date}",
  byline: "By the LobbyDuo editorial team · Published {date}",
  faqTitle: "Frequently asked questions",
  sourcesTitle: "Sources",
  moreTitle: "More from the LobbyDuo blog",
  allArticles: "All articles",
  articleList: "Blog articles",
};

const whatIs: BlogPost = {
  slug: "what-is-hotel-lobby-ai-video",
  path: "/blog/what-is-hotel-lobby-ai-video",
  title: "What Is a Hotel Lobby AI Video? The Viral Orange Booth Trend Explained",
  metaTitle: "What Is a Hotel Lobby AI Video? The Viral Trend Explained (2026)",
  description: "A Hotel Lobby AI video puts any two people, pets or characters into Quavo and Takeoff's orange-booth \"Hotel Lobby\" performance. Learn where it comes from, why it went viral and how to make one.",
  label: "What Is a Hotel Lobby AI Video?",
  excerpt: "The orange booth, the hanging mic and the two-performer format explained: where the trend comes from, why it went viral and how to make your own.",
  eyebrow: "HOTEL LOBBY AI · TREND EXPLAINED",
  datePublished: "2026-10-04",
  dateModified: "2026-10-04",
  intro: "A **Hotel Lobby AI video** is a short AI-generated clip that puts any two people, pets or characters into Quavo and Takeoff's famous \"Hotel Lobby\" performance. The two performers stand side by side in an orange booth, share one hanging microphone and trade rap verses like a real duo.",
  sections: [
    {
      id: "short-answer",
      title: "The short answer",
      blocks: [
        { type: "p", text: "The format went viral on TikTok and X in September 2026. Most people make one by uploading two photos to an AI video generator such as [LobbyDuo (migosai.design)](/hotel-lobby-ai-video-generator), then posting the result with the \"Hotel Lobby\" sound." },
        { type: "p", text: "Despite the name, nothing in the video happens in a hotel lobby: \"Hotel Lobby\" is the title of the song." },
      ],
    },
    {
      id: "origin",
      title: "Where it comes from",
      blocks: [
        { type: "p", text: "Every Hotel Lobby AI video copies the look of one real performance: **Quavo and Takeoff performing \"HOTEL LOBBY (Unc & Phew)\" on A COLORS SHOW**, released on June 17, 2022." },
        { type: "ul", items: [
          "**The artists:** Quavo and his nephew Takeoff, two members of Migos, recording as the duo Unc & Phew. Offset is not on the track.",
          "**The song:** \"Hotel Lobby\" first came out as a single on May 20, 2022. It peaked at No. 55 on the US Billboard Hot 100 and is certified Platinum in the US.",
          "**The set:** COLORS is a music series known for filming each artist in front of a single-color backdrop. For this session, the backdrop was orange, with one microphone hanging between the two rappers.",
        ] },
        { type: "p", text: "The official music video for the song looks nothing like this. It is a desert road trip inspired by the film Fear and Loathing in Las Vegas. The trend is built only on the COLORS version." },
        { type: "p", text: "Takeoff died in November 2022, a few months after the performance. That gives the clip extra weight for fans, and it shapes how many people react to the AI trend." },
      ],
    },
    {
      id: "how-it-started",
      title: "How the AI trend started",
      blocks: [
        { type: "p", text: "The AI version appeared four years after the original performance. Know Your Meme traces an early viral post to September 16, 2026, when a TikTok creator replaced Quavo and Takeoff with two characters from the TV series Suits. It passed 1.7 million views within two weeks." },
        { type: "table", caption: "Hotel Lobby trend timeline", headings: ["When", "What happened"], rows: [
          ["May 20, 2022", "\"Hotel Lobby\" is released as Unc & Phew's debut single"],
          ["June 17, 2022", "The A COLORS SHOW performance is released"],
          ["November 2022", "Takeoff dies"],
          ["September 16, 2026", "An AI edit swapping in two Suits characters goes viral on TikTok"],
          ["Mid to late September 2026", "Creators put celebrities, cartoon characters, couples, grandparents and pets into the booth; the format spreads across TikTok and X"],
          ["Late September 2026", "Quavo reshares the original COLORS performance; music outlets such as Complex cover the trend"],
        ] },
        { type: "p", text: "AI video apps quickly added ready-made \"Hotel Lobby\" templates, so anyone with two photos could join in. That helps explain why so many versions now feature everyday duos: friends, couples, families and pets." },
      ],
    },
    {
      id: "what-it-looks-like",
      title: "What a Hotel Lobby AI video looks like",
      blocks: [
        { type: "p", text: "You can spot one in under a second. Almost every version keeps the same five elements." },
        { type: "table", caption: "The five signature elements", headings: ["Element", "What it looks like", "Why it matters"], rows: [
          ["Orange booth", "A seamless, saturated orange backdrop and floor", "The strongest signal that a clip belongs to the trend"],
          ["Hanging microphone", "One mic suspended on a cable between the performers", "Makes it read as a duet, not two separate clips"],
          ["Two performers side by side", "One on the left, one on the right, both in frame the whole time", "The pairing is the joke"],
          ["Trading verses", "One raps while the other reacts, then they switch", "Creates the back-and-forth that sells the illusion"],
          ["Fixed camera, short runtime", "A front-on shot, usually around 5 to 15 seconds, vertical for TikTok and Reels", "Easy to loop and rewatch"],
        ] },
        { type: "p", text: "The audio is the sixth ingredient. Most creators post their clip with the \"Hotel Lobby\" sound from the TikTok or Instagram music library. See [what song is in the Hotel Lobby AI trend](/blog/hotel-lobby-ai-trend-song) for how to add it." },
      ],
    },
    {
      id: "why-viral",
      title: "Why it went viral",
      blocks: [
        { type: "ul", items: [
          "**It reads instantly.** The orange booth is so distinctive that viewers recognize the format even with the sound off.",
          "**The contrast is the punchline.** Grandma and grandson, a boxer and a kangaroo, two cats: the more unlikely the pair, the funnier the \"rap duo\".",
          "**It takes two photos.** No filming, no dancing, no editing skills. Templates removed almost every barrier to joining.",
          "**It is personal.** Putting your best friend, partner or pet in the booth makes the clip worth sending to people you know.",
          "**The original still matters.** Quavo and Takeoff's chemistry gives the format a real performance to riff on, and the trend has sent many viewers back to the 2022 clip.",
        ] },
      ],
    },
    {
      id: "how-to-make",
      title: "How to make a Hotel Lobby AI video",
      blocks: [
        { type: "p", text: "There are three common ways to make one. The right one depends on what you start with." },
        { type: "table", caption: "Three ways to make a Hotel Lobby AI video", headings: ["Workflow", "What you need", "Good for"], rows: [
          ["Two-photo template", "One photo of each performer", "The quickest result, with no prompt to write"],
          ["Prompt-based generator", "Two photos plus a written scene description", "Creators who want to direct poses and timing themselves"],
          ["Motion transfer or face swap", "Your photos plus an existing performance clip", "Matching the original choreography closely, at the cost of more setup"],
        ] },
        { type: "p", text: "With the two-photo template on [LobbyDuo (migosai.design)](/hotel-lobby-ai-video-generator#generator), it takes four steps:" },
        { type: "ol", items: [
          "**Upload two photos.** Person 1 becomes the left performer and Person 2 the right. Use clear, front-facing photos with one subject each.",
          "**Pick the stage and format.** The Hotel Lobby stage gives you the orange booth and hanging mic. Choose 9:16 for TikTok, Reels and Shorts.",
          "**Check the cost and generate.** A 5-second, 480p Wan template video costs {shortCredits} credits; the exact cost for your settings appears before you submit.",
          "**Download and post.** Add the \"Hotel Lobby\" sound in the app when you upload.",
        ] },
        { type: "p", text: "For the full settings and costs, see the [Hotel Lobby AI template guide](/hotel-lobby-ai-template). To compare other tools, see [9 Hotel Lobby AI video generators compared](/blog/best-hotel-lobby-ai-video-generators-2026)." },
      ],
    },
    {
      id: "keep-in-mind",
      title: "Things to keep in mind",
      blocks: [
        { type: "p", text: "The trend is light-hearted, but it has drawn real debate. A few habits keep your version on the right side of it." },
        { type: "ul", items: [
          "**Get consent.** Only upload photos you own or have permission to use. Ask friends and family before posting their faces.",
          "**Be careful with real public figures.** Some of the most-viewed edits feature celebrities and politicians, which raises the biggest questions about using someone's likeness without permission.",
          "**Remember Takeoff.** Takeoff died in 2022, and some fans are uneasy about AI remixes of a performance from months before his death. Respectful, playful versions land better than mocking ones.",
          "**Use licensed music.** Add the song from the platform's own sound library instead of uploading a downloaded copy.",
          "**Label it as AI.** Turn on the platform's AI-generated content label if one is offered.",
        ] },
        { type: "note", text: "LobbyDuo is an independent tool and is not affiliated with Migos, Quavo, Takeoff or COLORS." },
      ],
    },
  ],
  faqs: [
    { question: "What is a Hotel Lobby AI video?", answer: "An AI-generated clip that places two people, pets or characters in the orange booth from Quavo and Takeoff's 2022 \"Hotel Lobby\" COLORS performance, trading verses at one hanging mic." },
    { question: "Why is it called \"Hotel Lobby\"?", answer: "\"Hotel Lobby\" is the name of the song. The performance was filmed in the COLORS studio, not in a hotel." },
    { question: "Is the Hotel Lobby AI trend the same as the Migos AI trend?", answer: "Yes. People call it the Hotel Lobby AI trend, the Migos AI trend, the Quavo Hotel Lobby trend or the Hotel Lobby challenge. All refer to the same orange-booth format." },
    { question: "When did the Hotel Lobby AI trend start?", answer: "The AI version took off on TikTok in mid-September 2026. The original performance it is based on was released in June 2022." },
    { question: "Who can I put in a Hotel Lobby AI video?", answer: "Almost anyone with a clear photo: friends, couples, parents, grandparents, pets, or the same person twice. Use photos you have permission to upload." },
    { question: "Is a Hotel Lobby AI video a filter?", answer: "Not usually. Most versions are new videos generated from photos, not a filter applied to your camera. See [Hotel Lobby AI filter vs face swap](/hotel-lobby-ai-filter) for the difference." },
    { question: "What is the best way to make a Hotel Lobby AI video?", answer: "If you want the quickest route, use a two-photo template such as [LobbyDuo at migosai.design](/hotel-lobby-ai-video-generator#generator): upload one photo per performer and the orange booth is built in. A 5-second, 480p Wan template video costs {shortCredits} credits; purchase a credit pack before generating." },
  ],
  sources: [
    { label: "Quavo \"Hotel Lobby\" AI Trend - Know Your Meme", url: "https://knowyourmeme.com/memes/quavo-hotel-lobby-ai-trend" },
    { label: "Quavo and Takeoff's \"Hotel Lobby\" Performance Has Become a Viral AI Meme - Complex", url: "https://www.complex.com/music/a/markelibert/quavo-takeoff-hotel-lobby-ai-trend-tiktok" },
    { label: "Hotel Lobby (Unc & Phew) - Wikipedia", url: "https://en.wikipedia.org/wiki/Hotel_Lobby_(Unc_%26_Phew)" },
    { label: "HOTEL LOBBY (Unc & Phew) (A COLORS SHOW) - Discogs", url: "https://www.discogs.com/release/24719372-Quavo-Takeoff-Hotel-Lobby-Unc-Phew-A-Colors-Show" },
    { label: "Quavo & Takeoff - HOTEL LOBBY | A COLORS SHOW - YouTube", url: "https://www.youtube.com/watch?v=x9yop0nYR9g" },
  ],
};

const song: BlogPost = {
  slug: "hotel-lobby-ai-trend-song",
  path: "/blog/hotel-lobby-ai-trend-song",
  title: "What Song Is in the Hotel Lobby AI Trend? How to Add It to Your Video",
  metaTitle: "What Song Is in the Hotel Lobby AI Trend? How to Add It (2026)",
  description: "The Hotel Lobby AI trend uses \"HOTEL LOBBY (Unc & Phew)\" by Quavo and Takeoff, from their 2022 A COLORS SHOW performance. Song facts and how to add the sound on TikTok, Reels and Shorts.",
  label: "What Song Is in the Hotel Lobby AI Trend?",
  excerpt: "The exact song behind the orange-booth trend, the facts about it, and step-by-step instructions for adding the sound on TikTok, Instagram Reels and YouTube Shorts.",
  eyebrow: "HOTEL LOBBY AI · MUSIC",
  datePublished: "2026-10-04",
  dateModified: "2026-10-04",
  intro: "The Hotel Lobby AI trend uses **\"HOTEL LOBBY (Unc & Phew)\" by Quavo and Takeoff**. The exact version is their **A COLORS SHOW** performance, released on June 17, 2022. That clip, with its orange booth and single hanging microphone, is the scene every AI version recreates.",
  sections: [
    {
      id: "short-answer",
      title: "The short answer",
      blocks: [
        { type: "p", text: "To add it to your own clip, search \"Hotel Lobby\" in the TikTok, Instagram Reels or YouTube Shorts sound library. You can also tap the sound on any trending Hotel Lobby AI video and choose to use it. Step-by-step instructions for each app are below." },
      ],
    },
    {
      id: "about-the-song",
      title: "About the song",
      blocks: [
        { type: "p", text: "\"Hotel Lobby\" was the debut single of **Unc & Phew**, a duo made up of Quavo and his nephew Takeoff. The name says it plainly: Quavo is \"Unc\" and Takeoff is \"Phew\". Offset, the third Migos member, is not on the track, which fueled rumors of a Migos breakup in 2022." },
        { type: "table", caption: "HOTEL LOBBY (Unc & Phew) at a glance", headings: ["Detail", "Fact"], rows: [
          ["Full title", "HOTEL LOBBY (Unc & Phew)"],
          ["Artists", "Quavo and Takeoff (as Unc & Phew)"],
          ["Original single released", "May 20, 2022"],
          ["A COLORS SHOW version released", "June 17, 2022 (about 2:45 long)"],
          ["Producers", "Murda Beatz, Keanu Beats, Fabio Aguilar"],
          ["Label", "Quality Control Music / Motown"],
          ["Album", "Only Built for Infinity Links (October 2022)"],
          ["Peak on the US Billboard Hot 100", "No. 55"],
          ["US certification", "RIAA Platinum"],
        ] },
        { type: "p", text: "The orange booth comes from the COLORS performance, not the official music video. The official video is a desert road trip that pays homage to the film Fear and Loathing in Las Vegas. If you search for the trend's visual, look for \"Quavo & Takeoff - HOTEL LOBBY | A COLORS SHOW\" on YouTube." },
        { type: "p", text: "Takeoff died in November 2022, a few months after the COLORS performance. That is why many fans treat the clip, and the trend built on it, with extra care." },
      ],
    },
    {
      id: "how-it-became-a-trend",
      title: "How the performance became an AI trend",
      blocks: [
        { type: "p", text: "The AI version took off on TikTok in mid-September 2026. Know Your Meme traces an early viral post to September 16, 2026, when a creator swapped Quavo and Takeoff for two characters from the TV series Suits. That clip passed 1.7 million views in under two weeks." },
        { type: "p", text: "From there, people put friends, couples, grandparents, cartoon characters and pets into the orange booth. The format spread across TikTok and X through late September. Quavo responded by resharing the original COLORS performance." },
        { type: "p", text: "The sound is half of the joke. The orange booth tells viewers which trend they are watching, but the beat and the back-and-forth verses sell the illusion that your two subjects are a real rap duo. A silent clip, or one with the wrong song, usually loses that effect. New to the format? Start with [what a Hotel Lobby AI video is](/blog/what-is-hotel-lobby-ai-video)." },
      ],
    },
    {
      id: "add-the-sound",
      title: "How to add the Hotel Lobby sound to your AI video",
      blocks: [
        { type: "p", text: "The safest way to get the song is from the app's own sound library when you post. Songs in these libraries are cleared for use inside that app. Uploading a downloaded MP3 as part of your video is more likely to get muted or flagged." },
        { type: "h3", text: "TikTok" },
        { type: "ol", items: [
          "Download your finished Hotel Lobby AI clip to your phone.",
          "Tap **+**, then **Upload**, and select the clip.",
          "Tap **Add sound** and search \"Hotel Lobby\". Pick the Quavo & Takeoff track or a popular trend sound.",
          "Use the volume control to turn the clip's original audio down, so two tracks don't clash.",
          "Trim the sound so the first verse starts as the first performer begins moving.",
        ] },
        { type: "p", text: "Shortcut: open any Hotel Lobby AI video in your feed, tap the sound name at the bottom, then tap **Use this sound** and upload your clip." },
        { type: "h3", text: "Instagram Reels" },
        { type: "ol", items: [
          "Tap **+**, choose **Reel**, and select your clip.",
          "Tap the music icon and search \"Hotel Lobby\".",
          "Drag the slider to choose which part of the song plays.",
          "Lower the original clip audio if it competes with the song.",
        ] },
        { type: "p", text: "Shortcut: tap the audio name on another Hotel Lobby Reel and choose **Use audio**." },
        { type: "h3", text: "YouTube Shorts" },
        { type: "ol", items: [
          "Open the Shorts camera, then upload your clip from the gallery.",
          "Tap **Add sound** and search \"Hotel Lobby\".",
          "Pick the segment and adjust the volume mix.",
        ] },
        { type: "p", text: "Shortcut: on another Short that uses the sound, open the menu and choose to use the same sound." },
        { type: "p", text: "**If the song does not show up:** business and brand accounts often only see a commercial music library, and the track may not be in it. Music availability also varies by country. In that case, use original audio instead (see the next section)." },
      ],
    },
    {
      id: "lobbyduo-sound",
      title: "Sound options when you make the video with LobbyDuo",
      blocks: [
        { type: "p", text: "The [LobbyDuo Hotel Lobby AI Video Generator](/hotel-lobby-ai-video-generator) at migosai.design turns two photos into an orange-booth duo performance. You choose the audio before generating, in the **Sound and motion** panel." },
        { type: "table", caption: "Sound and motion options in LobbyDuo", headings: ["Option", "How it works", "Best for"], rows: [
          ["Template soundtrack", "A built-in audio reference that guides the rhythm of the performance (Wan model). It is not a promise of the original recording.", "Clips you will post with the trending sound added in the app"],
          ["Your own song", "Upload an audio file and crop the segment you want before generating.", "Music you already have the rights to publish"],
          ["Clip audio", "Upload a short motion reference video; its audio and movement guide the result.", "Matching a specific dance or delivery"],
          ["Original AI rap", "Seedance writes new lyrics and music from an optional topic. The Luxury lobby, Recording studio and Street cypher stages use it.", "Brand accounts that can't use licensed songs"],
        ] },
        { type: "p", text: "Want a full custom track? The [LobbyDuo AI Rap Song Generator](/ai-rap-song-generator) creates a complete rap song from a prompt or your own lyrics. You can then upload it as the audio for your duo video." },
        { type: "p", text: "**A simple workflow for the trend:** generate with the template soundtrack, download the clip, then add the official \"Hotel Lobby\" sound in TikTok or Reels. You keep the recognizable song and stay within the app's music license." },
      ],
    },
  ],
  faqs: [
    { question: "What is the song in the Hotel Lobby AI trend called?", answer: "\"HOTEL LOBBY (Unc & Phew)\" by Quavo and Takeoff. The trend uses the A COLORS SHOW performance from June 2022." },
    { question: "Is Offset in the Hotel Lobby song?", answer: "No. Only Quavo and Takeoff perform on it, under the duo name Unc & Phew." },
    { question: "Was the Hotel Lobby video filmed in a hotel?", answer: "No. \"Hotel Lobby\" is the song title. The viral visual was filmed in the COLORS studio, in front of an orange backdrop." },
    { question: "Why can't I find the Hotel Lobby sound on TikTok?", answer: "Business accounts usually only have access to commercial music, and some tracks are limited by region. Try a personal account, use the sound from another creator's video, or post with original audio." },
    { question: "Does an AI Hotel Lobby video include the original song?", answer: "It depends on the tool. Many tools output a silent clip or a soundtrack inspired by the trend. LobbyDuo's template audio is a reference, not the original recording, so add the official sound in the app when you post." },
    { question: "Can I use the song in a video for my business?", answer: "Music licensing depends on the platform, your account type and how you use the video. For commercial posts, original AI rap or a track you have licensed is the lower-risk choice. This article is not legal advice." },
  ],
  sources: [
    { label: "Hotel Lobby (Unc & Phew) - Wikipedia", url: "https://en.wikipedia.org/wiki/Hotel_Lobby_(Unc_%26_Phew)" },
    { label: "Unc & Phew - Wikipedia", url: "https://en.wikipedia.org/wiki/Unc_%26_Phew" },
    { label: "HOTEL LOBBY (Unc & Phew) (A COLORS SHOW) - Discogs", url: "https://www.discogs.com/release/24719372-Quavo-Takeoff-Hotel-Lobby-Unc-Phew-A-Colors-Show" },
    { label: "Quavo \"Hotel Lobby\" AI Trend - Know Your Meme", url: "https://knowyourmeme.com/memes/quavo-hotel-lobby-ai-trend" },
    { label: "Quavo and Takeoff's \"Hotel Lobby\" Performance Has Become a Viral AI Meme - Complex", url: "https://www.complex.com/music/a/markelibert/quavo-takeoff-hotel-lobby-ai-trend-tiktok" },
  ],
};

const pets: BlogPost = {
  slug: "hotel-lobby-ai-video-cat-dog",
  path: "/blog/hotel-lobby-ai-video-cat-dog",
  title: "How to Make a Hotel Lobby AI Video With Your Cat or Dog",
  metaTitle: "Hotel Lobby AI Video With Your Cat or Dog: Photo Guide (2026)",
  description: "Make a Hotel Lobby AI video with your cat or dog: which pet photos work, duo ideas, step-by-step instructions with LobbyDuo and fixes for common pet problems.",
  label: "Hotel Lobby AI Video With Your Cat or Dog",
  excerpt: "Pet duo ideas, a photo checklist that keeps your pet recognizable, step-by-step instructions and fixes for orange fur, dark fur and swapped sides.",
  eyebrow: "HOTEL LOBBY AI · PETS",
  datePublished: "2026-10-04",
  dateModified: "2026-10-04",
  intro: "Yes, the Hotel Lobby AI trend works with cats and dogs. You need **one clear, front-facing photo per pet**, uploaded to a two-photo AI video generator. The tool places both animals in the orange booth under the hanging mic and makes them trade verses like a rap duo.",
  sections: [
    {
      id: "short-answer",
      title: "The short answer",
      blocks: [
        { type: "p", text: "Pet versions are some of the most shared clips in the trend, from two rapping cats to a dog and its owner. The difference between a funny clip and a creepy one is almost always the photos. This guide shows which photos work, how to set up the video, and how to fix the most common pet problems." },
      ],
    },
    {
      id: "choose-your-duo",
      title: "Choose your duo",
      blocks: [
        { type: "p", text: "The joke lands hardest when the two performers contrast. Decide who goes on the left and who goes on the right before you upload, because the slot order sets their positions." },
        { type: "table", caption: "Pet duo ideas", headings: ["Duo", "Why it works", "Tip"], rows: [
          ["Two pets that live together", "Viewers who know your pets get an instant inside joke", "Cast the bossier pet as the lead verse"],
          ["Cat + dog", "The rivalry gives the back-and-forth a built-in story", "Pick photos where both faces fill a similar share of the frame"],
          ["You + your pet", "The most relatable version; your followers know both of you", "Use a photo of yourself with a serious \"rapper\" face"],
          ["Big dog + tiny dog", "Size contrast reads well on a small phone screen", "Use photos taken at a similar distance"],
          ["The same pet twice", "Works when you have one pet; it looks like a pet duetting with itself", "Use two different photos, ideally with different expressions or accessories"],
          ["Pet + grandparent or child", "Wholesome and very shareable with family", "Get permission before posting someone else's face"],
        ] },
        { type: "p", text: "Cartoon-style pet drawings can work too, as long as the face is clear. For a person, only upload photos you have permission to use." },
      ],
    },
    {
      id: "photo-checklist",
      title: "Pet photo checklist",
      blocks: [
        { type: "p", text: "AI video models identify a pet by its face shape, eyes, ears and fur markings. Give the model a clean look at all four." },
        { type: "h3", text: "A good pet photo has" },
        { type: "ul", items: [
          "**One animal only.** No second pet, no person, no hands in the frame.",
          "**Face toward the camera**, with both eyes visible.",
          "**Head, chest and front paws in frame.** A tight face crop gives the model nothing to animate below the neck.",
          "**Even, bright light.** Daylight near a window works better than a lamp at night.",
          "**A sharp image.** Pets move fast, so use burst mode and pick the sharpest frame.",
          "**Visible markings.** Spots, stripes and a white chest help keep each pet's identity.",
          "**A plain background** that doesn't compete with the animal.",
        ] },
        { type: "h3", text: "Photos that usually fail" },
        { type: "ul", items: [
          "A photo of both pets together, which can't be split across two performer slots without cropping.",
          "A sleeping or side-on pet, where the model has to guess the missing eye.",
          "Heavy filters, sunglasses or costumes that hide the face.",
          "Dark fur in dim light, which turns facial features into one dark shape.",
        ] },
        { type: "p", text: "**How to get the shot:** get down to your pet's eye level, hold a treat just above the lens, and shoot in burst mode. If you only have a photo of both pets together, crop each animal into its own image first." },
        { type: "p", text: "**File format:** LobbyDuo accepts JPG, PNG or WebP up to 10 MB each. iPhone photos saved as HEIC need to be exported as JPEG first; renaming the file does not convert it." },
      ],
    },
    {
      id: "step-by-step",
      title: "How to make it, step by step",
      blocks: [
        { type: "p", text: "These steps use the [LobbyDuo Hotel Lobby AI Video Generator](/hotel-lobby-ai-video-generator) at migosai.design, which is built around two separate photos and needs no prompt. It runs in a mobile browser, so you can do this from the phone that has your pet photos." },
        { type: "ol", items: [
          "**Open the [generator](/hotel-lobby-ai-video-generator#generator) and sign in.**",
          "**Upload the first pet to Person 1.** This slot is the left performer.",
          "**Upload the second pet to Person 2.** This slot is the right performer. Check that both previews show the right animal.",
          "**Pick a stage.** The Hotel Lobby stage gives you the classic orange studio and hanging mic. Luxury lobby, Recording studio and Street cypher are alternatives.",
          "**Set the format.** Choose 9:16 for TikTok, Reels and Shorts. Durations run from 5 to 15 seconds.",
          "**Choose the sound.** Keep the template soundtrack, upload your own song, or let the model write original AI rap.",
          "**Check the cost and generate.** The cost appears next to your balance before you submit. A 5-second, 480p Wan template video costs {shortCredits} credits; see [pricing](/pricing) for credit packs.",
          "**Wait for the result.** Photos are reviewed, the video is generated, then the output is reviewed. You can leave the page and find the clip later in My Videos.",
          "**Watch the whole clip, then download.** Check both pets from start to finish before you post.",
        ] },
        { type: "p", text: "**Save credits on your first try:** run a 5-second, 480p test to see whether your photos work. Once the pairing looks right, generate a longer or sharper version." },
      ],
    },
    {
      id: "pet-fixes",
      title: "Pet problems and how to fix them",
      blocks: [
        { type: "p", text: "Most bad pet results trace back to the input photos. Fix the photo first, then generate again; every new generation is a fresh attempt and can come out differently." },
        { type: "table", caption: "Common pet problems, causes and fixes", headings: ["Problem", "Likely cause", "Fix"], rows: [
          ["Your ginger cat or golden dog blends into the background", "Orange fur against the orange booth", "Use a brightly lit photo with a clear outline, or switch to the Recording studio or Luxury lobby stage"],
          ["A black pet looks like a dark blob", "Dim light hides the eyes and face shape", "Retake the photo in daylight with both eyes clearly visible"],
          ["The two pets merge into one hybrid animal", "The pets look alike, or the photos are crowded or dark", "Use photos where each pet's markings or collar clearly differ, and crop so each pet fills its frame"],
          ["The pets are on the wrong sides", "Slot order", "Person 1 is always left and Person 2 is always right; swap the uploads"],
          ["Your pet doesn't look like your pet", "Small, blurry or side-on photo", "Use a sharp, front-facing photo where the face is large in the frame"],
          ["Paws look like human hands", "The model is animating a rap performance and borrows human gestures", "Use a photo that shows the front paws, then regenerate; some of this is part of the charm"],
          ["The upload is rejected", "HEIC format or a file over 10 MB", "Export as JPEG and reduce the file size"],
        ] },
        { type: "p", text: "For more on preparing the two performer photos, see the [Hotel Lobby AI template guide](/hotel-lobby-ai-template) and [how to fix a Hotel Lobby AI video that looks wrong](/blog/hotel-lobby-ai-video-problems-fixes)." },
      ],
    },
    {
      id: "posting",
      title: "Posting your pet duo",
      blocks: [
        { type: "ul", items: [
          "**Add the song in the app.** Search \"Hotel Lobby\" in the TikTok, Reels or Shorts sound library, and lower the clip's own audio. See [what song is in the Hotel Lobby AI trend](/blog/hotel-lobby-ai-trend-song).",
          "**Name the performers in the caption.** \"Biscuit and Mochi in the booth\" gives followers a reason to comment.",
          "**Use the trend tags**, such as #hotellobby, #hotellobbyai, #catsoftiktok or #dogsoftiktok.",
          "**Turn on the AI-generated label** if the platform offers one.",
        ] },
      ],
    },
  ],
  faqs: [
    { question: "Can I make a Hotel Lobby AI video with a cat and a dog?", answer: "Yes. Upload one clear photo of each animal, one per performer slot. A cat and a dog together is one of the most popular pairings." },
    { question: "Can I use the same pet for both performers?", answer: "Yes. Upload two different photos of the same pet. Different expressions or accessories make the duet funnier." },
    { question: "Can I use one photo with both pets in it?", answer: "Crop it into two images first, one animal each. LobbyDuo needs a separate photo in each slot." },
    { question: "Will my pet stand upright like a rapper?", answer: "Usually. Generators tend to pose pets upright like performers, but results vary between attempts." },
    { question: "Do I need to write a prompt?", answer: "Not with LobbyDuo; the scene is built in. Some other tools, such as Dreamina and Media.io, ask you to paste a prompt." },
    { question: "How much does it cost?", answer: "On LobbyDuo, a 5-second, 480p Wan template video costs {shortCredits} credits. The exact cost for your settings is shown before you generate; credit packs are on the [pricing page](/pricing)." },
  ],
  sources: [
    { label: "Hotel Lobby AI Template - LobbyDuo", url: `${SITE_URL}/hotel-lobby-ai-template` },
    { label: "Hotel Lobby AI Filter & Face Swap - LobbyDuo", url: `${SITE_URL}/hotel-lobby-ai-filter` },
    { label: "Free Hotel Lobby AI Video Generator? Credits & Limits - LobbyDuo", url: `${SITE_URL}/hotel-lobby-ai-video-generator-free` },
    { label: "Quavo and Takeoff's \"Hotel Lobby\" Performance Has Become a Viral AI Meme - Complex", url: "https://www.complex.com/music/a/markelibert/quavo-takeoff-hotel-lobby-ai-trend-tiktok" },
  ],
};

const fixes: BlogPost = {
  slug: "hotel-lobby-ai-video-problems-fixes",
  path: "/blog/hotel-lobby-ai-video-problems-fixes",
  title: "Hotel Lobby AI Video Looks Wrong? Fixes for Blended Faces, Swapped Sides and More",
  metaTitle: "Hotel Lobby AI Video Problems and Fixes: Blended Faces, Swapped Sides (2026)",
  description: "Why Hotel Lobby AI videos go wrong and how to fix them: blended faces, the wrong identity, swapped sides, extra people, silent clips, rejected uploads and stuck progress.",
  label: "Hotel Lobby AI Video Problems and Fixes",
  excerpt: "A symptom-by-symptom guide to blended faces, wrong identities, swapped sides, extra people, silent clips and rejected uploads, plus a photo checklist that prevents most of them.",
  eyebrow: "HOTEL LOBBY AI · TROUBLESHOOTING",
  datePublished: "2026-10-04",
  dateModified: "2026-10-04",
  intro: "Most bad Hotel Lobby AI videos come from the two input photos, not the tool. Blended faces, the wrong person on the wrong side and strangers appearing in the booth usually trace back to a crowded, dark or mismatched photo.",
  sections: [
    {
      id: "short-answer",
      title: "The short answer",
      blocks: [
        { type: "p", text: "These four fixes solve most cases:" },
        { type: "ol", items: [
          "**Use one person per photo.** Crop group shots so each image shows a single face.",
          "**Use bright, front-facing portraits.** Both eyes visible, face large in the frame.",
          "**Make the two photos look different.** Different outfits, backgrounds or expressions help the model keep two identities apart.",
          "**Check the slot order.** In two-photo generators such as LobbyDuo, the first photo is the left performer and the second is the right.",
        ] },
        { type: "p", text: "The table below covers each symptom in detail." },
      ],
    },
    {
      id: "find-your-problem",
      title: "Find your problem",
      blocks: [
        { type: "table", caption: "Hotel Lobby AI video problems, causes and fixes", headings: ["What you see", "Likely cause", "Fix"], rows: [
          ["Both performers have the same face, or a mix of both", "Photos are crowded, dark or too similar", "Use two bright, single-person portraits that differ in outfit or background"],
          ["A performer doesn't look like the person in the photo", "The face is small, blurry, angled or covered", "Use a sharp, front-facing photo where the face fills more of the frame; remove sunglasses and hats"],
          ["The two people are on the wrong sides", "Upload order", "Put the left performer in the first slot and the right performer in the second"],
          ["A third person or extra hands appear", "Another person, arm or pet is partly visible in a photo", "Crop so only one subject remains in each image"],
          ["The booth isn't orange or the mic is missing", "A different stage or tool setting was selected", "In LobbyDuo, pick the Hotel Lobby stage; the other stages use different sets"],
          ["The video is silent or uses a different song", "Many tools export silent clips or an inspired-by soundtrack", "Add the official \"Hotel Lobby\" sound from the TikTok, Reels or Shorts library when you post"],
          ["The movement doesn't match the original choreography", "The tool generates new movement instead of copying the source", "Upload a motion reference clip, or use a motion-transfer tool if exact moves matter"],
          ["The performance looks stiff or short", "Very short duration or a low-detail photo", "Try a longer duration and a waist-up photo that shows the hands"],
          ["The upload is rejected", "HEIC format, or a file over the size limit", "Export as JPEG and keep each file under 10 MB"],
          ["Progress stops at the same percentage", "The job is between stages, such as photo or video review", "Wait instead of resubmitting; check your saved videos later"],
        ] },
        { type: "p", text: "Every generation is a new attempt, so the same photos can give a better result on a second try. Switching to a higher resolution creates a new video; it does not upscale the one you already have." },
      ],
    },
    {
      id: "photo-checklist",
      title: "The photo checklist that prevents most problems",
      blocks: [
        { type: "p", text: "Run through this before you spend credits. It takes a minute and avoids most failed generations." },
        { type: "ul", items: [
          "**One subject per photo.** No friends at the edge of the frame, no arm around a shoulder.",
          "**Front-facing, eyes open.** A slight angle is fine; a profile is not.",
          "**Face large and in focus.** A waist-up shot works well, as long as the face is still easy to recognize.",
          "**Bright, even light.** Avoid backlit windows, harsh shadows and night photos.",
          "**Nothing covering the face.** Remove sunglasses, masks, wide hats and heavy filters.",
          "**Two photos that look different.** Similar lighting is fine, but different clothes or backgrounds help keep identities apart.",
          "**The right format.** JPG, PNG or WebP under 10 MB. Export iPhone HEIC photos as JPEG; renaming the file does not convert it.",
          "**Permission to use both faces.** Only upload photos you own or have consent to animate.",
        ] },
        { type: "p", text: "Want the same person in both roles? Use two different photos of them, ideally in different outfits. Making a pet version? See the [cat and dog photo guide](/blog/hotel-lobby-ai-video-cat-dog)." },
      ],
    },
    {
      id: "what-to-change",
      title: "Regenerate, change the photos, or change the workflow?",
      blocks: [
        { type: "p", text: "**Regenerate** when the result is close but one moment looks off, such as a strange hand or an odd expression. Results vary from run to run." },
        { type: "p", text: "**Change the photos** when the same problem shows up twice. Blended faces, wrong identities and extra people rarely fix themselves on a retry with the same inputs." },
        { type: "p", text: "**Change the workflow** when the tool can't give you what you want. Hotel Lobby AI tools work in three different ways:" },
        { type: "table", caption: "Three Hotel Lobby AI workflows and where they struggle", headings: ["Workflow", "How it works", "Where it struggles"], rows: [
          ["Two-photo template (for example, [LobbyDuo](/hotel-lobby-ai-video-generator))", "Generates a new orange-booth performance from two photos; no prompt needed", "Movement is newly generated, so it won't copy the original moves frame for frame"],
          ["Prompt-based generator (for example, Dreamina or Media.io)", "You upload photos and write the scene in a prompt", "Vague prompts cause side swaps; spell out left and right, and ask for no extra people or face blending"],
          ["Motion transfer or face swap", "Swaps your subjects into an existing performance clip", "Needs a source video and more setup; reusing footage raises rights questions"],
        ] },
        { type: "p", text: "On LobbyDuo (migosai.design), test new photos with a 5-second, 480p Wan template clip, which costs {shortCredits} credits. Generate the longer, sharper version only once the pairing looks right. See the [credits guide](/hotel-lobby-ai-video-generator-free) for the full cost table." },
      ],
    },
  ],
  faqs: [
    { question: "Why do the two faces blend together in my Hotel Lobby AI video?", answer: "Face blending usually happens when the reference photos are crowded, poorly lit or too similar. Use two separate, bright portraits that look clearly different." },
    { question: "Why is my friend on the wrong side?", answer: "Most two-photo tools place the first upload on the left and the second on the right. Swap the uploads and generate again." },
    { question: "Why doesn't the AI video look like me?", answer: "The face in your photo is probably small, angled, blurry or partly covered. A sharp, front-facing photo with your face large in the frame works best." },
    { question: "Why is my Hotel Lobby AI video silent?", answer: "Many tools export a silent clip or a soundtrack inspired by the trend. Add the official \"Hotel Lobby\" sound from your app's music library when you post." },
    { question: "Can I fix a finished video without paying again?", answer: "Usually not. Each fix is a new generation, which uses credits again. Testing new photos with a short, low-resolution clip keeps the cost down." },
    { question: "Why are the moves different from the original Quavo and Takeoff performance?", answer: "Template generators create new movement inspired by the scene rather than copying the source. If the exact choreography matters, use a motion reference clip or a motion-transfer tool." },
  ],
  sources: [
    { label: "Hotel Lobby AI Template - LobbyDuo", url: `${SITE_URL}/hotel-lobby-ai-template` },
    { label: "Hotel Lobby AI Filter & Face Swap - LobbyDuo", url: `${SITE_URL}/hotel-lobby-ai-filter` },
    { label: "9 Hotel Lobby AI Video Generators Compared - LobbyDuo", url: `${SITE_URL}/blog/best-hotel-lobby-ai-video-generators-2026` },
    { label: "Hotel Lobby AI Filter prompts - Dreamina", url: "https://dreamina.capcut.com/ai-video/hotel-lobby-ai-filter" },
  ],
};

/** Newest first; the index lists these before the October 2 tool comparison. */
export const blogPosts: BlogPost[] = [whatIs, song, pets, fixes];

export function getBlogPost(slug: string): BlogPost {
  const post = blogPosts.find((item) => item.slug === slug);
  if (!post) throw new Error(`Unknown blog post: ${slug}`);
  return post;
}

/** Every English source string the blog renders; used by the translation coverage test. */
export function blogSourceStrings(): string[] {
  const strings = new Set<string>([...Object.values(blogIndexCopy), ...Object.values(blogUiCopy)]);
  for (const post of blogPosts) {
    for (const value of [post.title, post.metaTitle, post.description, post.label, post.excerpt, post.eyebrow, post.intro]) strings.add(value);
    for (const section of post.sections) {
      strings.add(section.title);
      for (const block of section.blocks) {
        if (block.type === "p" || block.type === "note" || block.type === "h3") strings.add(block.text);
        else if (block.type === "code") strings.add(block.label);
        else if (block.type === "ul" || block.type === "ol") block.items.forEach((item) => strings.add(item));
        else {
          strings.add(block.caption);
          block.headings.forEach((heading) => strings.add(heading));
          block.rows.flat().forEach((cell) => strings.add(cell));
        }
      }
    }
    for (const faq of post.faqs) { strings.add(faq.question); strings.add(faq.answer); }
  }
  return [...strings];
}
