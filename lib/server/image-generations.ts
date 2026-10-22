import type { CreateImageRequest, ImageOutputFormat, ImageResolution } from '../contracts';
import { IMAGE_ASPECTS, IMAGE_FORMATS, IMAGE_MAX_REFERENCES, IMAGE_RESOLUTIONS, imageCreditCost } from '../image';
import { requireUser } from './auth';
import { reserveGeneration, type Job } from './billing';
import { appOrigin, database, getEnv, media, providerConfigured, type Env } from './env';
import { ApiError } from './errors';
import { generationResponse } from './jobs';
import { readLimited, sameOrigin, sha256 } from './security';

export type ImagePayload = CreateImageRequest & { provider: 'kie'; model: 'nano-banana-2' };
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const invalidReference = () => new ApiError(400, 'Please upload a valid JPEG, PNG or WebP reference image from your account again.');

async function imageBody(request: Request): Promise<unknown> {
  // Allow the full multilingual prompt limit without buffering an unbounded
  // JSON envelope. Other generation endpoints retain their existing limits.
  try { return JSON.parse(new TextDecoder().decode(await readLimited(request, 128 * 1024))); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'Invalid JSON.'); }
}

function validateInput(input: unknown): ImagePayload {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Invalid image options.');
  const value = input as Record<string, unknown>;
  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : '';
  if (!prompt || prompt.length > 20000) throw new ApiError(400, 'Describe your image in 1 to 20,000 characters.');
  if (!Array.isArray(value.images) || value.images.length > IMAGE_MAX_REFERENCES || !value.images.every(key => typeof key === 'string')) throw new ApiError(400, 'Choose up to ten uploaded reference images.');
  if (!IMAGE_ASPECTS.includes(value.aspect as typeof IMAGE_ASPECTS[number]) || !IMAGE_RESOLUTIONS.includes(value.resolution as ImageResolution) || !IMAGE_FORMATS.includes(value.outputFormat as ImageOutputFormat)) throw new ApiError(400, 'Choose a supported image aspect, resolution and format.');
  // All provider routing and billing remain server-owned. Only these user
  // options are persisted; extra client pricing/model fields have no effect.
  return { provider: 'kie', model: 'nano-banana-2', prompt, images: value.images, aspect: value.aspect as string, resolution: value.resolution as ImageResolution, outputFormat: value.outputFormat as ImageOutputFormat };
}

async function validateReferences(env: Env, userId: string, keys: string[]): Promise<void> {
  const prefix = `users/${userId}/uploads/`;
  for (const key of keys) {
    if (key.length > 250 || !key.startsWith(prefix) || !/^[A-Za-z0-9_-]+$/.test(key.slice(prefix.length))) throw invalidReference();
    const upload = await database(env).prepare('SELECT content_type,media_kind FROM uploads WHERE key=? AND user_id=?').bind(key, userId).first<{ content_type: string; media_kind: string | null }>();
    if (!upload || !IMAGE_TYPES.has(upload.content_type) || upload.media_kind !== null) throw invalidReference();
    // The shared upload endpoint already inspects image bytes. Confirm that its
    // private object still exists and agrees with the ownership record.
    const object = await media(env).head(key);
    if (!object || !Number.isSafeInteger(object.size) || object.size <= 0 || object.size > 10 * 1024 * 1024 || object.httpMetadata?.contentType !== upload.content_type) throw invalidReference();
  }
}

export async function createImageGeneration(request: Request): Promise<Response> {
  const env = await getEnv();
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env);
  const payload = validateInput(await imageBody(request));
  const header = request.headers.get('Idempotency-Key');
  if (header !== null && !/^[\w-]{8,128}$/.test(header)) throw new ApiError(400, 'Invalid request identifier.');
  const key = header ?? await sha256(`image:${JSON.stringify(payload)}:${Math.floor(Date.now() / 60000)}`);
  const db = database(env), cost = imageCreditCost(payload.resolution);
  const previous = await db.prepare('SELECT * FROM generations WHERE user_id=? AND idempotency_key=?').bind(user.id, key).first<Job>();
  // A saved request is recoverable even if its source upload was later removed
  // or provider configuration is temporarily unavailable. reserveGeneration
  // still compares options and never permits an identifier collision.
  if (!previous) { providerConfigured(env, 'kie'); await validateReferences(env, user.id, payload.images); }
  const job = await reserveGeneration(db, user.id, key, 'image', payload, cost);
  return Response.json(generationResponse(job), { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
