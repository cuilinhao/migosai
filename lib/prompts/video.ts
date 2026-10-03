import type { CreateVideoRequest, VideoScene } from '../contracts';

const scenes: Record<VideoScene, string> = {
  'hotel-lobby': 'A warm orange studio with soft cinematic lighting, a hanging microphone and a minimal seamless background.',
  'luxury-lobby': 'A grand hotel entrance with marble floors, warm chandeliers and elegant lobby architecture.',
  'recording-studio': 'An intimate professional recording booth with acoustic panels, studio microphones and soft moody lighting.',
  'street-cypher': 'An energetic outdoor street cypher with urban textures, night lights and a lively performance atmosphere.',
};

export function videoPrompt(options: CreateVideoRequest, references: { video: boolean; audio: boolean } = { video: false, audio: false }) {
  const orientation = options.aspect === '1:1' ? 'square' : ['16:9', '4:3'].includes(options.aspect) ? 'landscape' : 'portrait';
  const subjects = options.mode === 'pet' ? 'two expressive pets with natural anatomy' : 'two confident performers';
  // Historical reservations must retain their exact original creative direction.
  if (!options.model) return `Create an original ${options.duration}-second ${orientation} music performance in ${options.aspect} framing. A warm orange studio with soft cinematic lighting, a hanging microphone and a minimal seamless background. ${subjects} perform an upbeat original rap together with small rhythmic movements. @图片1 is the left subject and @图片2 is the right subject. Preserve each reference identity consistently, keep the first subject on the left and the second on the right, and keep both visible throughout. Compose for ${orientation} framing with comfortable headroom. Natural expressions, accurate lip sync, subtle camera motion, polished realistic detail. Original instrumental and lyrics, no existing song, no artist imitation, no captions, no logos.`;
  const wan = options.model === 'wan-3.0';
  const image1 = wan ? 'Image1' : '@图片1', image2 = wan ? 'Image2' : '@图片2';
  const video = wan ? 'Video1' : '@视频1', audio = wan ? 'Audio1' : '@音频1';
  const soundtrack = options.soundtrack ?? (wan ? 'template' : 'ai');
  const motion = references.video
    ? `Follow ${video}'s choreography, gestures, timing and performance energy while keeping the identities from the reference images.`
    : 'Use small rhythmic movements and coordinated natural gestures.';
  const sound = soundtrack === 'ai'
    ? `Create an upbeat original rap. Original instrumental and lyrics, no existing song, no artist imitation.${options.topic?.trim() ? ` The rap theme is ${JSON.stringify(options.topic.trim())}.` : ''}`
    : references.audio
      ? `Use ${audio} as the music and vocal reference throughout. Align lip movements, gestures and pacing with its vocals and rhythm. Preserve the supplied musical direction and avoid adding unrelated dialogue.`
      : 'Perform a rhythmic music performance together with synchronized expressions and gestures.';
  return `Create a ${options.duration}-second ${orientation} music performance in ${options.aspect} framing. ${scenes[options.scene ?? 'hotel-lobby']} ${subjects} perform together. ${image1} is the left subject and ${image2} is the right subject. Preserve each reference identity consistently, keep the first subject on the left and the second on the right, and keep both visible throughout. ${motion} ${sound} Compose for ${orientation} framing with comfortable headroom. Natural expressions, accurate lip sync, subtle camera motion, polished realistic detail. No captions, no logos.`;
}
