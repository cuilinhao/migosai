import type { Locale } from '@/lib/i18n/routing';
import { NEW_YEAR_VARIANTS, type TrendEffectId, type TrendVariantId } from '@/lib/trend-video';
import { getWindowPeeperCopy } from './window-peeper';
import { trendCommon } from './trend-video/common';
import { newYearStories } from './trend-video/new-year';
import { castleStories } from './trend-video/castle';

// Reuse the established, translated account and upload vocabulary without importing page-specific copy.
const sharedKeys = ['photoLabel','uploadTitle','uploadFormats','replacePhoto','removePhoto','selectedPhoto','privacyLink','model','duration','resolution','format','consent','terms','aiDisclosure','generate','checkingAccount','preparing','uploading','starting','generating','queued','reviewing','credits','available','buyCredits','signInNote','refundNote','savedNote','myVideos','leaveNote','pollRetry','uploadProgress','videoProgress','download','viewRecord','invalidType','invalidSize','missingPhoto','missingConsent','insufficientCredits','createFailed','generationFailed','trust'] as const;
export function getTrendVideoCopy(effectId: TrendEffectId, locale: Locale) {
  const base = getWindowPeeperCopy(locale);
  const shared = Object.fromEntries(sharedKeys.map(key => [key, base[key]])) as Pick<typeof base, (typeof sharedKeys)[number]>;
  const story = (effectId === 'goodbye-2026-welcome-2027' ? newYearStories : castleStories)[locale];
  return { ...shared, ...trendCommon[locale], ...story, generatorTitle: story.seoTitle.replace(' | MigosAI','') };
}
export type TrendVideoCopy = ReturnType<typeof getTrendVideoCopy>;
export type TrendVideoReference = { video: string; poster: string; source: string; author: string; variant: TrendVariantId };
const kavelNames = ['goodbye-2026-woman-climbs-2027','goodbye-2026-climb-giant-2027','goodbye-2026-gen-fur-stand','goodbye-2026-gen-crouch','goodbye-2026-gen-snow-seven'];
const castleFiles = [
  ['cb2bddc6-eb8e-4468-b627-ea4fd0bd82d0','31898ada-8e11-4e46-b659-7b670bf0a9fb'],
  ['3adfb4b5-7837-4107-b15d-c8423c4af285','34ca6909-80fd-4baf-b46d-0cb3cb9ba626'],
  ['e99389d8-e2ea-44ff-9b97-48b2d592095e','955cdaab-96f5-4cc1-8cf9-0eaa8edc4338'],
  ['783ad2d7-7f2c-454b-a4f9-13c72f503e7a','4ab3ff1e-985e-4f74-a863-e459262cac27'],
];
const references: Record<TrendEffectId, TrendVideoReference[]> = {
  'goodbye-2026-welcome-2027': kavelNames.map((name, index) => ({video:`https://cdn.kavel.ai/videos/kavel-showcase/${name}.mp4`,poster:`https://cdn.kavel.ai/posters/kavel-showcase/${name}-poster.webp`,source:'https://www.kavel.ai/video/goodbye-2026-welcome-2027',author:'Kavel',variant:NEW_YEAR_VARIANTS[index]})),
  'stones-to-castle-ai': castleFiles.map(([video,poster]) => ({video:`https://cdn.goenhance.ai/static/site/202611/${video}.mp4`,poster:`https://cdn.goenhance.ai/static/site/202611/${poster}.jpg`,source:'https://www.goenhance.ai/video-effects/stones-to-castle-ai',author:'GoEnhance',variant:'default'})),
};
export function trendVideoReferences(effectId: TrendEffectId): readonly TrendVideoReference[] { return references[effectId]; }

export function translateTrendVideoMessage(source: string, copy: TrendVideoCopy, fallback: (source: string) => string): string {
  const size = source.match(/^Your prepared photo is (\d+) × (\d+) pixels\./);
  if (size) return copy.dimensionsError.replace('{width}',size[1]).replace('{height}',size[2]);
  if (source === 'Choose a photo with each side from 301 to 5,999 pixels and a width-to-height ratio greater than 0.4 and less than 2.5.') return copy.dimensionsHint;
  if (source === 'Could not read this photo. Choose a valid JPEG, PNG or WebP photo and try again.') return copy.unreadablePhoto;
  if (['Invalid video effect options.','Video effect settings are managed by the server.','Choose an available video effect and variant.'].includes(source)) return copy.invalidOptions;
  return fallback(source);
}
