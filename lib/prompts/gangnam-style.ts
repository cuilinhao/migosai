import type { GangnamStyleMode } from '../gangnam-style';

/** Public reference editing direction; the source site's private prompt is not available. */
export function gangnamStylePrompt(mode: GangnamStyleMode): string {
  const prompt = "Edit @Video1. Replace ALL THREE original foreground performers from the first frame through the final frame. Assign identities by screen position and time, not by the original performers' clothes or hairstyles. Left and right mean the viewer's left and right. Opening group shot, 0-2 seconds: screen-left is @Image3, center is @Image1, screen-right is @Image2. Solo close-ups: 2-4.9 seconds is @Image1; 4.9-8.4 seconds is @Image2; 8.4-12.3 seconds is @Image3. Closing group shot, 12.3 seconds to the final frame: screen-left is @Image3, center/front is @Image1, screen-right is @Image2. Keep these assignments through camera transitions and whenever a performer re-enters the frame. Each assigned image is the sole source of that person's face, hair and clothes. Keep the original background, camera movement, framing, timing, expressions and actions unchanged. Remove all audio tracks. No audible output, added captions or watermarks.";
  if (mode === 'selfie') {
    return prompt.replace(/@Image[23]/g, '@Image1').replace(
      "Each assigned image is the sole source of that person's face, hair and clothes.",
      'Create three separate copies of the same adult from @Image1. Each copy keeps the uploaded face, hair and clothes throughout.',
    );
  }
  if (mode === 'pets') {
    return prompt.replace(
      "Each assigned image is the sole source of that person's face, hair and clothes.",
      "Each assigned image is the sole source of that pet's species, face, fur markings and size. Translate expressions and hand gestures into head and front-paw movements with coherent animal anatomy; do not turn pets into people.",
    );
  }
  return prompt;
}
