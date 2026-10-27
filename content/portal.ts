import { getEffectCreationHref } from "./effect-templates";
import { videoEffects } from "./effects";
import { ownExamples, seedanceExamples, type OwnExample } from "./own-examples";

export const portalTools = [
  { title: "AI Image Generator", description: "Your ideas, brought to life in stunning detail.", href: "/ai-image-generator", icon: "image", tag: "Nano Banana 2" },
  { title: "Hotel Lobby", description: "Two photos. One unforgettable rap duo.", href: "/hotel-lobby-ai-video-generator", icon: "video", tag: "Popular" },
  { title: "Gangnam Style AI", description: "Three friends, one selfie or your pets. Make your trio.", href: "/gangnam-style-ai-video-generator", icon: "video", tag: "Video" },
  { title: "Flying Car", description: "Take your car from the street to the sky.", href: "/flying-car-ai-video-generator", icon: "sparkles", tag: "Video" },
  { title: "Özil Goal", description: "Put yourself in an iconic football moment.", href: "/ozil-goal-generator", icon: "video", tag: "Video" },
  { title: "Window Peeper", description: "One photo. Your own awkward window moment.", href: "/window-peeper-ai-video-generator", icon: "video", tag: "Video" },
  { title: "AI Music", description: "Original rap tracks from your own ideas.", href: "/ai-rap-song-generator", icon: "audio", tag: "Audio" },
  { title: "Image Upscaler", description: "More detail. More possibilities.", icon: "image" },
  { title: "Background Remover", description: "Make your subject the center of attention.", icon: "scissors" },
  { title: "AI Image Extender", description: "Imagine what is beyond the frame.", icon: "expand" },
] as const;

export const portalEffects = [
  { title: "Hotel Lobby", tag: "Popular", image: "/posters/lobbyduo/wan-3-corgi-cat.jpg", video: "/videos/lobbyduo/wan-3-corgi-cat.mp4", href: "/hotel-lobby-ai-video-generator" },
  { title: "Flying Car", tag: "Trending", image: "/flyingcar/real/overpass-launch.jpg", video: "/flyingcar/real/overpass-launch.mp4", href: "/flying-car-ai-video-generator" },
  { title: "Özil Goal", tag: "Trending", image: "/ozil-goal/samples/ai-shot1.jpg", video: "/ozil-goal/samples/ozil-goal-demo-ai.mp4", href: "/ozil-goal-generator" },
  { title: "Rap Duo", tag: "Popular", image: "/posters/lobbyduo/seedance-2-fast-pug-raccoon.jpg", video: "/videos/lobbyduo/seedance-2-fast-pug-raccoon.mp4", href: "/hotel-lobby-ai-video-generator" },
];

const getFeaturedEffect = (id: string) => {
  const effect = videoEffects.find(item => item.id === id);
  if (!effect) throw new Error(`Missing featured video effect: ${id}`);
  return effect;
};

export const homeEffects = [
  "001-hotel-lobby-rap-duo",
  "027-neon-dance-video",
  "014-burning-bridges-ai",
  "013-smalltown-boy-ai-dance",
  "004-hit-the-road-dude-ai-video",
  "008-enzo-fernandez-celebration",
  "009-rumpelstiltskin-ai-dance",
  "040-zombie-bride",
  "041-pet-trick-or-treat",
].map(id => {
  const effect = getFeaturedEffect(id);
  return {
    title: effect.title,
    tag: id === "001-hotel-lobby-rap-duo" ? "Popular" : "Trending",
    image: effect.poster,
    video: effect.video,
    href: getEffectCreationHref(effect),
  };
});

export type PortalCreation = OwnExample & {
  href: string;
  category: "Dance" | "Pets" | "Cinematic";
};

export const portalCreations: PortalCreation[] = [...ownExamples, ...seedanceExamples].map(example => ({
  ...example,
  href: "/hotel-lobby-ai-video-generator#generator",
  category: "Pets",
}));

const featuredCreations: { id: string; category: PortalCreation["category"]; portrait?: boolean }[] = [
  { id: "002-flying-roadster", category: "Cinematic", portrait: true },
  { id: "031-ai-tokyo-drift-video", category: "Cinematic" },
  { id: "003-ai-money-flex", category: "Cinematic", portrait: true },
  { id: "019-pet-dance", category: "Pets" },
  { id: "023-squish-pout", category: "Cinematic" },
  { id: "024-skyburst-portrait", category: "Cinematic" },
  { id: "025-warrior-weveal", category: "Cinematic" },
  { id: "007-ai-talk-dirty-dance", category: "Dance" },
  { id: "018-michael-jackson-dance", category: "Dance", portrait: true },
  { id: "058-street-jazz", category: "Dance" },
  { id: "046-pet-peekaboo", category: "Pets" },
  { id: "021-giant-on-viaduct", category: "Cinematic" },
  { id: "035-pulled-into-halloween-blind-box", category: "Cinematic" },
];

export const homeCreations: PortalCreation[] = [
  ...portalCreations.map(example => ({ ...example, portrait: true })),
  ...featuredCreations.map(({ id, category, portrait }) => {
    const effect = getFeaturedEffect(id);
    return {
      id,
      src: effect.video,
      poster: effect.poster,
      model: "Video effect",
      stage: effect.title,
      href: getEffectCreationHref(effect),
      category,
      ...(portrait ? { portrait: true } : {}),
    };
  }),
];
export const portalArticles = [
  { title: "What is the Hotel Lobby AI trend?", description: "Meet the trend. Make it your own.", image: "/posters/lobbyduo/wan-3-retriever-rabbit.jpg", href: "/blog/what-is-hotel-lobby-ai-video" },
  { title: "How to make a flying car video", description: "From a single photo to takeoff.", image: "/flyingcar/real/downtown-flyby.jpg", href: "/flying-car-ai-video-generator/how-to-make-a-tesla-roadster-flying-car-video" },
  { title: "Create your own football moment", description: "A guide to the Özil Goal effect.", image: "/ozil-goal/samples/ai-shot2.jpg", href: "/ozil-goal-generator/ozil-goal-ai-prompt" },
];
export const portalFaqs = [
  { question: "What can I create with MigosAI?", answer: "Create AI images, template-based videos and original rap music in one place. Choose a tool, add your ideas or photos, and make something your own." },
  { question: "Which image model does MigosAI use?", answer: "The image generator uses Nano Banana 2. Create from a text prompt or add reference images, choose your aspect ratio, and export as PNG or JPG." },
  { question: "How many credits does an image cost?", answer: "One 1K image costs 5 credits, 2K costs 8 credits, and 4K costs 12 credits. Your selected cost is shown before you generate. Failed generations are refunded." },
  { question: "Where is the Hotel Lobby generator?", answer: "The complete Hotel Lobby experience has its own page, including the original generator, examples, tutorials and pricing. Open Hotel Lobby from Tools or Hot Video Effects." },
  { question: "Are my creations public?", answer: "Your generated images, videos and music are saved to your private Assets library. Explore is a curated selection of examples, not an automatic feed of user creations." },
];
