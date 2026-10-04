import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GenerationResponse } from '@/lib/contracts';
import { getResumableVideo } from './generation-history';
import { VideoPreview } from './video-preview';

type HistoryItem = GenerationResponse & { kind: string };
const historyItem = (status: GenerationResponse['status'], patch: Partial<HistoryItem> = {}): HistoryItem => ({
  id: `video-${status}`, kind: 'video', status, progress: 50, ...patch,
});

describe('video history restored when opening the generator', () => {
  it.each(['completed', 'failed', 'cancelled'] as const)('does not replace the reference card with an old %s video', status => {
    const previous = historyItem(status, status === 'completed' ? { videoUrl: '/api/media/old-video' } : {});
    const generation = getResumableVideo([previous]);
    const html = renderToStaticMarkup(createElement(VideoPreview, { generation, stage: '', error: '' }));
    expect(html).toContain('The Hotel Lobby look');
    expect(html).toContain('More Hotel Lobby AI videos');
    expect(html).not.toContain('/api/media/old-video');
  });

  it.each(['queued', 'reviewing', 'processing'] as const)('resumes the newest %s video even after newer finished videos or music', status => {
    const active = historyItem(status, { id: 'active-video' });
    const result = getResumableVideo([
      historyItem('completed'), historyItem('processing', { kind: 'music' }),
      historyItem('failed'), active, historyItem('queued', { id: 'older-video' }),
    ]);
    expect(result).toEqual(active);
  });

  it('keeps the reference card when there is no video task to resume', () => {
    expect(getResumableVideo([])).toBeNull();
    expect(getResumableVideo([historyItem('processing', { kind: 'music' })])).toBeNull();
  });
});
