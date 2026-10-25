import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { BufferSource, EncodedPacketSink, Input, MP4 } from 'mediabunny';

const root = fileURLToPath(new URL('../', import.meta.url));
const video = readFileSync(new URL('./fixtures/window-peeper-audio/video-with-audio.mp4', import.meta.url));
const soundtrack = readFileSync(new URL('../public/templates/window-peeper/soundtrack.m4a', import.meta.url));
const key = 'users/u/results/job/prepared';
let worker;
const network = [], assets = [];

beforeAll(async () => {
  const bundled = await build({
    stdin: {
      resolveDir: root,
      contents: `import { storeWindowPeeperVideo } from './lib/server/window-peeper-soundtrack';
        export default { async fetch(request, env) {
          try { return Response.json({ key: await storeWindowPeeperVideo(env, 'https://v3b.fal.media/files/video.mp4', '${key}') }); }
          catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
        }};`,
    },
    bundle: true, platform: 'browser', format: 'esm', write: false,
    plugins: [{ name: 'unused-next-context', setup(builder) {
      builder.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({ path: 'context', namespace: 'test-context' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-context' }, () => ({ contents: 'export function getCloudflareContext() { throw new Error("Unused"); }' }));
    } }],
  });
  worker = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundled.outputFiles[0].text,
    compatibilityDate: '2026-10-01', cf: false, r2Buckets: ['MEDIA'],
    bindings: { APP_URL: 'https://app.example.invalid', FAL_MEDIA_HOSTS: 'v3b.fal.media' },
    serviceBindings: { ASSETS: async request => {
      assets.push(request.url);
      return new Response(soundtrack, { headers: { 'content-type': 'audio/mp4' } });
    } },
    outboundService: async request => {
      network.push({ url: request.url, method: request.method, authorization: request.headers.get('authorization') });
      if (request.url !== 'https://v3b.fal.media/files/video.mp4') return new Response('Blocked', { status: 403 });
      return new Response(video, { headers: { 'content-type': 'video/mp4', 'content-length': String(video.byteLength) } });
    },
  }));
}, 30000);
afterAll(async () => { await worker?.dispose(); });

async function packetHashes(track) {
  const hashes = [];
  for await (const packet of new EncodedPacketSink(track).packets()) {
    hashes.push(createHash('sha256').update(packet.data).digest('hex'));
  }
  return hashes;
}

describe('Window Peeper fixed audio in workerd with real R2', () => {
  it('saves unchanged AVC packets with exactly the fixed AAC track and removes the temporary source', async () => {
    const response = await worker.dispatchFetch('https://app.example.invalid/test');
    const result = await response.json();
    expect(result).toEqual({ key });
    expect(response.status).toBe(200);
    const bucket = await worker.getR2Bucket('MEDIA');
    const objects = await bucket.list();
    expect(objects.objects.map(object => object.key)).toEqual([key]);
    const saved = await bucket.get(key);
    expect(saved.httpMetadata.contentType).toBe('video/mp4');
    const original = new Input({ source: new BufferSource(video), formats: [MP4] });
    const fixed = new Input({ source: new BufferSource(soundtrack), formats: [MP4] });
    const output = new Input({ source: new BufferSource(new Uint8Array(await saved.arrayBuffer())), formats: [MP4] });
    try {
      const track = await output.getPrimaryAudioTrack();
      expect(await output.getAudioTracks()).toHaveLength(1);
      expect(await track.getSampleRate()).toBe(44100);
      expect(await track.getNumberOfChannels()).toBe(2);
      expect(await packetHashes(await output.getPrimaryVideoTrack())).toEqual(await packetHashes(await original.getPrimaryVideoTrack()));
      const expectedAudio = await packetHashes(await fixed.getPrimaryAudioTrack());
      const actualAudio = await packetHashes(track);
      expect(actualAudio).toEqual(expectedAudio.slice(0, actualAudio.length));
      expect(await output.computeDuration()).toBeCloseTo(15, 1);
    } finally { original.dispose(); fixed.dispose(); output.dispose(); }
    expect(network).toEqual([{ url: 'https://v3b.fal.media/files/video.mp4', method: 'GET', authorization: null }]);
    expect(assets).toEqual(['https://app.example.invalid/templates/window-peeper/soundtrack.m4a']);
  }, 30000);
});
