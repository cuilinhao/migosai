// Public prompt-builder text and joining logic transcribed from the original
// ozil-goal-ai-prompt-C756gsav.js. This is separate from the paid generation prompt.
export const promptOptions = {
  length: [{ value: '5', label: '5 s' }, { value: '10', label: '10 s' }, { value: '15', label: '15 s' }],
  split: [{ value: 'one', label: 'One prompt' }, { value: 'three', label: 'Three shots' }],
  outfit: [{ value: 'photo', label: 'As in my photo' }, { value: 'suit', label: 'Office suit' }, { value: 'casual', label: 'Jeans and hoodie' }, { value: 'cosy', label: 'Dressing gown' }],
  setting: [{ value: 'night', label: 'Floodlit night' }, { value: 'rain', label: 'Rainy night' }, { value: 'day', label: 'Sunny afternoon' }],
  camera: [{ value: 'broadcast', label: 'TV side-on' }, { value: 'low', label: 'Pitch-level tracking' }, { value: 'drone', label: 'High and wide' }],
  ending: [{ value: 'run', label: 'Runs on to goal' }, { value: 'goal', label: 'Scores' }, { value: 'celebrate', label: 'Scores and celebrates' }],
} as const;
export type PromptSelection = { [K in keyof typeof promptOptions]: (typeof promptOptions)[K][number]['value'] } & { detail: string };
export const defaultPromptSelection: PromptSelection = { length: '10', outfit: 'photo', detail: '', setting: 'night', camera: 'broadcast', ending: 'goal', split: 'one' };
const outfits = {
  photo: 'They wear exactly the clothes shown in the reference photo, unchanged. Not a football kit.',
  suit: 'They wear a dark office suit, white shirt and smart shoes. Not a football kit.',
  casual: 'They wear blue jeans, a plain grey hoodie and trainers. Not a football kit.',
  cosy: 'They wear a fluffy dressing gown over pyjamas and slippers. Not a football kit.',
};
const settings = {
  night: 'A large football stadium at night under bright floodlights, green turf, a packed crowd softly out of focus.',
  rain: 'A large football stadium at night in steady rain, floodlights catching the raindrops, wet shiny turf, a packed crowd softly out of focus.',
  day: 'A large football stadium on a sunny afternoon, long shadows on the green turf, a packed crowd softly out of focus.',
};
const cameras = {
  broadcast: 'Camera: TV broadcast angle from the side of the pitch, slightly above, long lens, smooth pan that keeps the main person in frame, full body visible.',
  low: 'Camera: low tracking shot at pitch level, running alongside the main person, slight handheld movement, full body visible.',
  drone: 'Camera: high wide angle from above the stand, slowly following the play, the main person clearly visible in full.',
};
const endings = {
  run: 'the main person keeps the ball and runs on towards the empty goal.',
  goal: 'the main person runs on and calmly slots the ball into the empty net.',
  celebrate: 'the main person slots the ball into the empty net, then turns to the camera with arms wide open, smiling.',
};
const seconds = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
export function normalizeOutfitDetail(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
}
export function buildOzilPrompt(selection: PromptSelection): string {
  const duration = Number(selection.length);
  const [first, second] = [.2, .57, 1].map(fraction => Math.round(duration * fraction * 2) / 2);
  const detail = normalizeOutfitDetail(selection.detail);
  const person = ['Main person: the adult in the reference photo. Keep their face, hair, skin tone and body shape the same in every frame.', outfits[selection.outfit], detail ? `Extra outfit detail: ${detail}.` : ''].filter(Boolean).join(' ');
  const players = 'Other players: one goalkeeper in a plain orange kit and one defender in a plain dark blue kit, ordinary faces, no names, numbers, badges or logos.';
  const actions = [
    'a goalkeeper rushes out and throws himself into a full flying dive, body flat in the air, and misses the ball as the main person nudges it past him.',
    'the ball pops up and drops onto the main person, who cushions it off the chest and lets it bounce back down to their feet.',
    `a defender slides in hard along the grass and misses; ${endings[selection.ending]}`,
  ];
  const avoid = 'Avoid: football kit on the main person, face changes, extra limbs, text, subtitles, scoreboards, logos, club badges, watermarks, the likeness of any real footballer.';
  const sound = 'Sound: stadium crowd noise rising to a roar, the thud of the ball. No commentary, no music with lyrics.';
  if (selection.split === 'three') {
    const lengths = [first, second - first, duration - second].map(seconds);
    return actions.map((action, index) => [`SHOT ${index + 1} of 3 - vertical 9:16 video, about ${lengths[index]} seconds, one continuous shot.`, person, players, settings[selection.setting], cameras[selection.camera], `Action: ${action}`, sound, avoid].join('\n')).join('\n\n');
  }
  return [`Vertical 9:16 video, ${duration} seconds, one continuous shot, no text on screen.`, person, players, settings[selection.setting], cameras[selection.camera], `0 to ${seconds(first)}s: ${actions[0]}`, `${seconds(first)} to ${seconds(second)}s: ${actions[1]}`, `${seconds(second)} to ${duration}s: ${actions[2]}`, sound, avoid].join('\n');
}
