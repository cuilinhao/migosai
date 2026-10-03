import type { CreateVideoRequest, VideoModel } from '../contracts';
import { videoPrompt } from '../prompts/video';
import type { Env } from './env';
import { ApiError } from './errors';
import { ProviderError } from './provider';

const API_URL = 'https://api.kie.ai/api/v1/jobs';
const MODELS: Record<VideoModel, string> = {
  'wan-3.0': 'wan/3-0-video',
  'seedance-2': 'bytedance/seedance-2',
  'seedance-2-fast': 'bytedance/seedance-2-fast',
};
export type KieVideoReferences = { videoUrls?: string[]; audioUrls?: string[] };
const TASK_ID = /^[A-Za-z0-9_-]{1,200}$/;
const BUSINESS_REJECTIONS = new Set([400, 401, 402, 403, 404, 405, 409, 413, 415, 422, 429, 433, 455, 501, 505]);

type RecordValue = Record<string, unknown>;
export type KieVideoResult = {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: { videos: { url: string[] }[] };
  error?: { code: string; message: string };
};

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validTaskId(value: unknown): value is string {
  return typeof value === 'string' && TASK_ID.test(value);
}
function empty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}
function invalidResponse(): never {
  throw new ProviderError('The video provider response could not be verified. Support must review this generation before it can be retried.', true);
}
function mediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

// Provider errors may be persisted or shown to users. Never include raw bodies,
// messages, original causes, credentials, or signed media URLs in these errors.
async function request(env: Env, path: string, payload?: unknown): Promise<RecordValue> {
  if (!env.KIE_API_KEY?.trim()) throw new ApiError(503, 'Video generation is not configured.');
  const submission = payload !== undefined;
  let response: Response;
  try {
    response = await fetch(API_URL + path, {
      method: submission ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${env.KIE_API_KEY}`, 'Content-Type': 'application/json' },
      ...(submission ? { body: JSON.stringify(payload) } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ProviderError('The video provider request could not be confirmed.', submission, !submission);
  }
  if (!response.ok) {
    try { await response.body?.cancel(); } catch { /* Preserve the request classification. */ }
    const redirect = response.status >= 300 && response.status < 400;
    const uncertain = submission && (redirect || response.status === 408 || response.status >= 500);
    const transientQuery = !submission && (redirect || response.status === 408 || response.status === 429 || response.status >= 500);
    throw new ProviderError('The video provider request was not accepted.', uncertain, transientQuery);
  }
  let body: unknown;
  try { body = await response.json(); } catch {
    throw new ProviderError('The video provider returned an unreadable response.', submission, !submission);
  }
  if (!record(body) || !Number.isInteger(body.code)) invalidResponse();
  if (body.code !== 200) {
    const code = body.code as number;
    const transientQuery = !submission && (code === 408 || code === 429 || code === 455
      || (code >= 500 && !BUSINESS_REJECTIONS.has(code)));
    throw new ProviderError('The video provider could not accept this request.', submission && !BUSINESS_REJECTIONS.has(code), transientQuery);
  }
  if (!record(body.data)) invalidResponse();
  return body.data;
}

export async function createKieVideo(env: Env, payload: CreateVideoRequest, imageUrls: string[], references: KieVideoReferences = {}): Promise<string> {
  const model = payload.model ?? 'seedance-2';
  const providerModel = MODELS[model];
  if (!providerModel) throw new ProviderError('The selected video model is unavailable.');
  const hasVideo = !!references.videoUrls?.length, hasAudio = !!references.audioUrls?.length;
  const data = await request(env, '/createTask', {
    model: providerModel,
    input: {
      reference_image_urls: imageUrls,
      ...(hasVideo ? { reference_video_urls: references.videoUrls } : {}),
      ...(hasAudio ? { reference_audio_urls: references.audioUrls } : {}),
      prompt: videoPrompt(payload, { video: hasVideo, audio: hasAudio }),
      duration: payload.duration,
      resolution: model === 'wan-3.0' ? payload.resolution.toUpperCase() : payload.resolution,
      aspect_ratio: payload.aspect,
      ...(model === 'wan-3.0' ? { audio: true } : { generate_audio: true }),
      nsfw_checker: true,
    },
  });
  if (!validTaskId(data.taskId)) invalidResponse();
  return data.taskId;
}

export async function getKieVideo(env: Env, taskId: string, model: VideoModel = 'seedance-2'): Promise<KieVideoResult> {
  if (!validTaskId(taskId)) throw new ProviderError('The video task identifier is invalid.');
  const providerModel = MODELS[model];
  if (!providerModel) invalidResponse();
  const data = await request(env, `/recordInfo?taskId=${encodeURIComponent(taskId)}`);
  if (data.taskId !== taskId || (data.model !== undefined && data.model !== providerModel)) invalidResponse();
  if (data.state === 'success') {
    if (!empty(data.failCode) || !empty(data.failMsg) || typeof data.resultJson !== 'string') invalidResponse();
    let result: unknown;
    try { result = JSON.parse(data.resultJson); } catch { invalidResponse(); }
    if (!record(result) || !Array.isArray(result.resultUrls) || result.resultUrls.length < 1
      || result.resultUrls.length > 4 || !result.resultUrls.every(mediaUrl)) invalidResponse();
    return { status: 'completed', result: { videos: [{ url: result.resultUrls }] } };
  }
  if (!empty(data.resultJson)) invalidResponse();
  if (data.state === 'fail') {
    if ((!empty(data.failCode) && typeof data.failCode !== 'string')
      || (!empty(data.failMsg) && typeof data.failMsg !== 'string')) invalidResponse();
    const policyBlocked = typeof data.failCode === 'string'
      && ['content_policy_blocked', 'content_policy_violation', 'safety_rejected'].includes(data.failCode.toLowerCase());
    return { status: 'failed', error: policyBlocked
      ? { code: 'content_policy_blocked', message: 'The generation service rejected this content.' }
      : { code: 'task_failed', message: 'The video generation could not be completed.' } };
  }
  if (!empty(data.failCode) || !empty(data.failMsg)) invalidResponse();
  if (data.state === 'waiting' || data.state === 'queuing') return { status: 'pending' };
  if (data.state === 'generating') return { status: 'processing' };
  invalidResponse();
}
