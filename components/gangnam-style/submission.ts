import type { GenerationResponse } from '@/lib/contracts';
import type { GangnamStyleAspect, GangnamStyleMode, GangnamStyleRequest, GangnamStyleResolution } from '@/lib/gangnam-style';

export type GangnamStylePhoto = { fingerprint: string; file: File };
export type UploadedGangnamStylePhoto = { fingerprint: string; photo: string };
export type GangnamStyleSubmission = Readonly<{
  key: string;
  mode: GangnamStyleMode;
  photos: readonly Readonly<GangnamStylePhoto>[];
  aspect: GangnamStyleAspect;
  resolution: GangnamStyleResolution;
  consent: true;
}>;

export function captureGangnamStyleSubmission(input: {
  key: string; mode: GangnamStyleMode; photos: readonly GangnamStylePhoto[];
  aspect: GangnamStyleAspect; resolution: GangnamStyleResolution; consent: boolean;
}): GangnamStyleSubmission {
  if (!input.consent) throw new Error('Please confirm photo consent before generating.');
  const count = input.mode === 'selfie' ? 1 : 3;
  if (input.photos.length !== count) throw new Error(count === 1
    ? 'Add one clear photo for Three of you.' : 'Add all three photos: Middle, Right and Left.');
  return Object.freeze({
    key: input.key, mode: input.mode, aspect: input.aspect, resolution: input.resolution, consent: true as const,
    photos: Object.freeze(input.photos.map(photo => Object.freeze({ ...photo }))),
  });
}

export async function executeGangnamStyleSubmission(
  submission: GangnamStyleSubmission,
  cached: readonly UploadedGangnamStylePhoto[],
  upload: (file: File, index: number, total: number) => Promise<{ key: string }>,
  create: (body: GangnamStyleRequest, key: string) => Promise<GenerationResponse>,
  onUploaded: (photo: UploadedGangnamStylePhoto) => void,
  ensureCurrent: () => void,
): Promise<GenerationResponse> {
  ensureCurrent();
  const photos: string[] = [];
  for (const [index, photo] of submission.photos.entries()) {
    ensureCurrent();
    let saved = cached.find(value => value.fingerprint === photo.fingerprint);
    if (!saved) {
      const { key } = await upload(photo.file, index, submission.photos.length);
      ensureCurrent();
      saved = { fingerprint: photo.fingerprint, photo: key };
      // Save each completed role immediately so an interrupted trio can continue.
      onUploaded(saved);
    }
    photos.push(saved.photo);
  }
  ensureCurrent();
  const result = await create({ mode: submission.mode, photos, aspect: submission.aspect,
    resolution: submission.resolution, consent: true }, submission.key);
  ensureCurrent();
  return result;
}
