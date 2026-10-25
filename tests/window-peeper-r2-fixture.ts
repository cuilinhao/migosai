import { createHash } from 'node:crypto';

export function memoryVideoBucket() {
  const stored = new Map<string, { bytes: Uint8Array; etag: string; httpMetadata: { contentType: string } }>();
  const removed: string[] = [], aborted: string[] = [], completed: string[] = [];
  const reads: Array<{ key: string; offset: number; length: number; etag: string }> = [];
  const parts: number[] = [];
  const bucket = {
    createMultipartUpload: async (key: string, options: { httpMetadata?: { contentType?: string } }) => {
      const buffers: Uint8Array[] = [];
      return {
        uploadPart: async (partNumber: number, value: Uint8Array) => {
          buffers[partNumber - 1] = value.slice(); parts.push(value.byteLength);
          return { partNumber, etag: `part-${partNumber}` };
        },
        complete: async () => {
          const bytes = new Uint8Array(Buffer.concat(buffers));
          stored.set(key, { bytes, etag: createHash('md5').update(bytes).digest('hex'), httpMetadata: { contentType: options?.httpMetadata?.contentType ?? 'video/mp4' } });
          completed.push(key);
          return {};
        },
        abort: async () => { aborted.push(key); },
      };
    },
    head: async (key: string) => {
      const object = stored.get(key);
      return object ? { ...object, size: object.bytes.byteLength } : null;
    },
    get: async (key: string, options?: { range?: { offset: number; length: number }; onlyIf?: { etagMatches: string } }) => {
      const object = stored.get(key);
      if (!object) return null;
      if (options?.onlyIf?.etagMatches && options.onlyIf.etagMatches !== object.etag) return { etag: object.etag };
      const offset = options?.range?.offset ?? 0, length = options?.range?.length ?? object.bytes.byteLength;
      reads.push({ key, offset, length, etag: options?.onlyIf?.etagMatches ?? '' });
      const body = new Response(object.bytes.slice(offset, offset + length)).body!;
      return { ...object, size: object.bytes.byteLength, body, range: { offset, length } };
    },
    delete: async (key: string) => { removed.push(key); stored.delete(key); },
  } as unknown as R2Bucket;
  return { bucket, stored, removed, aborted, completed, reads, parts };
}
