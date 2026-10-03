import type { AspectRatio, CreateVideoRequest, GenerationResponse, VideoDuration, VideoResolution, VideoSettings } from '@/lib/contracts';

type Options = { aspect: AspectRatio; duration: VideoDuration; resolution: VideoResolution } & Partial<VideoSettings>;
type References = { video?: File; audio?: File };
export type UploadedPair = { fingerprint: string; leftKey: string; rightKey: string; videoKey?: string; audioKey?: string };
export type VideoSubmission = Readonly<{ key: string; fingerprint: string; leftFile: File; rightFile: File; options: Readonly<Options>; references: Readonly<References> }>;
export function captureVideoSubmission(key: string, fingerprint: string, leftFile: File, rightFile: File, options: Options, references: References = {}): VideoSubmission {
  return Object.freeze({ key, fingerprint, leftFile, rightFile, options: Object.freeze({ ...options }), references: Object.freeze({ ...references }) });
}
export async function executeVideoSubmission(
  submission: VideoSubmission, cached: UploadedPair | null,
  upload: (file: File, side: 'left' | 'right') => Promise<{ key: string }>,
  create: (body: CreateVideoRequest, key: string) => Promise<GenerationResponse>,
  onUploaded: (pair: UploadedPair) => void,
  uploadReference?: (file: File, kind: 'audio' | 'video') => Promise<{ key: string }>,
): Promise<GenerationResponse> {
  const video = submission.options.motion === 'video' ? submission.references.video : undefined;
  const needsAudio = submission.options.soundtrack === 'song' || submission.options.soundtrack === 'clip';
  const audio = needsAudio ? submission.references.audio : undefined;
  if ((submission.options.motion === 'video' && !video) || (needsAudio && !audio)) throw new Error('Choose the selected reference media before generating.');
  if ((video || audio) && !uploadReference) throw new Error('Could not upload reference media.');
  let pair = cached?.fingerprint === submission.fingerprint ? cached : null;
  if (!pair) {
    const [left, right, refVideo, refAudio] = await Promise.all([
      upload(submission.leftFile, 'left'), upload(submission.rightFile, 'right'),
      video ? uploadReference!(video, 'video') : undefined,
      audio ? uploadReference!(audio, 'audio') : undefined,
    ]);
    pair = { fingerprint: submission.fingerprint, leftKey: left.key, rightKey: right.key,
      ...(refVideo ? { videoKey: refVideo.key } : {}), ...(refAudio ? { audioKey: refAudio.key } : {}) };
    onUploaded(pair);
  }
  const { topic, ...options } = submission.options;
  const body: CreateVideoRequest = { leftImage: pair.leftKey, rightImage: pair.rightKey, ...options, mode: 'human',
    ...(options.soundtrack === 'ai' ? { topic: (topic ?? '').trim() } : {}),
    ...(video && pair.videoKey ? { referenceVideo: pair.videoKey } : {}), ...(audio && pair.audioKey ? { referenceAudio: pair.audioKey } : {}) };
  return create(body, submission.key);
}
