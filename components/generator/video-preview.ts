"use client";

import { useLocale } from '@/components/i18n/locale-provider';
import { useGenerationTranslations } from './use-generation';
import { createElement } from 'react';
import { Video } from 'lucide-react';
import type { GenerationResponse } from '@/lib/contracts';

type Props = { generation: GenerationResponse | null; stage: string; error: string; pollError?: string };

export function VideoPreview({ generation, stage, error, pollError }: Props) {
  const t = useGenerationTranslations();
  const locale = useLocale();
  const ready = generation?.status === 'completed' && Boolean(generation.videoUrl);
  const pending = generation && !['completed', 'failed', 'cancelled'].includes(generation.status);
  const problem = error || generation?.error || '';
  const message = problem || (generation?.status === 'completed'
    ? 'This video is unavailable until its safety review is completed.'
    : generation?.status === 'failed' || generation?.status === 'cancelled'
      ? 'Video generation could not be completed.'
      : generation?.statusMessage || (generation?.status === 'queued'
        ? 'Waiting to start…'
        : generation?.status === 'reviewing' ? 'Reviewing your photos…' : 'Generating your video…'));
  const percentage = Math.min(99, Math.max(0, Math.round(generation?.progress ?? 0)));

  let media;
  let caption;
  if (ready) {
    media = createElement('video', { key: generation.videoUrl, src: generation.videoUrl, controls: true, playsInline: true, preload: 'metadata' });
    caption = 'Your generated video is ready to watch and download.';
  } else if (pending) {
    media = createElement('div', { className: 'mi-preview-placeholder', role: 'status' },
      createElement('span', null, t(message)),
      createElement('strong', null, new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(percentage / 100)),
      pollError && createElement('small', { role: 'alert' }, t(pollError)));
    caption = 'Your current video request is in progress.';
  } else if (problem || generation) {
    media = createElement('div', { className: 'mi-preview-placeholder', role: 'alert' }, t(message));
    caption = 'This video is not available to play.';
  } else if (stage) {
    media = createElement('div', { className: 'mi-preview-placeholder', role: 'status' }, t(stage));
    caption = 'Your current video request is in progress.';
  } else {
    media = createElement('video', { src: '/videos/preview.mp4', poster: '/posters/preview.jpg', controls: true, playsInline: true, preload: 'metadata' });
    caption = 'Reference preview · Upload two photos to generate';
  }

  return createElement('div', { className: 'mi-video-preview mi-panel' },
    createElement('h2', null, createElement(Video, { size: 17 }), ' ', t('Video Preview')),
    createElement('div', { className: 'mi-preview-media' }, media),
    createElement('p', null, t(caption)));
}
