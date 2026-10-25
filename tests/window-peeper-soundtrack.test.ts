import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { BufferSource, Input, MP4 } from 'mediabunny';
import type { Env } from '../lib/server/env';
import { storeWindowPeeperVideo } from '../lib/server/window-peeper-soundtrack';
import { WindowPeeperRemuxError } from '../lib/server/window-peeper-remux';
import { memoryVideoBucket } from './window-peeper-r2-fixture';

const video = new Uint8Array(readFileSync(new URL('./fixtures/window-peeper-audio/video-with-audio.mp4', import.meta.url)));
const soundtrack = new Uint8Array(readFileSync(new URL('../public/templates/window-peeper/soundtrack.m4a', import.meta.url)));
const providerUrl = 'https://v3b.fal.media/files/result.mp4';
const resultKey = 'users/u/results/job/final';
function setup() {
  const media = memoryVideoBucket();
  const assetFetch = vi.fn(async (_request: RequestInfo | URL) => new Response(soundtrack, { headers: { 'content-type': 'audio/mp4' } }));
  const env = { APP_URL: 'https://app.example.test', MEDIA: media.bucket, FAL_MEDIA_HOSTS: 'v3b.fal.media', ASSETS: { fetch: assetFetch } } as unknown as Env;
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(video, { headers: { 'content-type': 'video/mp4', 'content-length': String(video.byteLength) } }));
  return { ...media, env, assetFetch, fetcher };
}
afterEach(() => vi.restoreAllMocks());

describe('Window Peeper saved soundtrack', () => {
  it('stores the fixed soundtrack and unchanged video, removes the private source and uses conditional R2 ranges', async () => {
    const d = setup();
    await storeWindowPeeperVideo(d.env, providerUrl, resultKey);
    expect(d.stored.size).toBe(1);
    expect(d.stored.has(resultKey)).toBe(true);
    expect(d.removed).toHaveLength(1);
    expect(d.removed[0]).not.toBe(resultKey);
    expect(d.completed.at(-1)).toBe(resultKey);
    expect(d.aborted).toEqual([]);
    expect(d.reads.length).toBeGreaterThan(0);
    expect(d.reads.every(read => read.key === d.removed[0] && !!read.etag)).toBe(true);
    expect(d.parts.every(size => size <= 5 * 1024 * 1024)).toBe(true);
    const input = new Input({ source: new BufferSource(d.stored.get(resultKey)!.bytes), formats: [MP4] });
    try {
      expect((await input.getAudioTracks()).length).toBe(1);
      expect(await (await input.getPrimaryAudioTrack())!.getSampleRate()).toBe(44100);
      expect(await input.computeDuration()).toBeCloseTo(15, 1);
    } finally { input.dispose(); }
    expect(d.fetcher).toHaveBeenCalledTimes(1);
    expect(new Request(d.assetFetch.mock.calls[0]?.[0] as Request).url).toBe('https://app.example.test/templates/window-peeper/soundtrack.m4a');
  });

  it('cleans the original when the fixed audio is unavailable and never publishes the provider soundtrack', async () => {
    const d = setup();
    d.assetFetch.mockResolvedValue(new Response('missing', { status: 404 }));
    await expect(storeWindowPeeperVideo(d.env, providerUrl, resultKey)).rejects.toThrow();
    expect(d.stored.size).toBe(0);
    expect(d.completed).not.toContain(resultKey);
    expect(d.removed).toHaveLength(1);
  });

  it('rejects a changed audio asset before creating the final upload', async () => {
    const d = setup();
    d.assetFetch.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mp4' } }));
    await expect(storeWindowPeeperVideo(d.env, providerUrl, resultKey)).rejects.toThrow();
    expect(d.completed).not.toContain(resultKey);
    expect(d.stored.size).toBe(0);
  });

  it('rejects an oversized reference before remux and cleans its temporary key', async () => {
    const d = setup(), realHead = d.env.MEDIA!.head.bind(d.env.MEDIA);
    vi.spyOn(d.env.MEDIA!, 'head').mockImplementation(async key => { const result = await realHead(key); return result ? Object.assign(result, { size: 33 * 1024 * 1024 }) : result; });
    await expect(storeWindowPeeperVideo(d.env, providerUrl, resultKey)).rejects.toThrow();
    expect(d.stored.size).toBe(0);
    expect(d.completed).not.toContain(resultKey);
  });

  it('rejects unapproved provider URLs without a fetch or stored media', async () => {
    const d = setup();
    await expect(storeWindowPeeperVideo(d.env, 'https://untrusted.test/video.mp4', resultKey)).rejects.toThrow();
    expect(d.fetcher).not.toHaveBeenCalled();
    expect(d.completed).toEqual([]);
  });

  it('treats the shared downloader size limit as a definitive failure too', async () => {
    const d = setup();
    d.fetcher.mockResolvedValue(new Response(video, { headers: { 'content-type': 'video/mp4', 'content-length': String(65 * 1024 * 1024) } }));
    await expect(storeWindowPeeperVideo(d.env, providerUrl, resultKey)).rejects.toBeInstanceOf(WindowPeeperRemuxError);
    expect(d.completed).toEqual([]);
    expect(d.stored.size).toBe(0);
    expect(d.assetFetch).not.toHaveBeenCalled();
  });

  it('aborts the final upload on a storage failure and keeps that failure retryable', async () => {
    const d = setup(), create = d.env.MEDIA!.createMultipartUpload.bind(d.env.MEDIA);
    const failure = new Error('temporary storage failure');
    vi.spyOn(d.env.MEDIA!, 'createMultipartUpload').mockImplementation(async (key, options) => {
      const upload = await create(key, options);
      if (key === resultKey) upload.uploadPart = async () => { throw failure; };
      return upload;
    });
    await expect(storeWindowPeeperVideo(d.env, providerUrl, resultKey)).rejects.toBe(failure);
    expect(d.stored.size).toBe(0);
    expect(d.aborted).toEqual([resultKey]);
    expect(d.completed).not.toContain(resultKey);
  });

  it('never completes a result if the conditionally read source is no longer available', async () => {
    const d = setup();
    vi.spyOn(d.env.MEDIA!, 'get').mockResolvedValue(null);
    await expect(storeWindowPeeperVideo(d.env, providerUrl, resultKey)).rejects.toThrow('source video changed');
    expect(d.stored.size).toBe(0);
    expect(d.aborted).toEqual([resultKey]);
    expect(d.completed).not.toContain(resultKey);
  });
});
