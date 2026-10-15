import type { GenerationResponse } from '@/lib/contracts';

export type UploadedOzilPhoto = { fingerprint: string; photo: string };
export type OzilSubmission = Readonly<{ key: string; fingerprint: string; file: File; consent: true }>;

export function captureOzilSubmission(key: string, fingerprint: string, file: File, consent: boolean): OzilSubmission {
  if (!consent) throw new Error('Please confirm photo consent before generating.');
  return Object.freeze({ key, fingerprint, file, consent: true });
}

export async function executeOzilSubmission(
  submission: OzilSubmission,
  cached: UploadedOzilPhoto | null,
  upload: (file: File) => Promise<{ key: string }>,
  create: (body: { photo: string; consent: true }, key: string) => Promise<GenerationResponse>,
  onUploaded: (photo: UploadedOzilPhoto) => void,
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
  return create({ photo: saved.photo, consent: true }, submission.key);
}
