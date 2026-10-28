import { GANGNAM_STYLE_CONFIG, GANGNAM_STYLE_ASPECTS, GANGNAM_STYLE_RESOLUTIONS, GANGNAM_STYLE_MODES, getGangnamStyleCost, type GangnamStylePayload, type GangnamStyleMode, type GangnamStyleAspect, type GangnamStyleResolution } from '../gangnam-style';
import { gangnamStylePrompt } from '../prompts/gangnam-style';
import { readImageDimensions, validateFlyingCarPhotoDimensions } from '../flyingcar-photo';
import { requireUser } from './auth';
import { matchesGangnamStyleOptions, reserveGeneration, type Job } from './billing';
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

export async function createGangnamStyleGeneration(request: Request): Promise<Response> {
  const env = await getEnv();
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env);
  const input: unknown = await jsonBody(request);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Invalid Gangnam Style options.');
  const options = input as Record<string, unknown>;
  const header = request.headers.get('Idempotency-Key');
  if (header !== null && !/^[\w-]{8,128}$/.test(header)) throw new ApiError(400, 'Invalid request identifier.');
  if ('workflow' in options) throw new ApiError(400, 'The generation workflow is managed by the server.');
  if (header) {
    const previous = await database(env).prepare('SELECT * FROM generations WHERE user_id=? AND idempotency_key=?').bind(user.id, header).first<Job>();
    if (previous) {
      let saved: unknown;
      try { saved = JSON.parse(previous.payload); } catch { /* Invalid saved options cannot match a retry. */ }
      if (previous.kind !== 'video' || !matchesGangnamStyleOptions(saved, { ...options, template: 'gangnam-style' })) {
        throw new ApiError(409, 'This request identifier was already used for different options.');
      }
      return Response.json(generationResponse(previous), { status: 202, headers: { 'Cache-Control': 'no-store' } });
    }
  }
  let unavailableReason: string | undefined;
  try { providerConfigured(env, 'kie'); }
  catch (error) { if (error instanceof ApiError && error.status === 503) unavailableReason = error.message; else throw error; }
  moderationConfigured(env);
  if (typeof options.mode !== 'string' || !GANGNAM_STYLE_MODES.includes(options.mode as GangnamStyleMode)) throw new ApiError(400, 'Choose friends, selfie or pets.');
  if (typeof options.aspect !== 'string' || !GANGNAM_STYLE_ASPECTS.includes(options.aspect as GangnamStyleAspect)) throw new ApiError(400, 'Gangnam Style videos use the reference video\'s 16:9 aspect ratio.');
  if (typeof options.resolution !== 'string' || !GANGNAM_STYLE_RESOLUTIONS.includes(options.resolution as GangnamStyleResolution)) throw new ApiError(400, 'Choose 480p or 720p.');
  if (options.consent !== true) throw new ApiError(400, 'Please confirm that you have permission to use these photos and agree to the photo terms.');
  const mode = options.mode as GangnamStyleMode;
  if (!Array.isArray(options.photos) || options.photos.length !== (mode === 'selfie' ? 1 : 3)) throw new ApiError(400, mode === 'selfie' ? 'Upload one selfie.' : 'Upload three photos in middle, right, left order.');
  // Validate sequentially so at most one 10 MiB image is read into Worker memory.
  const photos: string[] = [];
  for (const value of options.photos) photos.push(await validatePhoto(env, user.id, value));
  const resolution = options.resolution as GangnamStyleResolution;
  // The request cannot choose a provider, model, prompt, duration, audio or price.
  const payload: GangnamStylePayload = {
    template: 'gangnam-style', workflow: 'reference-edit-v1', ...GANGNAM_STYLE_CONFIG,
    mode, photos, aspect: options.aspect as GangnamStyleAspect, resolution, consent: true,
    prompt: gangnamStylePrompt(mode),
  };
  const key = header ?? await sha256(`gangnam-style:${JSON.stringify(payload)}:${Math.floor(Date.now() / 60000)}`);
  const job = await reserveGeneration(database(env), user.id, key, 'video', payload, getGangnamStyleCost(resolution), unavailableReason);
  return Response.json(generationResponse(job), { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
