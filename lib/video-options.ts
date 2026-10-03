import type { AspectRatio, VideoDuration, VideoResolution, CreateVideoRequest, VideoModel, VideoSettings, VideoScene } from './contracts';

export const aspectRatios: readonly AspectRatio[] = ['9:16', '16:9', '1:1', '4:3', '3:4'];
export const videoDurations: readonly VideoDuration[] = [5, 8, 10, 12, 15];
export const videoResolutions: readonly VideoResolution[] = ['480p', '720p', '1080p'];
export const durations = videoDurations;
export const resolutions = videoResolutions;
export const videoModels: readonly { id: VideoModel; label: string; description: string; resolutions: readonly VideoResolution[] }[] = [
  { id: 'wan-3.0', label: 'Wan 3.0', description: 'Your music and reference performance', resolutions: videoResolutions },
  { id: 'seedance-2', label: 'Seedance 2.0', description: 'Original AI rap in any scene', resolutions: videoResolutions },
  { id: 'seedance-2-fast', label: 'Seedance 2.0 Fast', description: 'Faster original AI rap', resolutions: ['480p', '720p'] },
];
export const videoScenes: readonly { id: VideoScene; label: string; description: string }[] = [
  { id: 'hotel-lobby', label: 'Hotel Lobby', description: 'Orange studio and a hanging microphone' },
  { id: 'luxury-lobby', label: 'Luxury lobby', description: 'Warm lights and a grand hotel entrance' },
  { id: 'recording-studio', label: 'Recording studio', description: 'An intimate professional recording booth' },
  { id: 'street-cypher', label: 'Street cypher', description: 'An energetic outdoor rap performance' },
];
export const defaultVideoSettings: VideoSettings = {
  model: 'wan-3.0', scene: 'hotel-lobby', motion: 'template', soundtrack: 'template', topic: '',
  aspect: '9:16', duration: 10, resolution: '480p',
};

/** Explicit settings use the new controls; absent settings keep historical jobs unchanged. */
export function getVideoSettings(p: Partial<VideoSettings>): VideoSettings {
  const model = p.model ?? 'seedance-2';
  return { ...defaultVideoSettings, ...p, model, soundtrack: p.soundtrack ?? (model === 'wan-3.0' ? 'template' : 'ai') };
}

export function updateVideoSettings(current: VideoSettings, patch: Partial<VideoSettings>): VideoSettings {
  const next = { ...current, ...patch };
  if (patch.scene && patch.scene !== 'hotel-lobby' && next.model === 'wan-3.0') next.model = 'seedance-2';
  if (patch.soundtrack && patch.soundtrack !== 'ai') { next.model = 'wan-3.0'; next.scene = 'hotel-lobby'; }
  if (patch.soundtrack === 'ai' && next.model === 'wan-3.0') next.model = 'seedance-2';
  if (next.model === 'wan-3.0') {
    next.scene = 'hotel-lobby';
    if (next.soundtrack === 'ai') next.soundtrack = 'template';
  } else { next.soundtrack = 'ai'; next.duration = Math.max(4, next.duration); }
  if (next.motion === 'template' && next.soundtrack === 'clip') next.soundtrack = 'template';
  if (patch.motion === 'template' && !videoDurations.includes(next.duration)) next.duration = videoDurations.find(d => d >= next.duration) ?? 15;
  if (next.model === 'seedance-2-fast' && next.resolution === '1080p') next.resolution = '720p';
  return next;
}

export function getVideoCost(duration: VideoDuration, resolution: VideoResolution, model: VideoModel = 'seedance-2', referenceDuration = duration): number {
  if (!Number.isInteger(duration) || duration < (model === 'wan-3.0' ? 2 : 4) || duration > 15
    || !videoModels.some(m => m.id === model && m.resolutions.includes(resolution))) throw new Error('Invalid video options');
  if (model === 'wan-3.0') {
    if (!Number.isFinite(referenceDuration) || referenceDuration < 1 || referenceDuration > 15 || referenceDuration + duration > 30.05) throw new Error('Invalid reference duration');
    // Upload validation persists milliseconds; quote from that same precision.
    // Integer arithmetic also avoids adding a credit at floating-point boundaries.
    const referenceMs = Math.round(referenceDuration * 1000);
    return Math.ceil((duration * 1000 + referenceMs) * ({ '480p': 3, '720p': 6, '1080p': 12 }[resolution]) / 1000);
  }
  const base = duration <= 5 ? duration * 10 : duration <= 10 ? 50 + (duration - 5) * 5 : 75 + (duration - 10) * 15;
  return Math.ceil(base * ({ '480p': 1, '720p': 2, '1080p': 4 }[resolution]) * (model === 'seedance-2-fast' ? 0.8 : 1));
}

function key(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 250 && !/[\s:?#[\\\]]/.test(value) && !value.includes('..');
}
export function validateVideo(value: unknown): CreateVideoRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid video options.');
  const p = value as CreateVideoRequest;
  const s = getVideoSettings(p);
  if (!aspectRatios.includes(p.aspect) || !key(p.leftImage) || !key(p.rightImage)
    || (p.mode !== undefined && !['human', 'pet'].includes(p.mode))
    || !videoScenes.some(scene => scene.id === s.scene) || !['template', 'video'].includes(s.motion)
    || !['template', 'song', 'clip', 'ai'].includes(s.soundtrack)
    || (p.topic !== undefined && (typeof p.topic !== 'string' || p.topic.length > 1000))
    || (p.referenceVideo !== undefined && !key(p.referenceVideo)) || (p.referenceAudio !== undefined && !key(p.referenceAudio))) throw new Error('Invalid video options.');
  getVideoCost(p.duration, p.resolution, s.model);
  if ((s.model === 'wan-3.0' && (s.scene !== 'hotel-lobby' || s.soundtrack === 'ai'))
    || (s.model !== 'wan-3.0' && s.soundtrack !== 'ai')
    || (s.motion === 'video' && !p.referenceVideo) || (s.motion === 'template' && p.referenceVideo)
    || (['song', 'clip'].includes(s.soundtrack) && !p.referenceAudio)
    || (['template', 'ai'].includes(s.soundtrack) && p.referenceAudio)
    || (s.soundtrack === 'clip' && s.motion !== 'video')) throw new Error('Invalid video options.');
  const legacy = { leftImage: p.leftImage, rightImage: p.rightImage, aspect: p.aspect, duration: p.duration, resolution: p.resolution, mode: p.mode ?? 'human' };
  const customized = ['model', 'scene', 'motion', 'soundtrack', 'topic', 'referenceVideo', 'referenceAudio'].some(field => Object.hasOwn(p, field));
  return customized ? { ...legacy, model: s.model, scene: s.scene, motion: s.motion, soundtrack: s.soundtrack, topic: (p.topic ?? '').trim(),
    ...(p.referenceVideo ? { referenceVideo: p.referenceVideo } : {}), ...(p.referenceAudio ? { referenceAudio: p.referenceAudio } : {}) } : legacy;
}
