import type { GenerationResponse } from '@/lib/contracts';
import type { TrendEffectId, TrendVariantId } from '@/lib/trend-video';

export type UploadedTrendPhoto = { fingerprint: string; photo: string };
export type TrendSubmission = Readonly<{ key: string; fingerprint: string; file: File; consent: true; effectId: TrendEffectId; variant: TrendVariantId }>;
export type TrendCreateBody = { effectId: TrendEffectId; variant: TrendVariantId; photo: string; consent: true };

export function captureTrendSubmission(key: string, fingerprint: string, file: File, consent: boolean, effectId: TrendEffectId, variant: TrendVariantId): TrendSubmission {
  if (!consent) throw new Error('Please confirm photo consent before generating.');
  return Object.freeze({ key, fingerprint, file, consent: true, effectId, variant });
}

export async function executeTrendSubmission(
  submission: TrendSubmission,
  cached: UploadedTrendPhoto | null,
  upload: (file: File) => Promise<{ key: string }>,
  create: (body: TrendCreateBody, key: string) => Promise<GenerationResponse>,
  onUploaded: (photo: UploadedTrendPhoto) => void,
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
  const result = await create({ effectId: submission.effectId, variant: submission.variant, photo: saved.photo, consent: true }, submission.key);
  ensureCurrent();
  return result;
}
