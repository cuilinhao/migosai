export type VideoInspiration = {
  title: string;
  poster: string;
  src: string;
  /** An original example prompt, not the source creator's prompt. */
  prompt: string;
};

/** Reference media provenance is recorded in docs/piclumen-video/reference.md. */
export const videoInspiration: readonly VideoInspiration[] = [
  {
    title: "Forest in motion",
    poster: "/portal/video/forest-action.webp",
    src: "/portal/video/forest-action.mp4",
    prompt: "A cinematic action scene in a lush green forest. Follow a woman as she moves through the trees, with flowing fabric, soft sunlight and a smooth tracking camera.",
  },
  {
    title: "A moment in the palace",
    poster: "/portal/video/palace-portrait.webp",
    src: "/portal/video/palace-portrait.mp4",
    prompt: "An elegant woman in traditional robes stands in an ancient palace. Warm light falls across the ornate architecture as the camera slowly moves closer to her face.",
  },
  {
    title: "Golden light",
    poster: "/portal/video/golden-ring.webp",
    src: "/portal/video/golden-ring.mp4",
    prompt: "A golden ring framed by sculptural white arches. Create a refined jewelry film with warm highlights, soft shadows and a slow camera orbit around the ring.",
  },
  {
    title: "A citrus daydream",
    poster: "/portal/video/citrus-perfume.webp",
    src: "/portal/video/citrus-perfume.mp4",
    prompt: "A glass perfume bottle surrounded by fresh citrus fruit. Sunlight shines through the bottle as the camera glides past the product, with bright colors and delicate reflections.",
  },
];
