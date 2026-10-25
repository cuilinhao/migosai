import type { GenerationResponse } from '@/lib/contracts';

export type UploadedWindowPeeperPhoto = { fingerprint: string; photo: string };
export type WindowPeeperSubmission = Readonly<{ key: string; fingerprint: string; file: File; consent: true }>;

export function captureWindowPeeperSubmission(key: string, fingerprint: string, file: File, consent: boolean): WindowPeeperSubmission {
  if (!consent) throw new Error('Please confirm photo consent before generating.');
  return Object.freeze({ key, fingerprint, file, consent: true });
}

export async function executeWindowPeeperSubmission(
  submission: WindowPeeperSubmission,
  cached: UploadedWindowPeeperPhoto | null,
  upload: (file: File) => Promise<{ key: string }>,
  create: (body: { photo: string; consent: true }, key: string) => Promise<GenerationResponse>,
  onUploaded: (photo: UploadedWindowPeeperPhoto) => void,
  ensureCurrent: () => void,
): Promise<GenerationResponse> {
  ensureCurrent();
  let saved = cached?.fingerprint === submission.fingerprint ? cached : null;
  if (!saved) {
    const { key } = await upload(submission.file);
    ensureCurrent();
    saved = { fingerprint: submission.fingerprint, photo: key };
    onUploaded(saved);
  }
  ensureCurrent();
  const result = await create({ photo: saved.photo, consent: true }, submission.key);
  ensureCurrent();
  return result;
}
