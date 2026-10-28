import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GangnamStyleGenerator } from '@/components/gangnam-style/generator';

const state = vi.hoisted(() => ({
  generation: null as import('@/lib/contracts').GenerationResponse | null,
  user: { id: 'alice', name: 'Alice', email: 'alice@example.test' } as import('@/lib/contracts').User | null,
  loading: false,
}));
vi.mock('@/components/auth-provider', () => ({ useAuth: () => ({ user: state.user, credits: 500, loading: state.loading, openSignIn: () => {}, refresh: async () => {} }) }));
vi.mock('@/components/generator/use-generation', async importOriginal => ({
  ...await importOriginal<typeof import('@/components/generator/use-generation')>(),
  useGeneration: () => ({ generation: state.generation, setGeneration: () => {}, pollError: '' }),
}));
beforeEach(() => { state.generation = null; state.loading = false; state.user = { id: 'alice', name: 'Alice', email: 'alice@example.test' }; });

describe('Gangnam Style generator submission states', () => {
  it('fixes the trio framing to landscape while retaining both resolution choices', () => {
    const html = renderToStaticMarkup(<GangnamStyleGenerator />);
    const selects = html.match(/<select\b[^>]*>[\s\S]*?<\/select>/g) ?? [];
    expect(selects).toHaveLength(1);
    expect([...selects[0]!.matchAll(/<option[^>]*value="([^"]+)"/g)].map(match => match[1])).toEqual(['480p', '720p']);
    const framing = html.match(/<input[^>]*value="16:9 · Landscape"[^>]*>/)?.[0];
    expect(framing).toBeDefined();
    expect(framing).toContain('readOnly');
  });

  it.each(['queued', 'reviewing', 'processing'] as const)('locks photo inputs, settings, mode and submission while a job is %s', status => {
    state.generation = { id: 'trio-1', status, progress: 42 };
    const html = renderToStaticMarkup(<GangnamStyleGenerator />);
    const photoInputs = html.match(/<input[^>]*type="file"[^>]*>/g) ?? [];
    expect(photoInputs).toHaveLength(3);
    for (const input of photoInputs) expect(input).toContain('disabled');
    for (const select of html.match(/<select[^>]*>/g) ?? []) expect(select).toContain('disabled');
    expect(html.match(/<button[^>]*class="gns-primary gns-generate"[^>]*>/)?.[0]).toContain('disabled');
    expect(html.match(/<button[^>]*role="tab"[^>]*>/)?.[0]).toContain('disabled');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('href="/app/my-videos"');
  });

  it('keeps completed video playback available without claiming legacy results have a soundtrack', () => {
    state.generation = { id: 'trio-1', status: 'completed', progress: 100, videoUrl: '/api/media/trio-result' };
    const html = renderToStaticMarkup(<GangnamStyleGenerator />);
    expect(html).toContain('src="/api/media/trio-result"');
    expect(html).toContain('download="migosai-gangnam-style.mp4"');
    expect(html).toContain('<h3>Your video</h3>');
    expect(html).toContain('Preview and download your finished MP4.');
    const player = html.match(/<video[^>]*>/)?.[0];
    expect(player).toContain('aria-label="Your generated Gangnam Style video"');
    expect(player).toContain('controls');
    expect(player).not.toContain('muted');
    expect(player).not.toContain('autoPlay');
    expect(html).toContain('href="/app/my-videos"');
    expect(html.match(/<button[^>]*class="gns-primary gns-generate"[^>]*>/)?.[0]).not.toContain('disabled');
  });

  it('keeps provider failure visible and allows an explicit new attempt', () => {
    state.generation = { id: 'trio-1', status: 'failed', progress: 0, error: 'The image could not be processed. Your credits have been returned.' };
    const html = renderToStaticMarkup(<GangnamStyleGenerator />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('The image could not be processed. Your credits have been returned.');
    expect(html.match(/<button[^>]*class="gns-primary gns-generate"[^>]*>/)?.[0]).not.toContain('disabled');
  });

  it('keeps sample audio available and quotes actual MigosAI credits before submission', () => {
    const html = renderToStaticMarkup(<GangnamStyleGenerator />);
    expect(html).toContain('src="/gangnam-style/photo-trio-seoul-with-audio.mp4"');
    expect(html.match(/<video[^>]*>/)?.[0]).toContain('controls');
    expect(html.match(/<video[^>]*>/)?.[0]).not.toContain('muted');
    expect(html).toContain('300 MigosAI credits');
    expect(html).not.toContain('1 video = 1 credit');
  });

  it('does not permit a submit while account state is unresolved', () => {
    state.loading = true;
    const html = renderToStaticMarkup(<GangnamStyleGenerator />);
    expect(html.match(/<button[^>]*class="gns-primary gns-generate"[^>]*>/)?.[0]).toContain('disabled');
    expect(html).toContain('Checking account');
  });
});
