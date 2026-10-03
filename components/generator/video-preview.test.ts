import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GenerationResponse } from '@/lib/contracts';
import { VideoPreview } from './video-preview';

const render = (generation: GenerationResponse | null, stage = '', error = '', pollError = '') =>
  renderToStaticMarkup(createElement(VideoPreview, { generation, stage, error, pollError }));

describe('current video preview', () => {
  it('shows an explicitly labelled reference only before a request starts', () => {
    const html = render(null);
    expect(html).toContain('/videos/preview.mp4');
    expect(html).toContain('Reference preview');
  });

  it('shows current task progress without playing the reference while generation is pending', () => {
    const html = render({ id: 'job-1', status: 'reviewing', progress: 55, statusMessage: 'Checking video safety before delivery…' });
    expect(html).toContain('Checking video safety before delivery');
    expect(html).toContain('55%');
    expect(html).not.toContain('/videos/preview.mp4');
    expect(html).not.toContain('<video');
  });

  it('keeps a pending job visible and prioritizes its server error over a generic review label', () => {
    const html = render({ id: 'job-retry', status: 'reviewing', progress: 67, error: 'Safety review needs attention.', statusMessage: 'Reviewing your photos…' });
    expect(html).toContain('Safety review needs attention.');
    expect(html).toContain('67%');
    expect(html).toContain('Your current video request is in progress.');
    expect(html).not.toContain('This video is not available to play.');
    expect(html).not.toContain('<video');
  });

  it('shows a temporary polling error beside pending progress without treating the job as terminal', () => {
    const html = render({ id: 'job-poll', status: 'processing', progress: 72, statusMessage: 'Generating your video…' }, '', '', 'Status check failed. Retrying…');
    expect(html).toContain('Generating your video');
    expect(html).toContain('72%');
    expect(html).toContain('Status check failed. Retrying');
    expect(html).toContain('Your current video request is in progress.');
    expect(html).not.toContain('This video is not available to play.');
    expect(html).not.toContain('<video');
  });

  it('shows an upload stage without presenting the reference as the requested result', () => {
    const html = render(null, 'Uploading photos…');
    expect(html).toContain('Uploading photos');
    expect(html).not.toContain('/videos/preview.mp4');
  });

  it('shows the failure reason without a playable reference video', () => {
    const html = render({ id: 'job-2', status: 'failed', progress: 65, error: 'Image review failed.' });
    expect(html).toContain('Image review failed.');
    expect(html).not.toContain('/videos/preview.mp4');
    expect(html).not.toContain('<video');
  });

  it('plays the approved media URL as soon as the current job completes', () => {
    const html = render({ id: 'job-3', status: 'completed', progress: 100, videoUrl: '/api/media/users/u/results/video' });
    expect(html).toContain('src="/api/media/users/u/results/video"');
    expect(html).toContain('controls');
    expect(html).not.toContain('/videos/preview.mp4');
    expect(html).not.toContain('/posters/preview.jpg');
  });

  it('keeps a completed but unreleased video private', () => {
    const html = render({ id: 'job-4', status: 'completed', progress: 100, error: 'Safety review required.' });
    expect(html).toContain('Safety review required.');
    expect(html).not.toContain('<video');
  });
});
