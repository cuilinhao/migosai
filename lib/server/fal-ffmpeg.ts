import { appOrigin, type Env } from './env';
import { ApiError } from './errors';
import type { FalQueueHandle, FalVideoResult } from './fal';
import { ProviderError } from './provider';
import { validMediaUrl } from './security';

const QUEUE_ORIGIN = 'https://queue.fal.run';
const APP = 'fal-ai/ffmpeg-api';
const ENDPOINT = `${APP}/merge-audio-video`;
const REQUEST_ID = /^[A-Za-z0-9_-]{1,200}$/;
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value);
function invalid(): never {
  throw new ProviderError('The video soundtrack provider response could not be verified. Support must review this generation.', true);
}
function failed(value: RecordValue): boolean {
  for (const field of ['error', 'error_type']) {
    if (value[field] !== undefined && value[field] !== null && typeof value[field] !== 'string') invalid();
  }
  return !!(value.error || value.error_type);
}
export function isSoundtrackMediaUrl(value: unknown, hosts: string): value is string {
  return typeof value === 'string' && /^https:\/\//.test(value)
    && !/[\s\\#\u0000-\u001f\u007f]/.test(value) && !/^https:\/\/[^/?#]*@/.test(value)
    && validMediaUrl(value, hosts);
}

// Keep the provider's returned namespace. Never guess a replacement after a
// 404/405, and never send the key to another app, request, query or origin.
function queueUrl(value: unknown, id: string, status: boolean): value is string {
  if (typeof value !== 'string') return false;
  return [APP, ENDPOINT].some(path => {
    const root = `${QUEUE_ORIGIN}/${path}/requests/${id}`;
    return status ? value === `${root}/status` : value === root || value === `${root}/response`;
  });
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
  if (!env.FAL_KEY?.trim()) throw new ApiError(503, 'Video soundtrack processing is not configured.');
  const submission = mode === 'submit';
  let response: Response;
  try {
    response = await fetch(url, {
      method: submission ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(submission ? 30_000 : 20_000),
      headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json', ...(submission ? { 'X-Fal-No-Retry': '1' } : {}) },
      ...(submission ? { body: JSON.stringify(payload) } : {}),
    });
  } catch { throw new ProviderError('The video soundtrack provider request could not be confirmed.', submission, !submission); }
  let body: unknown;
  try { body = await response.json(); } catch {
    if (response.ok) throw new ProviderError('The video soundtrack provider returned an unreadable response.', submission, !submission);
  }
  if (!response.ok) {
    // Only a verified COMPLETED task reaches this result read. A structured
    // terminal failure is distinct from a retryable GET transport failure.
    if (mode === 'result' && (response.status === 422 || record(body) && typeof body.error_type === 'string' && TERMINAL_ERROR_TYPES.has(body.error_type))) throw new DefinitiveFailure();
    const redirect = response.status >= 300 && response.status < 400;
    const retryable = redirect || response.status === 408 || response.status === 429 || response.status >= 500;
    throw new ProviderError('The video soundtrack provider request was not accepted.', submission ? retryable && response.status !== 429 : !retryable, !submission && retryable);
  }
  if (!record(body)) invalid();
  return body;
}

async function createFalSoundtrack(env: Env, videoUrl: string, sourceHosts: string, soundtrackPath: string): Promise<string> {
  if (!isSoundtrackMediaUrl(videoUrl, sourceHosts)) throw new ProviderError('The source video URL could not be verified.');
  const data = await request(env, `${QUEUE_ORIGIN}/${ENDPOINT}`, 'submit', {
    video_url: videoUrl,
    audio_url: `${appOrigin(env)}${soundtrackPath}`,
    start_offset: 0,
  });
  return JSON.stringify(validateHandle({ version: 1, requestId: data.request_id, statusUrl: data.status_url, resultUrl: data.response_url }));
}
export function createFalWindowPeeperAudio(env: Env, videoUrl: string): Promise<string> {
  return createFalSoundtrack(env, videoUrl, env.FAL_MEDIA_HOSTS ?? '', '/templates/window-peeper/soundtrack.m4a');
}
export function createFalGangnamStyleAudio(env: Env, videoUrl: string): Promise<string> {
  return createFalSoundtrack(env, videoUrl, env.KIE_MEDIA_HOSTS ?? '', '/gangnam-style/soundtrack.m4a');
}

export async function getFalWindowPeeperAudio(env: Env, serialized: string): Promise<FalVideoResult> {
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
  // Fal's File schema permits absent/null content_type. The media persistence
  // boundary still validates the actual downloaded MP4 before it can be used.
  if (!record(result.video) || !isSoundtrackMediaUrl(result.video.url, env.FAL_MEDIA_HOSTS ?? '')
    || result.video.content_type != null && result.video.content_type !== 'video/mp4') invalid();
  return { status: 'completed', result: { videos: [{ url: [result.video.url] }] } };
}
// Both templates use the same FFmpeg queue endpoint and response contract.
export const getFalGangnamStyleAudio = getFalWindowPeeperAudio;
