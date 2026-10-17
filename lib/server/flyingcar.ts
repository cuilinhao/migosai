import { FLYING_CAR_CONFIG, getFlyingCarCost, type FlyingCarPayload } from '../flyingcar';
import { readImageDimensions, validateFlyingCarPhotoDimensions } from '../flyingcar-photo';
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
  // Uploads already validate the bytes. Verify the private object still agrees
  // with the ownership record before it is signed for the generation provider.
  const object = await media(env).head(value);
  if (!object || object.size <= 0 || object.size > 10 * 1024 * 1024
    || object.httpMetadata?.contentType !== upload.content_type) throw new ApiError(400, PHOTO_ERROR);
  // Bind the byte read to the object checked above. R2 supplies the trusted size,
  // so arrayBuffer is bounded by the existing 10 MiB upload limit.
  const stored = await media(env).get(value, { onlyIf: { etagMatches: object.etag } });
  if (!stored || !('arrayBuffer' in stored) || typeof stored.arrayBuffer !== 'function'
    || stored.etag !== object.etag || stored.size !== object.size
    || stored.httpMetadata?.contentType !== upload.content_type) throw new ApiError(400, PHOTO_ERROR);
  const bytes = new Uint8Array(await stored.arrayBuffer());
  if (bytes.byteLength !== object.size) throw new ApiError(400, PHOTO_ERROR);
  const dimensions = readImageDimensions(bytes, upload.content_type);
  if (!dimensions) throw new ApiError(400, PHOTO_ERROR);
  if (!validateFlyingCarPhotoDimensions(dimensions.width, dimensions.height)) {
    throw new ApiError(400, 'Choose a photo with each side from 301 to 5,999 pixels and a width-to-height ratio greater than 0.4 and less than 2.5.');
  }
  return value;
}

export async function createFlyingCarGeneration(request: Request): Promise<Response> {
  const env = await getEnv();
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env);
  let unavailableReason: string | undefined;
  try { providerConfigured(env, 'kie'); }
  catch (error) { if (error instanceof ApiError && error.status === 503) unavailableReason = error.message; else throw error; }
  moderationConfigured(env);
  const input: unknown = await jsonBody(request);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Invalid FlyingCar options.');
  const options = input as Record<string, unknown>;
  const prompt = typeof options.prompt === 'string' ? options.prompt.trim() : '';
  if (prompt.length < FLYING_CAR_CONFIG.minPromptLength || prompt.length > FLYING_CAR_CONFIG.maxPromptLength) {
    throw new ApiError(400, 'Describe your scene in 12 to 600 characters.');
  }
  if (typeof options.duration !== 'number') throw new ApiError(400, 'Choose a whole-number duration from 5 to 30 seconds.');
  let cost: number;
  try { cost = getFlyingCarCost(options.duration); }
  catch { throw new ApiError(400, 'Choose a whole-number duration from 5 to 30 seconds.'); }
  let image: { photo: string; consent: true } | Record<string, never> = {};
  if (Object.hasOwn(options, 'photo')) {
    if (options.consent !== true) throw new ApiError(400, 'Please confirm that you have permission to use this photo and agree to the photo terms.');
    image = { photo: await validatePhoto(env, user.id, options.photo), consent: true };
  }
  const header = request.headers.get('Idempotency-Key');
  if (header && !/^[\w-]{8,128}$/.test(header)) throw new ApiError(400, 'Invalid request identifier.');
  // Preserve the user's scene, trimming only surrounding whitespace. Model, frame, audio and price are owned by
  // this endpoint; client fields cannot route a job to another generator.
  const payload: FlyingCarPayload = {
    template: 'flyingcar', provider: FLYING_CAR_CONFIG.provider, model: FLYING_CAR_CONFIG.model,
    aspect: FLYING_CAR_CONFIG.aspect, resolution: FLYING_CAR_CONFIG.resolution, generateAudio: false,
    duration: options.duration, prompt, ...image,
  };
  const key = header ?? await sha256(`flyingcar:${JSON.stringify(payload)}:${Math.floor(Date.now() / 60000)}`);
  const job = await reserveGeneration(database(env), user.id, key, 'video', payload, cost, unavailableReason);
  return Response.json(generationResponse(job), { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
