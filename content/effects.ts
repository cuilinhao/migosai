import catalog from "./effects-catalog.json";

export type VideoEffect = {
  id: string;
  title: string;
  description: string;
  video: string;
  poster: string;
  isNew: boolean;
  sourcePage: string;
  sourceVideo: string;
  sourcePoster: string;
};

/** The complete public Effects catalog, in the reference page's original order. */
export const videoEffects: readonly VideoEffect[] = catalog;

export function adjacentEffectIndex(current: number, direction: -1 | 1, count: number): number {
  if (count <= 0) return 0;
  return (current + direction + count) % count;
}
