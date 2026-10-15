import type { GenerationResponse } from '@/lib/contracts';

export type VideoHistoryItem = GenerationResponse & { kind: string; template?: 'ozil-goal' };

export function getResumableVideo(generations: readonly VideoHistoryItem[], template?: 'ozil-goal'): GenerationResponse | null {
  // Completed history belongs in My Videos; only unfinished work resumes here.
  return generations.find(item => item.kind === 'video' &&
    (template ? item.template === template : item.template !== 'ozil-goal') &&
    ['queued', 'reviewing', 'processing'].includes(item.status)) ?? null;
}
