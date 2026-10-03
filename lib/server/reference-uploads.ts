import { Input, BufferSource, MP4, WAVE } from 'mediabunny';
import type { CreateVideoRequest } from '../contracts';
import { getVideoSettings } from '../video-options';
import { requireUser } from './auth';
import { appOrigin, database, media, type Env } from './env';
import { ApiError } from './errors';
import { readLimited, sameOrigin } from './security';

type ReferenceKind = 'audio' | 'video';
export type ReferenceMetadata = { kind: ReferenceKind; duration: number; hasAudio: boolean; width?: number; height?: number };
const MiB = 1024 * 1024;
const limits = { video: 20 * MiB, audio: 15 * MiB };
const bad = () => new ApiError(400, 'Please prepare a valid 2–15 second MP4 video or WAV audio clip.');

/** Metadata parsing works in Workers without codec execution; only the browser transcodes. */
export async function inspectReferenceUpload(bytes: Uint8Array, kind: ReferenceKind, mime: string): Promise<ReferenceMetadata> {
  if (!limits[kind] || bytes.length === 0 || bytes.length > limits[kind]) throw new ApiError(413, 'Reference media is too large. Use a video under 20 MB or audio under 15 MB.');
  const text = (start: number, end: number) => new TextDecoder().decode(bytes.subarray(start, end));
  if (kind === 'video' ? mime !== 'video/mp4' || text(4, 8) !== 'ftyp'
    : !['audio/wav', 'audio/x-wav'].includes(mime) || text(0, 4) !== 'RIFF' || text(8, 12) !== 'WAVE') throw bad();
  const input = new Input({ source: new BufferSource(bytes), formats: [MP4, WAVE] });
  try {
    const videos = await input.getVideoTracks(), audios = await input.getAudioTracks();
    const track = kind === 'video' ? videos[0] : audios[0];
    if (!track || videos.length > 1 || audios.length > 1 || (kind === 'audio' && videos.length) || (kind === 'video' && audios.length)) throw bad();
    const first = await track.getFirstTimestamp();
    const end = await track.computeDuration();
    const duration = Math.round((end - Math.max(0, first)) * 1000) / 1000;
    if (!Number.isFinite(first) || first < -0.1 || first > 0.1 || !Number.isFinite(duration) || duration < 1.95 || duration > 15) throw bad();
    if (kind === 'audio') {
      if (await audios[0].getCodec() !== 'pcm-s16' || await audios[0].getSampleRate() !== 44100 || await audios[0].getNumberOfChannels() !== 2) throw bad();
      return { kind, duration, hasAudio: true };
    }
    const v = videos[0];
    const width = await v.getDisplayWidth(), height = await v.getDisplayHeight();
    const stats = await v.computePacketStats(120);
    if (await v.getCodec() !== 'avc' || Math.min(width, height) < 480 || Math.max(width, height) > 1280
      || !Number.isFinite(stats.averagePacketRate) || stats.averagePacketRate < 23.9 || stats.averagePacketRate > 60.1) throw bad();
    return { kind, duration, width, height, hasAudio: false };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw bad();
  } finally { input.dispose(); }
}

export async function saveReferenceUpload(request: Request, env: Env): Promise<Response> {
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env);
  // Bound the multipart envelope as well as the media before buffering it.
  const bytes = await readLimited(request, limits.video + 65536);
  let form: FormData;
  try { form = await new Response(bytes.buffer as ArrayBuffer, { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData(); }
  catch { throw new ApiError(400, 'Invalid reference upload.'); }
  const file = form.get('file'), kind = form.get('kind');
  if ((kind !== 'audio' && kind !== 'video') || !file || typeof file === 'string') throw new ApiError(400, 'Choose a reference video or song.');
  if (file.size > limits[kind]) throw new ApiError(413, 'Reference media is too large. Use a video under 20 MB or audio under 15 MB.');
  const buffer = new Uint8Array(await file.arrayBuffer());
  const metadata = await inspectReferenceUpload(buffer, kind, file.type);
  const key = `users/${user.id}/uploads/${crypto.randomUUID()}`;
  const contentType = kind === 'video' ? 'video/mp4' : 'audio/wav';
  const bucket = media(env);
  await bucket.put(key, buffer, { httpMetadata: { contentType } });
  try {
    await database(env).prepare('INSERT INTO uploads(key,user_id,content_type,media_kind,duration,width,height,has_audio) VALUES(?,?,?,?,?,?,?,?)')
      .bind(key, user.id, contentType, kind, metadata.duration, metadata.width ?? null, metadata.height ?? null, Number(metadata.hasAudio)).run();
  } catch (error) { await bucket.delete(key).catch(() => {}); throw error; }
  return Response.json({ key, ...metadata }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

type Upload = { content_type: string; media_kind: string | null; duration: number | null; has_audio: number | null };
export async function validateVideoUploads(db: D1Database, userId: string, payload: CreateVideoRequest): Promise<number> {
  const upload = (key: string) => db.prepare('SELECT content_type,media_kind,duration,has_audio FROM uploads WHERE key=? AND user_id=?').bind(key, userId).first<Upload>();
  for (const key of [payload.leftImage, payload.rightImage]) {
    const photo = await upload(key);
    if (!photo || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.content_type)) throw new ApiError(400, 'Please upload both photos to your account.');
  }
  const settings = getVideoSettings(payload);
  let referenceDuration = payload.duration;
  if (payload.referenceVideo) {
    const video = await upload(payload.referenceVideo);
    if (!video || video.media_kind !== 'video' || video.content_type !== 'video/mp4' || !video.duration || video.duration < 1.95 || video.duration > 15) throw new ApiError(400, 'Please upload your reference video again.');
    referenceDuration = video.duration;
    if (payload.duration !== Math.max(settings.model === 'wan-3.0' ? 2 : 4, Math.round(referenceDuration))) throw new ApiError(400, 'Video duration must match the selected motion clip.');
  }
  if (payload.referenceAudio) {
    const audio = await upload(payload.referenceAudio);
    if (!audio || audio.media_kind !== 'audio' || audio.content_type !== 'audio/wav' || !audio.duration || audio.duration < 1.95 || audio.duration > 15 || audio.has_audio !== 1) throw new ApiError(400, 'Please upload your selected audio again.');
    if (audio.duration + 0.55 < payload.duration) throw new ApiError(400, 'Choose an audio segment long enough for this video, or shorten the video.');
  }
  return referenceDuration;
}
