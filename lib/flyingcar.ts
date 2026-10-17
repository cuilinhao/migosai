import { getVideoCost } from './video-options';

export const FLYING_CAR_CONFIG = {
  minDuration: 5,
  maxDuration: 30,
  maxSupportedDuration: 30,
  defaultDuration: 10,
  aspect: '9:16',
  resolution: '480p',
  model: 'seedance-2-5',
  provider: 'kie',
  generateAudio: false,
  minPromptLength: 12,
  maxPromptLength: 600,
} as const;

export function getFlyingCarCost(duration: number): number {
  if (!Number.isInteger(duration) || duration < FLYING_CAR_CONFIG.minDuration || duration > FLYING_CAR_CONFIG.maxDuration) {
    throw new Error('Choose a whole-number duration from 5 to 30 seconds.');
  }
  // Keep the established migosai Seedance quote through 15 seconds, then
  // continue its existing 15-credit-per-second final tier for longer clips.
  return duration <= 15 ? getVideoCost(duration, '480p', 'seedance-2')
    : getVideoCost(15, '480p', 'seedance-2') + (duration - 15) * 15;
}

export type FlyingCarPayload = {
  template: 'flyingcar';
  provider: typeof FLYING_CAR_CONFIG.provider;
  model: typeof FLYING_CAR_CONFIG.model;
  aspect: typeof FLYING_CAR_CONFIG.aspect;
  resolution: typeof FLYING_CAR_CONFIG.resolution;
  generateAudio: false;
  duration: number;
  prompt: string;
} & ({ photo: string; consent: true } | { photo?: undefined; consent?: undefined });
