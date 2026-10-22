import type { ImageResolution } from './contracts';

export const IMAGE_ASPECTS = ['auto', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '5:4', '21:9', '1:4', '4:1', '1:8', '8:1'] as const;
export const IMAGE_RESOLUTIONS = ['1K', '2K', '4K'] as const;
export const IMAGE_FORMATS = ['png', 'jpg'] as const;
export const IMAGE_MAX_REFERENCES = 10;

export function imageCreditCost(resolution: ImageResolution): number {
  if (resolution === '1K') return 5;
  if (resolution === '2K') return 8;
  if (resolution === '4K') return 12;
  throw new Error('Choose a supported image resolution.');
}
