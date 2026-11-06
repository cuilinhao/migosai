import { getTrendVideoTemplate, TREND_VIDEO_CONFIG, TREND_VIDEO_COST, type TrendVideoPayload, type TrendVideoTemplate } from '../trend-video';
import { requireUser } from './auth';
import { matchesTrendVideoOptions, reserveGeneration, type Job } from './billing';
import { appOrigin, database, getEnv, moderationConfigured, providerConfigured } from './env';
import { ApiError } from './errors';
import { validatePhoto } from './flyingcar';
import { generationResponse } from './jobs';
import { jsonBody, sameOrigin, sha256 } from './security';

// Original directions based on observable reference scenes, not a provider's private presets.
const newYearScene = 'Use the person in reference image 1 as the only human identity. Preserve their recognizable face, age, hair and body proportions throughout. A cinematic mountain summit rises above a vast sea of clouds, with enormous solid white stone numerals arranged left to right as exactly 2, 0, 2, 7. The numerals are separate, upright three-dimensional stone monuments, never a caption. Maintain the same four digits, their order and their physical geometry throughout. Keep the reveal readable from the front; never mirror, rearrange or add a digit. Natural cold daylight, realistic stone texture, coherent anatomy and grounded contact with the rock. No logos, subtitles, watermarks or other writing. Silent video.';
const newYearActions: Record<Exclude<TrendVideoTemplate['variant'], 'default'>, string> = {
  'fur-collar': 'Dress the subject in a warm coat with a soft fur-like collar. Begin close to the front edge of the monumental stone zero, with both hands gripping the ledge. During the first three seconds they pull up, place one knee on the top, and climb onto the broad stable surface. They stand upright and open both arms in celebration. Over the remaining seconds smoothly move the camera backward and upward, revealing the entire white-stone 2027 and distant peaks while the subject stays standing on the zero.',
  'everyone-up': 'Create an intentional vertical split-screen montage of two independent synchronized views of the SAME reference person, one view in each equal-width panel. Do not invent a second identity or a shared scene with multiple people. In each panel the subject grips a white stone ledge, pulls up onto the broad top of the zero, stands and opens both arms. Each camera then retreats and rises to reveal its own complete 2027 mountain monument. Keep the straight split fixed, each panel visually separate, each person consistent, and both digit sequences readable.',
  'arms-wide': 'Begin with the subject already standing securely on the broad top of the white stone zero, both arms held wide in a confident open pose. Keep the subject standing and their arms open throughout; no climbing. Gently rise and make a small arc around the subject from the readable front side, then retreat and ascend into a sweeping aerial wide shot of the complete 2027 monument, mountain peaks and clouds. Hold the final composition; the subject remains on the same stone surface and the year never changes.',
  'snow-climb': 'Set the monument among snow-covered mountain peaks above clouds, with a light dusting of snow on the white rock. Start close as the subject grips the ledge with both hands. They pull their torso up, place a knee on the broad surface, and climb onto the top of the zero in the first three seconds. They stand, then open both arms by the fifth second. Slowly pull the camera back and upward for the rest of the shot to reveal all four numerals 2027 against the snowy mountains. No sliding, teleporting or midair steps.',
  'final-seven': 'Frame the right-hand end of the white-stone 2027 monument. The subject grips a low accessible ledge on the final numeral seven, climbs carefully onto its broad horizontal top, and stands securely with both arms raised. Keep the action on this final seven only. Then smoothly retreat and rise from the front to reveal the complete 2027 and mountain panorama, ending with the subject visibly on the far-right seven. Keep the camera on the readable front side of the numerals and avoid a mirrored rear view.',
};

export function trendVideoPrompt(template: TrendVideoTemplate): string {
  if (template.effectId === 'stones-to-castle-ai') return 'Use reference image 1 as the first visual scene: a small pile of loose stones resting on the ground with open space around it. Preserve the original ground, background, camera perspective, lighting, stone colors and stone texture. Keep a fixed low ground-level camera for one continuous shot. Begin with the stone pile still for about two seconds. The existing stones then roll, rise and stack themselves in place: first a small foundation and arched gateway, then miniature castle walls, then a central tower and pointed turrets. Build the structure progressively upward from the same stones, with clear visible assembly and believable stone-to-stone contact. The completed castle is a small miniature on the original ground, not a full-size building. Hold the finished miniature castle for the final two seconds. No people, hands, throwing, additional characters, camera cuts, new scenery, text, logos or watermarks. Silent video.';
  return `${newYearScene} ${newYearActions[template.variant as keyof typeof newYearActions]}`;
}

export async function createTrendVideoGeneration(request: Request): Promise<Response> {
  const env = await getEnv();
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env);
  const input: unknown = await jsonBody(request);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Invalid video effect options.');
  const options = input as Record<string, unknown>;
  if (Object.keys(options).some(key => !['effectId', 'variant', 'photo', 'consent'].includes(key))) throw new ApiError(400, 'Video effect settings are managed by the server.');
  const header = request.headers.get('Idempotency-Key');
  if (header !== null && !/^[\w-]{8,128}$/.test(header)) throw new ApiError(400, 'Invalid request identifier.');
  const template = getTrendVideoTemplate(options.effectId, options.variant);
  if (!template) throw new ApiError(400, 'Choose an available video effect and variant.');
  const publicOptions = { template: 'flyingcar', trendEffect: template.effectId, trendVariant: template.variant, photo: options.photo, consent: options.consent };
  // Restore the saved paid task before requiring today's prompt, provider, or upload availability.
  if (header) {
    const previous = await database(env).prepare('SELECT * FROM generations WHERE user_id=? AND idempotency_key=?').bind(user.id, header).first<Job>();
    if (previous) {
      let saved: unknown;
      try { saved = JSON.parse(previous.payload); } catch { /* Malformed metadata cannot match a retry. */ }
      if (previous.kind !== 'video' || !matchesTrendVideoOptions(saved, publicOptions)) throw new ApiError(409, 'This request identifier was already used for different options.');
      return Response.json(generationResponse(previous), { status: 202, headers: { 'Cache-Control': 'no-store' } });
    }
  }
  if (options.consent !== true) throw new ApiError(400, 'Please confirm that you have permission to use this photo and agree to the photo terms.');
  providerConfigured(env, 'kie');
  moderationConfigured(env);
  const photo = await validatePhoto(env, user.id, options.photo);
  const payload: TrendVideoPayload = {
    template: 'flyingcar', ...TREND_VIDEO_CONFIG, trendEffect: template.effectId, trendVariant: template.variant,
    workflowVersion: 'trend-video-v1', photo, consent: true, prompt: trendVideoPrompt(template),
  };
  const key = header ?? await sha256(`trend-video:${JSON.stringify(publicOptions)}:${Math.floor(Date.now() / 60000)}`);
  const job = await reserveGeneration(database(env), user.id, key, 'video', payload, TREND_VIDEO_COST);
  return Response.json(generationResponse(job), { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
