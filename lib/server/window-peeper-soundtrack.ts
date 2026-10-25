import { CustomSource } from 'mediabunny';
import { appOrigin, media, type Env } from './env';
import { storeProviderMedia } from './media';
import { ApiError } from './errors';
import { replaceWindowPeeperAudio, WindowPeeperRemuxError } from './window-peeper-remux';

const SOUNDTRACK_PATH = '/templates/window-peeper/soundtrack.m4a';
const SOUNDTRACK_SHA256 = '45f6b9632caa206a1ab49d4fe37ebe105673dc78cb8e715754a283bdcafef6e1';
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 48 * 1024 * 1024;
const MAX_SOUNDTRACK_BYTES = 1024 * 1024;
const PART_BYTES = 5 * 1024 * 1024;

async function loadSoundtrack(env: Env, signal: AbortSignal): Promise<Uint8Array> {
  if (!env.ASSETS) throw new Error('The fixed video soundtrack is unavailable.');
  const response = await env.ASSETS.fetch(new Request(new URL(SOUNDTRACK_PATH, appOrigin(env)), { redirect: 'manual', signal }));
  const mime = response.headers.get('content-type')?.split(';')[0];
  if (!response.ok || !response.body || !['audio/mp4', 'audio/x-m4a', 'video/mp4'].includes(mime ?? '')) {
    await response.body?.cancel();
    throw new Error('The fixed video soundtrack is unavailable.');
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SOUNDTRACK_BYTES) throw new Error('The fixed soundtrack exceeds its size limit.');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  if (hash !== SOUNDTRACK_SHA256) throw new Error('The fixed video soundtrack could not be verified.');
  return bytes;
}

/** Only the composited result is completed; the unlinked provider source is always cleaned up. */
export async function storeWindowPeeperVideo(env: Env, url: string, key: string, externalSignal?: AbortSignal): Promise<string> {
  const bucket = media(env), sourceKey = `${key}.source-${crypto.randomUUID()}`;
  const signal = externalSignal ? AbortSignal.any([externalSignal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000);
  let upload: R2MultipartUpload | undefined;
  try {
    signal.throwIfAborted();
    try {
      await storeProviderMedia(env, url, sourceKey, 'video', 'fal');
    } catch (error) {
      // The shared downloader has its own larger limit. These size failures
      // are definitive too; storage/network failures retain their retry path.
      if (error instanceof ApiError && error.status === 413) {
        throw new WindowPeeperRemuxError('The generated video exceeds its media limit.');
      }
      throw error;
    }
    signal.throwIfAborted();
    const original = await bucket.head(sourceKey);
    if (!original?.etag || !Number.isSafeInteger(original.size) || original.size <= 0 || original.size > MAX_SOURCE_BYTES) {
      throw new WindowPeeperRemuxError('The generated video cannot be prepared within the media limit.');
    }
    const soundtrack = await loadSoundtrack(env, signal);
    const source = new CustomSource({
      getSize: () => original.size,
      maxCacheSize: 2 * 1024 * 1024,
      prefetchProfile: 'none',
      read: async (start, end) => {
        signal.throwIfAborted();
        const object = await bucket.get(sourceKey, { range: { offset: start, length: end - start }, onlyIf: { etagMatches: original.etag } });
        if (!object || !('body' in object) || object.etag !== original.etag) throw new Error('The source video changed during preparation.');
        if (signal.aborted) { await object.body.cancel(); signal.throwIfAborted(); }
        return object.body;
      },
    });
    upload = await bucket.createMultipartUpload(key, { httpMetadata: { contentType: 'video/mp4' } });
    const parts: R2UploadedPart[] = [];
    const buffer = new Uint8Array(PART_BYTES);
    let used = 0, total = 0;
    const flush = async () => {
      if (!used) return;
      signal.throwIfAborted();
      parts.push(await upload!.uploadPart(parts.length + 1, buffer.subarray(0, used)));
      used = 0;
    };
    const target = new WritableStream<Uint8Array>({
      async write(chunk) {
        signal.throwIfAborted();
        total += chunk.byteLength;
        if (total > MAX_OUTPUT_BYTES) throw new WindowPeeperRemuxError('The prepared video exceeds its media limit.');
        let offset = 0;
        while (offset < chunk.byteLength) {
          const count = Math.min(PART_BYTES - used, chunk.byteLength - offset);
          buffer.set(chunk.subarray(offset, offset + count), used);
          used += count; offset += count;
          if (used === PART_BYTES) await flush();
        }
      },
      close: flush,
    });
    await replaceWindowPeeperAudio(source, soundtrack, target, signal);
    signal.throwIfAborted();
    if (!total || !parts.length) throw new Error('The prepared video is empty.');
    // A stream close can also occur during library cancellation; only a successful
    // remux return authorizes completing the final R2 object.
    await upload.complete(parts);
    upload = undefined;
    return key;
  } catch (error) {
    if (upload) await upload.abort().catch(() => {});
    throw error;
  } finally {
    await bucket.delete(sourceKey).catch(() => {});
  }
}
