import { OZIL_GOAL_CONFIG } from '../ozil-goal';
import { falOzilGoalPrompt } from '../prompts/ozil-goal';
import { appOrigin, type Env } from './env';
import { ApiError } from './errors';
import { ProviderError } from './provider';
import { validMediaUrl } from './security';

const QUEUE_ORIGIN = 'https://queue.fal.run';
const REQUEST_ID = /^[A-Za-z0-9_-]{1,200}$/;
type RecordValue = Record<string, unknown>;
export type FalQueueHandle = { version: 1; requestId: string; statusUrl: string; resultUrl: string };
export type FalVideoResult = {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: { videos: { url: string[] }[] };
  error?: { code: string; message: string };
};
const record = (value: unknown): value is RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value);
function invalid(): never { throw new ProviderError('The video provider response could not be verified. Support must review this generation.', true); }
function failed(value: RecordValue): boolean {
  for (const field of ['error', 'error_type']) {
    if (value[field] !== undefined && value[field] !== null && typeof value[field] !== 'string') invalid();
  }
  return !!(value.error || value.error_type);
}

// The queue may return the app root or the endpoint subpath. Both must belong
// to this exact model and request; no arbitrary queue URLs receive credentials.
function queueUrl(value: unknown, id: string, status: boolean): value is string {
  if (typeof value !== 'string') return false;
  const roots = [`${QUEUE_ORIGIN}/minimax/h3/requests/${id}`, `${QUEUE_ORIGIN}/minimax/h3/reference-to-video/requests/${id}`];
  return roots.some(root => status ? value === `${root}/status` : value === root || value === `${root}/response`);
}
function validateHandle(value: unknown): FalQueueHandle {
  if (!record(value) || value.version !== 1 || typeof value.requestId !== 'string' || !REQUEST_ID.test(value.requestId)
    || !queueUrl(value.statusUrl, value.requestId, true) || !queueUrl(value.resultUrl, value.requestId, false)) invalid();
  return { version: 1, requestId: value.requestId, statusUrl: value.statusUrl, resultUrl: value.resultUrl };
}
function parseHandle(serialized: string): FalQueueHandle {
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { invalid(); }
  return validateHandle(value);
}
class DefinitiveFailure extends Error {}
const TERMINAL_ERROR_TYPES = new Set(['request_timeout', 'startup_timeout', 'runner_scheduling_failure', 'runner_connection_timeout', 'runner_disconnected', 'runner_connection_refused', 'runner_connection_error', 'runner_incomplete_response', 'runner_server_error', 'client_cancelled', 'internal_error']);

async function request(env: Env, url: string, mode: 'submit' | 'status' | 'result', payload?: unknown): Promise<RecordValue> {
  if (!env.FAL_KEY?.trim()) throw new ApiError(503, 'Video generation is not configured.');
  const submission = mode === 'submit';
  let response: Response;
  try {
    response = await fetch(url, {
      method: submission ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(submission ? 30_000 : 20_000),
      headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json', ...(submission ? { 'X-Fal-No-Retry': '1' } : {}) },
      ...(submission ? { body: JSON.stringify(payload) } : {}),
    });
  } catch { throw new ProviderError('The video provider request could not be confirmed.', submission, !submission); }
  let body: unknown;
  try { body = await response.json(); } catch {
    if (response.ok) throw new ProviderError('The video provider returned an unreadable response.', submission, !submission);
  }
  if (!response.ok) {
    // Result reads happen only after a verified COMPLETED state. Structured
    // terminal failures are distinct from transport errors and may be refunded.
    if (mode === 'result' && (response.status === 422 || record(body) && typeof body.error_type === 'string' && TERMINAL_ERROR_TYPES.has(body.error_type))) throw new DefinitiveFailure();
    const redirect = response.status >= 300 && response.status < 400;
    const retryable = redirect || response.status === 408 || response.status === 429 || response.status >= 500;
    throw new ProviderError('The video provider request was not accepted.', submission ? retryable && response.status !== 429 || redirect : !retryable, !submission && retryable);
  }
  if (!record(body)) invalid();
  return body;
}

export async function createFalOzilGoalVideo(env: Env, imageUrl: string): Promise<string> {
  const data = await request(env, `${QUEUE_ORIGIN}/${OZIL_GOAL_CONFIG.endpoint}`, 'submit', {
    prompt: falOzilGoalPrompt(),
    reference_image_urls: [imageUrl],
    reference_video_urls: [`${appOrigin(env)}${OZIL_GOAL_CONFIG.referencePath}`],
    duration: OZIL_GOAL_CONFIG.duration, resolution: '768P', aspect_ratio: OZIL_GOAL_CONFIG.aspect,
    prompt_expansion_mode: 'disabled', enable_safety_checker: true, sync_mode: false,
  });
  const handle = validateHandle({ version: 1, requestId: data.request_id, statusUrl: data.status_url, resultUrl: data.response_url });
  return JSON.stringify(handle);
}

export async function getFalVideo(env: Env, serialized: string): Promise<FalVideoResult> {
  const handle = parseHandle(serialized);
  const status = await request(env, handle.statusUrl, 'status');
  if (status.request_id !== handle.requestId) invalid();
  if (status.status === 'IN_QUEUE' || status.status === 'IN_PROGRESS') {
    if (failed(status)) invalid();
    return { status: status.status === 'IN_QUEUE' ? 'pending' : 'processing' };
  }
  if (status.status !== 'COMPLETED') invalid();
  if (failed(status)) return { status: 'failed' };
  let result: RecordValue;
  try { result = await request(env, handle.resultUrl, 'result'); }
  catch (error) { if (error instanceof DefinitiveFailure) return { status: 'failed' }; throw error; }
  if (failed(result)) return { status: 'failed' };
  if (!record(result.video) || typeof result.video.url !== 'string' || /\s/.test(result.video.url) || !validMediaUrl(result.video.url, env.FAL_MEDIA_HOSTS ?? '')
    || result.video.content_type !== undefined && result.video.content_type !== 'video/mp4') invalid();
  return { status: 'completed', result: { videos: [{ url: [result.video.url] }] } };
}
