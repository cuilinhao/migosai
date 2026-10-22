import type { CreateImageRequest } from '@/lib/contracts';

export type ImageDraft = Pick<CreateImageRequest, 'prompt' | 'aspect' | 'resolution' | 'outputFormat'>;
export type OwnedImageDraft = { owner: string | null; draft: ImageDraft };

export function createImageDraft(): ImageDraft {
  return { prompt: '', aspect: 'auto', resolution: '1K', outputFormat: 'png' };
}

/** Only unsent visitor text/settings cross sign-in; account drafts never cross accounts. */
export function imageDraftForOwner(previous: OwnedImageDraft, owner: string | null): OwnedImageDraft {
  if (previous.owner === owner) return previous;
  return { owner, draft: previous.owner === null && owner !== null ? previous.draft : createImageDraft() };
}

/** Saved task settings take precedence, while reference uploads stay in the owner-keyed workspace. */
export function imageDraftFromRequest(request: CreateImageRequest): ImageDraft {
  const { prompt, aspect, resolution, outputFormat } = request;
  return { prompt, aspect, resolution, outputFormat };
}
