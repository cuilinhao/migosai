import type { GenerationResponse } from '@/lib/contracts';

export type VideoTemplate = 'ozil-goal' | 'flyingcar' | 'window-peeper' | 'gangnam-style';
export type VideoHistoryItem = GenerationResponse & { kind: string; template?: VideoTemplate };

export function getResumableVideo(generations: readonly VideoHistoryItem[], template?: VideoTemplate): GenerationResponse | null {
  // Completed history belongs in My Videos; only unfinished work resumes here.
  return generations.find(item => item.kind === 'video' &&
    (template ? item.template === template : !item.template) &&
    ['queued', 'reviewing', 'processing'].includes(item.status)) ?? null;
}
