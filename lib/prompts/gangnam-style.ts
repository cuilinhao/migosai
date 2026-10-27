import type { GangnamStyleMode } from '../gangnam-style';

/** Direction derived from the public 15-second reference, not the source site's private prompt. */
export function gangnamStylePrompt(mode: GangnamStyleMode): string {
  const identity = mode === 'selfie'
    ? 'Cast three separate copies of the same adult from @Image1: A in the opening middle position, B on the opening right, C on the opening left. All three copies keep the uploaded face, hair and clothes throughout; never restore an original reference performer.'
    : mode === 'pets'
      ? '@Image1 supplies pet A in the opening middle position. @Image2 supplies pet B on the opening right. @Image3 supplies pet C on the opening left. Retain each animal\'s own species, face, fur markings and size. Translate the performers\' expressions and gestures into playful head and front-paw movements with coherent animal anatomy; do not turn pets into people.'
      : '@Image1 supplies adult A in the opening middle position. @Image2 supplies adult B on the opening right. @Image3 supplies adult C on the opening left. Each uploaded portrait determines that person\'s face, hair, clothing and body proportions, replacing the reference performer completely. Do not inherit a reference face, hairstyle, hat or jacket that is absent from the assigned photo.';
  return `Render a silent 15-second remake of @Video1 with the uploaded cast. @Video1 controls the scene, gestures, expressions, edit timing and handheld phone selfie camerawork; the images control identity. ${identity} Preserve these casting assignments in every group shot and solo close-up, including during blurred camera transitions. Keep each face on its own body, without identity swaps or extra foreground performers.

Follow the actual reference's close camera distance, wide-angle lens, arm-held motion, quick whip pans and changes of viewpoint. Keep its sunset Seoul sidewalk, glass buildings, flagpoles, passing cars and background activity. People outside a solo frame may leave the picture just as they do in the reference; do not hold three full bodies on screen.

Match the reference timeline: 0–2 seconds, the three crowd into a cheerful shoulder-up group selfie. 2–4.9 seconds, A from the middle takes the first solo, close to the lens, with the reference's playful mouth movements, pointing and shoulder sway. 4.9–8.4 seconds, whip to B from the right for the second solo beside the road, matching the head movement, hair toss and hand gesture. 8.4–12.3 seconds, whip to C from the left for the third solo toward the side street, matching the hands-near-head gesture and small finger-heart pose. 12.3–15 seconds, return to A at the front and let B and C lean back into the final tight group selfie. Use @Video1's exact performance and transition timing wherever these approximate time ranges differ.

This is a lively selfie relay with lip movements and upper-body gestures. Do not substitute a staged full-body dance routine, a tripod shot, a distant group tableau, a split screen or a new storyboard. No audible output, added captions, title cards or watermarks.`;
}
