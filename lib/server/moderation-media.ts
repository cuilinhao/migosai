import { currentUser } from './auth';
import { appOrigin, database, media, type Env } from './env';
import { ApiError } from './errors';
import { mediaResponse, verifyMediaSignature } from './media';
import { hmac, verifyHmac } from './security';

type MediaJob = {
 id: string;
 user_id: string;
 kind: string;
 status: string;
 stage: string;
 result_keys: string | null;
 moderation_verdict?: string | null;
 moderation_key?: string | null;
 moderation_etag?: string | null;
};

function notFound(): never { throw new ApiError(404, 'Media not found.'); }

const validId = /^[\w-]+$/;
const resultKeyPattern = /^users\/([\w-]+)\/results\/([\w-]+)\/([\w-]+)$/;

function moderationMessage(id: string, key: string, etag: string, expires: number) {
 return `video-moderation\n${id}\n${key}\n${etag}\n${expires}`;
}

function validExpiry(expires: number) {
 const now = Math.floor(Date.now() / 1000);
 return Number.isSafeInteger(expires) && expires > now && expires <= now + 3600;
}

export async function createModerationMediaUrl(env: Env, jobId: string, key: string, etag: string, expires: number): Promise<string> {
 if (!env.MEDIA_SIGNING_SECRET) throw new ApiError(503, 'Media signing is not configured.');
 const result = resultKeyPattern.exec(key);
 if (!validId.test(jobId) || !result || result[2] !== jobId || !etag || /[\r\n]/.test(etag) || !validExpiry(expires)) throw new ApiError(400, 'Invalid moderation media reference.');
 const signature = await hmac(env.MEDIA_SIGNING_SECRET, moderationMessage(jobId, key, etag, expires));
 return `${appOrigin(env)}/api/moderation-media/${jobId}?expires=${expires}&signature=${signature}`;
}

async function serveObject(request: Request, env: Env, key: string, etag?: string): Promise<Response> {
 const range = request.headers.get('range');
 // R2 only needs the byte range, never caller credentials or signed URL parameters.
 const options: R2GetOptions = range ? { range: new Headers({ Range: range }) } : {};
 if (etag) options.onlyIf = { etagMatches: etag };
 const object = await media(env).get(key, options);
 // Conditional R2 gets can return metadata without a body on precondition failure.
 if (!object || !('body' in object) || !object.body || (etag && object.etag !== etag)) return notFound();
 return mediaResponse(object, !!range);
}

export async function serveModerationMedia(request: Request, env: Env, id: string): Promise<Response> {
 if (!validId.test(id) || !env.MEDIA_SIGNING_SECRET) return notFound();
 const url = new URL(request.url);
 if (url.searchParams.getAll('expires').length !== 1 || url.searchParams.getAll('signature').length !== 1) return notFound();
 const expires = Number(url.searchParams.get('expires'));
 if (!validExpiry(expires)) return notFound();
 const job = await database(env).prepare('SELECT * FROM generations WHERE id=?').bind(id).first<MediaJob>();
 if (!job || job.kind !== 'video' || ['completed', 'failed', 'cancelled'].includes(job.status)
  || job.moderation_verdict !== 'pending' || !['moderation_submitting', 'moderation_polling'].includes(job.stage)
  || !job.moderation_key || !job.moderation_etag) return notFound();
 const result = resultKeyPattern.exec(job.moderation_key);
 if (!result || result[1] !== job.user_id || result[2] !== id || /[\r\n]/.test(job.moderation_etag)) return notFound();
 if (!await verifyHmac(env.MEDIA_SIGNING_SECRET, moderationMessage(id, job.moderation_key, job.moderation_etag, expires), url.searchParams.get('signature') ?? '')) return notFound();
 return serveObject(request, env, job.moderation_key, job.moderation_etag);
}

export async function serveUserMedia(request: Request, env: Env, key: string): Promise<Response> {
 const match = /^users\/([\w-]+)\/(uploads\/([\w-]+)|results\/([\w-]+)\/([\w-]+))$/.exec(key);
 if (!match) return notFound();
 const upload = match[3] !== undefined;
 let allowed = upload && await verifyMediaSignature(env, key, new URL(request.url));
 let job: MediaJob | null = null;
 if (!allowed) {
  const user = await currentUser(request, env);
  if (!user || user.id !== match[1]) return notFound();
  if (upload) allowed = true;
  else {
   job = await database(env).prepare('SELECT * FROM generations WHERE id=? AND user_id=?').bind(match[4], user.id).first<MediaJob>();
   if (!job || job.status !== 'completed') return notFound();
   let keys: unknown;
   try { keys = JSON.parse(job.result_keys ?? '[]'); } catch { return notFound(); }
   if (!Array.isArray(keys) || !keys.includes(key)) return notFound();
   if (job.kind === 'video' && (job.moderation_verdict !== 'passed' || job.moderation_key !== key || !job.moderation_etag)) return notFound();
   allowed = true;
  }
 }
 if (!allowed) return notFound();
 return serveObject(request, env, key, job?.kind === 'video' ? job.moderation_etag! : undefined);
}
