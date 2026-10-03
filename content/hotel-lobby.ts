import { getVideoCost } from "../lib/video-options";

export const hotelLobbyTitle = "Hotel Lobby AI Video Generator — Two-Photo Duo Videos (2026)";
export const hotelLobbyDescription = "Turn two photos into a Hotel Lobby style AI duo video without a prompt. New accounts get 50 welcome credits once, with no subscription required. Sign in, choose your format and generate.";
export const minimumVideoCredits = getVideoCost(5, "480p", "wan-3.0");

export const hotelLobbySteps = [
  {
    title: "Step 1: Upload two clear photos",
    description: "Choose one photo for each performer and place them in the left and right upload slots. Use clear, front-facing portraits with one visible face per image. A half-body or full-body picture can work when the face remains easy to see. Similar lighting and camera angles help the pair look consistent. Use photos you have permission to animate, in JPG, PNG or WebP format, no larger than 10 MB each.",
  },
  {
    title: "Step 2: Set up the Hotel Lobby template",
    description: "Choose Hotel Lobby, Luxury lobby, Recording studio or Street cypher. Video settings control the model, duration, aspect ratio and resolution. In Sound and motion, use a template reference or crop your own motion video. Wan supports the template soundtrack, your song or clip audio; Seedance creates original AI rap from an optional topic. Review the displayed credit cost before generating.",
  },
  {
    title: "Step 3: Generate & download",
    description: `Sign in with Google and check that your account has enough credits before submitting. A five-second Wan template video at 480p uses ${minimumVideoCredits} credits; new accounts receive 50 welcome credits once, enough for one five-second video at 480p. No subscription is required. Follow the upload, generation and review status shown in the tool. Once the video is completed and approved, preview and download it. Processing time varies with the selected settings, the service queue and review, so allow time for the full process.`,
  },
];

export const hotelLobbyFaqs = [
  {
    question: "Is there a free Hotel Lobby AI video generator?",
    answer: `Yes. New accounts receive 50 welcome credits once, enough for one five-second video at 480p. No subscription is required. A five-second Wan template video at 480p needs ${minimumVideoCredits} credits. Further generation requires enough remaining or purchased credits. You can browse the template, instructions and reference videos for free. Check the displayed generation cost and the pricing page before deciding whether to add credits to your account.`,
  },
  {
    question: "How do I make a Hotel Lobby AI video with two photos?",
    answer: "Upload one clear photo for each performer, select a stage and video settings, then choose the sound and motion. You can keep the template references or crop your own audio and video in the browser. For original AI rap, choose Seedance and optionally enter a topic. Sign in and generate with credits, then preview and download after generation and review.",
  },
  {
    question: "What photos do I need for the Hotel Lobby AI video trend?",
    answer: "Use two separate, clear photos with one front-facing person in each image. Similar lighting, visible faces and uncropped heads give the model better visual references. Half-body or full-body shots are useful when the face is still large enough to recognize. Avoid heavy filters, sunglasses, motion blur and crowded group pictures. This tool accepts JPG, PNG and WebP files up to 10 MB per photo.",
  },
  {
    question: "Is the Hotel Lobby AI video trend the same as the Migos AI video?",
    answer: "People often use both names for the two-person, orange-booth performance format. The visual reference is the Hotel Lobby performance by Quavo and Takeoff on COLORS; the search phrase Migos AI video describes AI-made variations of that look. This is an independent creation tool, with no affiliation or endorsement implied. Generated clips do not include a promise to reproduce the original song or performance exactly.",
  },
  {
    question: "Can I make a Hotel Lobby AI video without a prompt?",
    answer: "Yes. Scene instructions are built in, so a general prompt is not required. Choose from four stages, upload two photos and set the video format. Upload a motion clip to guide the performance, or use the template reference. Seedance can create original AI rap from an optional topic. There is no separate camera-path or lyric editor.",
  },
  {
    question: "How long does it take to generate a Hotel Lobby AI video?",
    answer: "Generation time varies, and there is no guaranteed completion time in seconds. Uploading the photos, reviewing the inputs, generating the clip and reviewing the output all contribute to the wait. The tool shows the current stage while your task is processing. Preset lengths are 5, 8, 10, 12 and 15 seconds; a cropped motion reference can set a shorter length. These are video lengths, not processing-time promises. Preview and download become available only after the video is completed and approved.",
  },
  {
    question: "Do both people need to be in the same photo?",
    answer: "No, this tool uses one separate photo for each of the two performers. Add the first person to the left slot and the second person to the right slot; the generated scene brings them together. If you start from a shared photo, prepare two individual crops with clear faces before uploading. Matching lighting helps, but it is not necessary for the photos to have been taken together.",
  },
  {
    question: "What's the difference between Hotel Lobby AI video and a normal face swap?",
    answer: "A Hotel Lobby AI video generates a new duo performance from your two image references, while a conventional face swap replaces a face in existing footage. This tool aims to create the scene, movement and appearance together, so details can vary between runs. It is not a frame-by-frame recreation of a source video. A motion reference can guide the performance, but the generated result is not guaranteed to preserve every source frame.",
  },
];

export function hotelLobbySchema(url: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#application`,
        name: "Hotel Lobby AI Video Generator",
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        url,
        description: hotelLobbyDescription,
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: hotelLobbyFaqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://migosai.design" },
          { "@type": "ListItem", position: 2, name: "Hotel Lobby AI Video Generator", item: url },
        ],
      },
    ],
  };
}
