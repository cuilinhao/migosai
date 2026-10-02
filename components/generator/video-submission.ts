import type { AspectRatio, CreateVideoRequest, GenerationResponse, VideoDuration, VideoResolution } from "@/lib/contracts";

type Options = { aspect: AspectRatio; duration: VideoDuration; resolution: VideoResolution };
export type UploadedPair = { fingerprint: string; leftKey: string; rightKey: string };
export type VideoSubmission = Readonly<{
  key: string;
  fingerprint: string;
  leftFile: File;
  rightFile: File;
  options: Readonly<Options>;
}>;

export function captureVideoSubmission(key: string, fingerprint: string, leftFile: File, rightFile: File, options: Options): VideoSubmission {
  return { key, fingerprint, leftFile, rightFile, options: { ...options } };
}

export async function executeVideoSubmission(
  submission: VideoSubmission,
  cached: UploadedPair | null,
  upload: (file: File) => Promise<{ key: string }>,
  create: (body: CreateVideoRequest, key: string) => Promise<GenerationResponse>,
  onUploaded: (pair: UploadedPair) => void,
): Promise<GenerationResponse> {
  let pair = cached?.fingerprint === submission.fingerprint ? cached : null;
  if (!pair) {
    const [left, right] = await Promise.all([upload(submission.leftFile), upload(submission.rightFile)]);
    pair = { fingerprint: submission.fingerprint, leftKey: left.key, rightKey: right.key };
    onUploaded(pair);
  }
  const body: CreateVideoRequest = { leftImage: pair.leftKey, rightImage: pair.rightKey, ...submission.options, mode: "human" };
  return create(body, submission.key);
}
