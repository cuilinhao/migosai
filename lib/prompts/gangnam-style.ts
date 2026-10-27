import type { GangnamStyleMode } from '../gangnam-style';

/** Original MigosAI choreography; the source website's private prompt is not public. */
export function gangnamStylePrompt(mode: GangnamStyleMode): string {
  const identity = mode === 'selfie'
    ? 'Create three dancers with the same recognizable identity from @Image1, positioned in the middle, right and left. Preserve the reference face, hair and outfit consistently in all three copies.'
    : mode === 'pets'
      ? '@Image1 is the middle pet, @Image2 is the right pet, and @Image3 is the left pet. Preserve each pet\'s species, fur markings, face and size differences. Use charming stylized upright movement with stable anatomy and expressive front paws.'
      : '@Image1 is the middle dancer, @Image2 is the right dancer, and @Image3 is the left dancer. Preserve each adult\'s recognizable face, hair, outfit and body proportions. Keep the three identities distinct.';
  return `Create a silent 15-second Gangnam Style-inspired dance video with exactly three performers on a bright, uncluttered pedestrian street in Seoul. ${identity} Show all three from head to foot throughout in a stable frontal wide shot. After a brief group pose, the middle performer takes the first solo, the right performer takes the second solo, and the left performer takes the third solo, before all three finish together. The other two remain visible and respond with small coordinated bounces during each solo. They perform the playful horse-riding dance: crossed wrists in front of the chest, alternating bouncing side steps and knee lifts, followed by one raised hand making a gentle lasso gesture while the other stays at the waist, then return to crossed-wrist steps and finish with a cheerful pose. Keep the middle, right and left positions fixed, coordinate the timing, and leave enough space between performers. Maintain coherent hands, feet and identities without extra limbs or people. No audio, captions, logos or watermarks.`;
}
