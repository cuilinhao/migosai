import { OZIL_GOAL_CONFIG, KIE_OZIL_GOAL_CONFIG, OZIL_GOAL_COST, type OzilGoalPayload } from '../ozil-goal';
import { requireUser } from './auth';
import { reserveGeneration } from './billing';
import { appOrigin, database, getEnv, media, moderationConfigured, providerConfigured, type Env } from './env';
import { ApiError } from './errors';
import { generationResponse } from './jobs';
import { jsonBody, sameOrigin, sha256 } from './security';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_ERROR = 'Please upload a valid JPEG, PNG or WebP photo from your account again.';

async function validatePhoto(env: Env, userId: string, value: unknown): Promise<string> {
  const prefix = `users/${userId}/uploads/`;
  if (typeof value !== 'string' || value.length > 250 || !value.startsWith(prefix)
    || !/^[A-Za-z0-9_-]+$/.test(value.slice(prefix.length))) throw new ApiError(400, PHOTO_ERROR);
  const upload = await database(env).prepare('SELECT content_type,media_kind FROM uploads WHERE key=? AND user_id=?')
    .bind(value, userId).first<{ content_type: string; media_kind: string | null }>();
  if (!upload || !IMAGE_TYPES.has(upload.content_type) || upload.media_kind !== null) throw new ApiError(400, PHOTO_ERROR);
  // The upload endpoint already checks image magic bytes. Verify that its trusted
  // storage object still exists, has a valid size, and matches the recorded MIME.
  const object = await media(env).head(value);
  if (!object || object.size <= 0 || object.size > 10 * 1024 * 1024
    || object.httpMetadata?.contentType !== upload.content_type) throw new ApiError(400, PHOTO_ERROR);
  return value;
}

export async function createOzilGoalGeneration(request: Request): Promise<Response> {
  const env = await getEnv();
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env);
  let unavailableReason: string | undefined;
  try { providerConfigured(env, 'fal'); }
  catch (error) { if (error instanceof ApiError && error.status === 503) unavailableReason = error.message; else throw error; }
  moderationConfigured(env);
  const input: unknown = await jsonBody(request);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Invalid Ozil goal options.');
  const options = input as Record<string, unknown>;
  if (options.consent !== true) throw new ApiError(400, 'Please confirm that you have permission to use this photo and agree to the photo terms.');
  const photo = await validatePhoto(env, user.id, options.photo);
  const header = request.headers.get('Idempotency-Key');
  if (header && !/^[\w-]{8,128}$/.test(header)) throw new ApiError(400, 'Invalid request identifier.');
  // Pick only the authorized photo and affirmative consent from the client.
  const payload: OzilGoalPayload = { template: 'ozil-goal', provider: 'fal', photo, consent: true, ...OZIL_GOAL_CONFIG };
  const minute = Math.floor(Date.now() / 60000);
  let key = header ?? await sha256(`ozil-goal:${JSON.stringify({ photo, consent: true })}:${minute}`);
  if (!header) {
    // Recover the prior release's implicit key during the same retry window.
    const oldPayload = { template: 'ozil-goal', provider: 'kie', photo, consent: true, ...KIE_OZIL_GOAL_CONFIG };
    const oldKey = await sha256(`ozil-goal:${JSON.stringify(oldPayload)}:${minute}`);
    if (await database(env).prepare('SELECT id FROM generations WHERE user_id=? AND idempotency_key=?').bind(user.id, oldKey).first()) key = oldKey;
  }
  const job = await reserveGeneration(database(env), user.id, key, 'video', payload, OZIL_GOAL_COST, unavailableReason);
  return Response.json(generationResponse(job), { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
