import { getVideoCost } from './video-options';

export const GANGNAM_STYLE_REFERENCE_PATH = '/gangnam-style/photo-trio-seoul-with-audio.mp4';
export const GANGNAM_STYLE_CONFIG = {
  provider: 'kie', model: 'seedance-2-5', duration: 15, generateAudio: false,
} as const;
export const GANGNAM_STYLE_ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'auto'] as const;
export const GANGNAM_STYLE_RESOLUTIONS = ['480p', '720p'] as const;
export const GANGNAM_STYLE_MODES = ['friends', 'selfie', 'pets'] as const;
export type GangnamStyleMode = typeof GANGNAM_STYLE_MODES[number];
export type GangnamStyleAspect = typeof GANGNAM_STYLE_ASPECTS[number];
export type GangnamStyleResolution = typeof GANGNAM_STYLE_RESOLUTIONS[number];
export type GangnamStyleRequest = {
  mode: GangnamStyleMode;
  /** Friends/pets: middle, right, left. Selfie: one identity for all three dancers. */
  photos: string[];
  aspect: GangnamStyleAspect;
  resolution: GangnamStyleResolution;
  consent: true;
};
export type GangnamStylePayload = GangnamStyleRequest & typeof GANGNAM_STYLE_CONFIG & {
  template: 'gangnam-style';
  prompt: string;
};
export function getGangnamStyleCost(resolution: GangnamStyleResolution): number {
  if (!GANGNAM_STYLE_RESOLUTIONS.includes(resolution)) throw new Error('Choose 480p or 720p.');
  // Preserve the established site Seedance quote: FlyingCar already uses this
  // 480p schedule for Seedance 2.5; the existing 720p multiplier remains 2×.
  return getVideoCost(GANGNAM_STYLE_CONFIG.duration, resolution, 'seedance-2');
}
