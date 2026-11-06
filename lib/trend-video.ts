import { getFlyingCarCost, type FlyingCarPayload } from './flyingcar';

export const TREND_VIDEO_CONFIG = {
  provider: 'kie', model: 'seedance-2-5', duration: 10,
  resolution: '480p', aspect: '9:16', generateAudio: false,
} as const;
export const TREND_VIDEO_COST = getFlyingCarCost(TREND_VIDEO_CONFIG.duration);
export const TREND_EFFECT_IDS = ['goodbye-2026-welcome-2027', 'stones-to-castle-ai'] as const;
export type TrendEffectId = (typeof TREND_EFFECT_IDS)[number];
export const NEW_YEAR_VARIANTS = ['fur-collar', 'everyone-up', 'arms-wide', 'snow-climb', 'final-seven'] as const;
export type TrendVariantId = (typeof NEW_YEAR_VARIANTS)[number] | 'default';
export type TrendVideoTemplate = { effectId: TrendEffectId; variant: TrendVariantId };

/** Public choices only. Creative instructions are frozen by the server. */
export function getTrendVideoTemplate(effectId: unknown, variant?: unknown): TrendVideoTemplate | undefined {
  if (effectId === 'stones-to-castle-ai') return variant === undefined || variant === 'default' ? { effectId, variant: 'default' } : undefined;
  if (effectId !== 'goodbye-2026-welcome-2027') return undefined;
  const chosen = variant === undefined ? 'fur-collar' : variant;
  return typeof chosen === 'string' && (NEW_YEAR_VARIANTS as readonly string[]).includes(chosen)
    ? { effectId, variant: chosen as TrendVariantId } : undefined;
}

export type TrendVideoPayload = FlyingCarPayload & {
  trendEffect: TrendEffectId; trendVariant: TrendVariantId; workflowVersion: 'trend-video-v1';
  photo: string; consent: true;
};
