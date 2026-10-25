import type { Env } from './env';

const INFERENCES_URL = 'https://api.seeapi.com/v1/inferences';
const MAX_RESPONSE_BYTES = 128 * 1024;
const TASK_ID = /^[A-Za-z0-9_-]{1,200}$/;

type RecordValue = Record<string, unknown>;
type ModerationAssessment = { verdict: 'pending' | 'passed' | 'blocked'; checkedFrames?: number; flaggedFrames?: number };
export type SeeApiDiagnostic = {
  phase: string; httpStatus?: number; taskStatus?: string; errorCode?: string; frameIndex?: number;
  report?: { schemaVersion?: number; scope?: string; sampling_complete?: boolean; checked_frames?: number; flagged_frame_count?: number; framesLength?: number };
};
const TASK_STATUSES = ['queued', 'processing', 'succeeded', 'failed', 'cancelled'];
// Only fixed classifications are retained; arbitrary strings can carry secrets.
const SAFE_ERROR_CODES = new Set(['failure', 'internal_error', 'server_error', 'provider_error', 'upstream_error',
  'inference_error', 'inference_failed', 'processing_failed', 'validation_error', 'invalid_input', 'invalid_request',
  'timeout', 'request_timeout', 'download_failed', 'video_download_failed', 'video_decode_failed', 'decode_error',
  'ffmpeg_error', 'unsupported_media', 'unsupported_video_format', 'content_policy_blocked', 'runner_server_error', 'MEDIA_INVALID']);
const responseStatuses = new WeakMap<RecordValue, number>();

// Deliberately omit response bodies, provider messages, URLs, and original causes.
// Errors can be persisted or displayed without disclosing credentials or signed media URLs.
export class SeeApiError extends Error {
  constructor(message: string, public retryable = false, public retryAfter: number | undefined = undefined, public diagnostic?: SeeApiDiagnostic) {
    super(message);
    this.name = 'SeeApiError';
  }
}

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function responseDiagnostic(phase: string, value?: unknown, frameIndex?: number): SeeApiDiagnostic {
  const diagnostic: SeeApiDiagnostic = { phase, ...(frameIndex === undefined ? {} : { frameIndex }) };
  if (!record(value)) return diagnostic;
  diagnostic.httpStatus = responseStatuses.get(value);
  diagnostic.taskStatus = value.status === undefined ? 'missing' : typeof value.status === 'string' && TASK_STATUSES.includes(value.status) ? value.status : 'unrecognized';
  if (record(value.error)) diagnostic.errorCode = typeof value.error.code === 'string' && SAFE_ERROR_CODES.has(value.error.code) ? value.error.code : 'unrecognized';
  const output = record(value.result) && record(value.result.data) ? value.result.data.output : undefined;
  if (record(output)) {
    const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1_000_000 ? value : undefined;
    diagnostic.report = {
      schemaVersion: number(output.report_schema_version),
      scope: output.scope === undefined ? 'missing' : output.scope === 'sampled_frames' || output.scope === 'whole_video' ? output.scope : 'unrecognized',
      sampling_complete: typeof output.sampling_complete === 'boolean' ? output.sampling_complete : undefined,
      checked_frames: number(output.checked_frames), flagged_frame_count: number(output.flagged_frame_count),
      framesLength: Array.isArray(output.frames) ? output.frames.length : undefined,
    };
  }
  return diagnostic;
}
function invalidResponse(phase: string, value?: unknown, frameIndex?: number): never {
  throw new SeeApiError('The moderation response could not be verified. Manual review is required.', false, undefined, responseDiagnostic(phase, value, frameIndex));
}
function validTaskId(value: unknown): value is string {
  return typeof value === 'string' && TASK_ID.test(value);
}
function taskIdentity(value: unknown, expectedId?: string): RecordValue {
  if (!record(value) || !validTaskId(value.id) || (expectedId !== undefined && value.id !== expectedId)
    || value.object !== 'inference' || value.model !== 'video-nsfw-filter'
    || value.endpoint !== 'video-moderation' || value.provider !== 'seeapi') invalidResponse('task_identity', value);
  return value;
}
function retryDelay(value: string | null): number | undefined {
  if (value === null) return undefined;
  const header = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(header)) {
    const seconds = Number(header);
    return Number.isFinite(seconds) ? Math.min(600, Math.ceil(seconds)) : undefined;
  }
  // Date.parse also accepts bare numbers and negative values, which are not HTTP dates.
  if (!/^[A-Za-z]{3}, /.test(header)) return undefined;
  const time = Date.parse(header);
  return Number.isFinite(time) ? Math.min(600, Math.max(0, Math.ceil((time - Date.now()) / 1000))) : undefined;
}
async function discardBody(response: Response): Promise<void> {
  try { await response.body?.cancel(); } catch { /* Cancellation must not replace the useful failure. */ }
}
async function boundedJson(response: Response): Promise<unknown> {
  const contentLength = response.headers.get('Content-Length');
  if (contentLength !== null && Number(contentLength) > MAX_RESPONSE_BYTES) {
    await discardBody(response);
    throw new SeeApiError('The moderation response exceeded its size limit.', false, undefined, { phase: 'response_size', httpStatus: response.status });
  }
  if (!response.body) throw new SeeApiError('The moderation service returned an unreadable response.', true, undefined, { phase: 'response_body', httpStatus: response.status });
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new SeeApiError('The moderation response exceeded its size limit.', false, undefined, { phase: 'response_size', httpStatus: response.status });
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch (error) {
    try { await reader.cancel(); } catch { /* Preserve the original classification. */ }
    if (error instanceof SeeApiError) throw error;
    throw new SeeApiError('The moderation service returned an unreadable response.', true, undefined, { phase: 'response_parse', httpStatus: response.status });
  } finally {
    reader.releaseLock();
  }
}
async function request(env: Env, path: string, body?: string, idempotencyKey?: string): Promise<unknown> {
  if (!env.SEEAPI_API_KEY?.trim()) throw new SeeApiError('Video moderation is not configured.', false, undefined, { phase: 'configuration' });
  let response: Response;
  try {
    response = await fetch(INFERENCES_URL + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${env.SEEAPI_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MigosAI-Moderation/1.0 (+https://migosai.design)',
        ...(idempotencyKey === undefined ? {} : { 'Idempotency-Key': idempotencyKey }),
      },
      ...(body === undefined ? {} : { body }),
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SeeApiError('The moderation service could not be reached.', true, undefined, { phase: 'network' });
  }
  if (!response.ok) {
    await discardBody(response);
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    throw new SeeApiError(
      retryable ? 'The moderation service is temporarily unavailable.' : 'The moderation request was rejected. Manual review is required.',
      retryable,
      retryable ? retryDelay(response.headers.get('Retry-After')) : undefined,
      { phase: 'http', httpStatus: response.status },
    );
  }
  const value = await boundedJson(response);
  if (record(value)) responseStatuses.set(value, response.status);
  return value;
}

export async function createVideoModeration(env: Env, body: string, idempotencyKey: string): Promise<{ id: string }> {
  if (!idempotencyKey || idempotencyKey.length > 255 || !/^[\x21-\x7e]+$/.test(idempotencyKey)) {
    throw new SeeApiError('The moderation idempotency key is invalid.', false, undefined, { phase: 'idempotency_key' });
  }
  // Reusing the exact stored body is essential: rebuilding signed URLs breaks idempotency.
  const task = taskIdentity(await request(env, '', body, idempotencyKey));
  if (!TASK_STATUSES.includes(String(task.status))) invalidResponse('task_status', task);
  return { id: task.id as string };
}

export async function getVideoModeration(env: Env, id: string): Promise<ModerationAssessment> {
  if (!validTaskId(id)) throw new SeeApiError('The moderation task identifier is invalid.', false, undefined, { phase: 'task_id' });
  const task = taskIdentity(await request(env, `/${encodeURIComponent(id)}`), id);
  if (task.error !== null) invalidResponse('task_error', task);
  if (task.status === 'queued' || task.status === 'processing') {
    if (task.result !== null) invalidResponse('pending_result', task);
    return { verdict: 'pending' };
  }
  if (task.status !== 'succeeded') invalidResponse('task_status', task);
  if (!record(task.result) || task.result.type !== 'json' || !record(task.result.data)) invalidResponse('result_shape', task);
  const assessment = task.result.data;
  const output = assessment.output;
  // A policy block legitimately has no report. Never require clean-report fields to block.
  if (assessment.flagged === true) {
    const counts: { checkedFrames?: number; flaggedFrames?: number } = {};
    if (record(output) && Number.isInteger(output.checked_frames) && (output.checked_frames as number) >= 1 && (output.checked_frames as number) <= 32) {
      counts.checkedFrames = output.checked_frames as number;
      if (Number.isInteger(output.flagged_frame_count) && (output.flagged_frame_count as number) >= 0 && (output.flagged_frame_count as number) <= counts.checkedFrames) {
        counts.flaggedFrames = output.flagged_frame_count as number;
      }
    }
    return { verdict: 'blocked', ...counts };
  }
  if (assessment.flagged !== false || assessment.reason !== undefined) invalidResponse('assessment_flag', task);
  if (!record(output)) invalidResponse('report_shape', task);
  if (output.nsfw_detected !== false) invalidResponse('report_flag', task);
  if (output.scope !== 'sampled_frames') invalidResponse('report_scope', task);
  if (output.sampling_complete !== true) invalidResponse('report_sampling', task);
  if (output.output_layout !== 'named-files-v1') invalidResponse('report_layout', task);
  if (output.report_schema_version !== 5) invalidResponse('report_schema', task);
  if (output.flagged_frame_count !== 0) invalidResponse('report_flagged_count', task);
  if (!Number.isInteger(output.checked_frames) || (output.checked_frames as number) < 1 || (output.checked_frames as number) > 32) invalidResponse('report_checked_count', task);
  if (!Array.isArray(output.frames) || output.frames.length !== output.checked_frames) invalidResponse('report_frames', task);
  const frameNumbers = new Set<number>();
  for (const [index, frame] of output.frames.entries()) {
    if (!record(frame) || !Number.isSafeInteger(frame.frame_number) || (frame.frame_number as number) <= 0
      || frameNumbers.has(frame.frame_number as number)
      || typeof frame.timestamp_seconds !== 'number' || !Number.isFinite(frame.timestamp_seconds)
      || frame.timestamp_seconds < 0 || frame.timestamp_seconds > 30
      || frame.nsfw_detected !== false || !Array.isArray(frame.nsfw) || frame.nsfw.length !== 0
      || (frame.special !== undefined && (!Array.isArray(frame.special) || frame.special.length !== 0))) invalidResponse('frame_validation', task, index);
    frameNumbers.add(frame.frame_number as number);
  }
  return { verdict: 'passed', checkedFrames: output.checked_frames as number, flaggedFrames: 0 };
}
