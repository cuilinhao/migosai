export const WINDOW_PEEPER_CONFIG = {
  model: 'minimax-h3',
  endpoint: 'minimax/h3/reference-to-video',
  duration: 15,
  aspect: '9:16',
  resolution: '768p',
  referenceDuration: 8.2,
  referencePath: '/templates/window-peeper/motion.mp4',
} as const;

export const WINDOW_PEEPER_COST = 300;

export type WindowPeeperPayload = typeof WINDOW_PEEPER_CONFIG & {
  template: 'window-peeper';
  provider: 'fal';
  photo: string;
  consent: true;
};
