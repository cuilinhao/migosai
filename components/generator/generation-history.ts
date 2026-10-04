import type { GenerationResponse } from '@/lib/contracts';

export function getResumableVideo(generations: readonly (GenerationResponse & { kind: string })[]): GenerationResponse | null {
  // Completed history belongs in My Videos; only unfinished work resumes here.
  return generations.find(item => item.kind === 'video' &&
    ['queued', 'reviewing', 'processing'].includes(item.status)) ?? null;
}
