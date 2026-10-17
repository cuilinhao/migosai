import type { GenerationResponse } from '@/lib/contracts';
import { FLYING_CAR_CONFIG } from '@/lib/flyingcar';

export const FLYING_CAR_PROMPT_MIN = FLYING_CAR_CONFIG.minPromptLength;
export const FLYING_CAR_PROMPT_MAX = FLYING_CAR_CONFIG.maxPromptLength;
export type FlyingCarPhoto = Readonly<{ fingerprint: string; file: File }>;
export type UploadedFlyingCarPhoto = { fingerprint: string; photo: string };
export type FlyingCarSubmission = Readonly<{
  key: string; prompt: string; duration: number; photo?: FlyingCarPhoto; consent?: true;
}>;
export type FlyingCarRequest = { prompt: string; duration: number; photo?: string; consent?: true };

export function checkFlyingCarPrompt(prompt: string): string | null {
  if (prompt.trim().length < FLYING_CAR_PROMPT_MIN) return `Describe your scene in at least ${FLYING_CAR_PROMPT_MIN} characters — one vivid sentence is enough.`;
  if (prompt.length > FLYING_CAR_PROMPT_MAX) return `Describe your scene in ${FLYING_CAR_PROMPT_MAX} characters or fewer.`;
  return null;
}

export function checkFlyingCarDuration(duration: number): string | null {
  if (!Number.isInteger(duration) || duration < FLYING_CAR_CONFIG.minDuration || duration > FLYING_CAR_CONFIG.maxDuration) {
    return `Choose a whole-number length from ${FLYING_CAR_CONFIG.minDuration} to ${FLYING_CAR_CONFIG.maxDuration} seconds.`;
  }
  if (duration > FLYING_CAR_CONFIG.maxSupportedDuration) return `This video length is not available yet. Choose ${FLYING_CAR_CONFIG.maxSupportedDuration} seconds or less to generate.`;
  return null;
}

export function captureFlyingCarSubmission(input: {
  key: string; prompt: string; duration: number; photo?: FlyingCarPhoto; consent?: boolean;
}): FlyingCarSubmission {
  const error = checkFlyingCarPrompt(input.prompt) ?? checkFlyingCarDuration(input.duration);
  if (error) throw new Error(error);
  if (input.photo && !input.consent) throw new Error('Tick the permission box to use your photo as a reference.');
  return Object.freeze({ key: input.key, prompt: input.prompt.trim(), duration: input.duration,
    ...(input.photo ? { photo: Object.freeze({ ...input.photo }), consent: true as const } : {}) });
}

export async function executeFlyingCarSubmission(
  submission: FlyingCarSubmission,
  cached: UploadedFlyingCarPhoto | null,
  upload: (file: File) => Promise<{ key: string }>,
  create: (body: FlyingCarRequest, key: string) => Promise<GenerationResponse>,
  onUploaded: (photo: UploadedFlyingCarPhoto) => void,
  ensureCurrent: () => void,
): Promise<GenerationResponse> {
  ensureCurrent();
  const body: FlyingCarRequest = { prompt: submission.prompt, duration: submission.duration };
  if (submission.photo) {
    let saved = cached?.fingerprint === submission.photo.fingerprint ? cached : null;
    if (!saved) {
      const { key } = await upload(submission.photo.file);
      ensureCurrent();
      saved = { fingerprint: submission.photo.fingerprint, photo: key };
      onUploaded(saved);
    }
    body.photo = saved.photo;
    body.consent = true;
  }
  ensureCurrent();
  const result = await create(body, submission.key);
  ensureCurrent();
  return result;
}
