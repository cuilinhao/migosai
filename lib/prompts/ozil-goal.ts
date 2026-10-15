export function ozilGoalPrompt(): string {
  return `Create a realistic 15-second football video using reference image 1 only to replace the main ball-carrying player in reference video 1.
Keep the protagonist's face, hairstyle, body proportions, original clothing and shoes from reference image 1 consistent throughout. Do not apply this identity to any goalkeeper, defender, spectator or other person.
Reference video 1 controls the original movement, timing, camera movement and framing, pitch, lighting, background and all other players. Preserve those elements. Do not invent shots, cuts or extra actions.
Follow these three continuous phases in order:
0-3 seconds: the goalkeeper leaps into a diving save and the protagonist avoids the airborne goalkeeper while retaining control of the football.
3-8.5 seconds: the ball bounces up and the protagonist controls it naturally with the chest, keeping the ball trajectory continuous.
8.5-15 seconds: a defender makes a slide tackle and misses; the protagonist keeps dribbling forward toward the goal.
Maintain physically natural, continuous ball touches, body balance, foot placement, ball contact, momentum and spatial relationships. No identity swaps, blended faces, fused bodies, extra limbs, teleportation, foot sliding, outfit changes or impossible ball motion. Keep the same protagonist visible and recognizable across the sequence.
Generate sound matching the football atmosphere and action timing of reference video 1, including natural ball contacts and stadium ambience. Do not add rap vocals or a new musical performance.`;
}

export function falOzilGoalPrompt(): string {
  return ozilGoalPrompt().replaceAll('reference image 1', 'Image 1').replaceAll('reference video 1', 'Video 1').replaceAll('Reference video 1', 'Video 1');
}
