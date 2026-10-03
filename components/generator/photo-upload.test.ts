import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadPhoto, type PhotoUploadProgress } from './photo-upload';

class FakeXHR extends EventTarget {
  static instances: FakeXHR[] = [];
  upload = new EventTarget();
  status = 0;
  responseText = '';
  timeout = 0;
  method = '';
  url = '';
  body: Document | XMLHttpRequestBodyInit | null = null;
  aborted = false;

  constructor() {
    super();
    FakeXHR.instances.push(this);
  }
  open(method: string, url: string) { this.method = method; this.url = url; }
  send(body: Document | XMLHttpRequestBodyInit | null) { this.body = body; }
  abort() { this.aborted = true; this.dispatchEvent(new Event('abort')); }
  progress(loaded: number, total: number, lengthComputable = true) {
    const event = new Event('progress');
    Object.assign(event, { loaded, total, lengthComputable });
    this.upload.dispatchEvent(event);
  }
  finish(status: number, responseText: string) {
    this.status = status;
    this.responseText = responseText;
    this.dispatchEvent(new Event('load'));
  }
  fail(kind: 'error' | 'timeout') { this.dispatchEvent(new Event(kind)); }
}

const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
const current = () => FakeXHR.instances.at(-1)!;

beforeEach(() => {
  FakeXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
});
afterEach(() => vi.unstubAllGlobals());

describe('uploadPhoto', () => {
  it('reports real transmitted bytes, then waits for a saved key before completing', async () => {
    const progress: PhotoUploadProgress[] = [];
    let settled = false;
    const result = uploadPhoto(file, value => progress.push(value)).then(value => { settled = true; return value; });
    const xhr = current();
    expect([xhr.method, xhr.url, xhr.timeout]).toEqual(['POST', '/api/uploads', 120000]);
    expect(xhr.body).toBeInstanceOf(FormData);
    expect((xhr.body as FormData).get('file')).toBe(file);
    xhr.progress(3, 6);
    xhr.progress(6, 6);
    await Promise.resolve();
    expect(progress).toEqual([
      { phase: 'uploading', loaded: 3, total: 6 },
      { phase: 'saving', loaded: 6, total: 6 },
    ]);
    expect(settled).toBe(false);
    xhr.finish(201, '{"key":"users/u/uploads/one"}');
    await expect(result).resolves.toEqual({ key: 'users/u/uploads/one' });
    expect(progress.at(-1)).toEqual({ phase: 'complete', loaded: 6, total: 6 });
  });

  it.each([
    [400, '{"error":"Bad image"}'],
    [413, '{"error":"Too large"}'],
    [500, '{"error":"Server failed"}'],
  ])('rejects HTTP %i instead of reporting completion', async (status, body) => {
    const progress: PhotoUploadProgress[] = [];
    const result = uploadPhoto(file, value => progress.push(value));
    current().finish(status, body);
    await expect(result).rejects.toThrow(JSON.parse(body).error);
    expect(progress.some(value => value.phase === 'complete')).toBe(false);
  });

  it.each(['not-json', '{"error":123}', '{}'])('falls back to the HTTP status for an invalid error body: %s', async body => {
    const result = uploadPhoto(file, () => {});
    current().finish(422, body);
    await expect(result).rejects.toThrow('HTTP 422');
  });

  it('uses the server message when error is absent', async () => {
    const result = uploadPhoto(file, () => {});
    current().finish(401, '{"message":"Sign in again"}');
    await expect(result).rejects.toThrow('Sign in again');
  });

  it.each(['not-json', '{}', '{"key":""}', '{"key":123}'])('rejects an invalid success body: %s', async body => {
    const result = uploadPhoto(file, () => {});
    current().finish(201, body);
    await expect(result).rejects.toThrow();
  });

  it.each(['error', 'timeout'] as const)('rejects an XHR %s', async kind => {
    const result = uploadPhoto(file, () => {});
    current().fail(kind);
    await expect(result).rejects.toThrow();
  });

  it('aborts when its signal is cancelled and rejects', async () => {
    const controller = new AbortController();
    const result = uploadPhoto(file, () => {}, controller.signal);
    const xhr = current();
    controller.abort();
    expect(xhr.aborted).toBe(true);
    await expect(result).rejects.toThrow();
  });
});
