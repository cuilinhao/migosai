export const KIE_OZIL_GOAL_CONFIG = {
  model: 'seedance-2',
  duration: 15,
  aspect: '9:16',
  resolution: '720p',
  referenceDuration: 15,
  referencePath: '/templates/ozil-goal/motion.mp4',
} as const;

export const OZIL_GOAL_CONFIG = {
  model: 'minimax-h3',
  endpoint: 'minimax/h3/reference-to-video',
  duration: 15,
  aspect: '9:16',
  resolution: '768p',
  referenceDuration: 15,
  referencePath: '/templates/ozil-goal/motion.mp4',
} as const;

// The template's quoted price is stable across provider changes.
export const OZIL_GOAL_COST = 300;

export type OzilGoalPayload = {
  template: 'ozil-goal';
  photo: string;
  consent: true;
} & ((typeof KIE_OZIL_GOAL_CONFIG & { provider: 'kie' }) | (typeof OZIL_GOAL_CONFIG & { provider: 'fal' }));
