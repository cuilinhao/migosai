import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadReference, type PhotoUploadProgress } from './reference-upload';

// This exercises client event handling only. FakeXHR does not contact the API,
// reproduce browser throttling, or enforce the browser's timeout itself.
class FakeXHR extends EventTarget {
  static instances: FakeXHR[] = [];
  upload = new EventTarget();
  status = 0;
  responseText = '';
  timeout = 0;
  method = '';
  url = '';
  body: Document | XMLHttpRequestBodyInit | null = null;
  abortCalls = 0;

  constructor() { super(); FakeXHR.instances.push(this); }
  open(method: string, url: string) { this.method = method; this.url = url; }
  send(body: Document | XMLHttpRequestBodyInit | null) { this.body = body; }
  abort() { this.abortCalls += 1; this.dispatchEvent(new Event('abort')); }
  progress(loaded: number, total: number, lengthComputable = true) {
    const event = new Event('progress');
    Object.assign(event, { loaded, total, lengthComputable });
    this.upload.dispatchEvent(event);
  }
  finish(status: number, body: string) {
    this.status = status; this.responseText = body;
    this.dispatchEvent(new Event('load'));
  }
  fail(kind: 'error' | 'timeout') { this.dispatchEvent(new Event(kind)); }
}

const file = new File(['reference media'], 'reference.wav', { type: 'audio/wav' });
const current = () => FakeXHR.instances.at(-1)!;
const saved = JSON.stringify({ key: 'users/u/uploads/reference' });

beforeEach(() => {
  FakeXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('uploadReference request and progress', () => {
  it.each(['audio', 'video'] as const)('sends the %s kind with its file and a two-minute timeout', async kind => {
    const progress = vi.fn();
    const result = uploadReference(file, kind, progress);
    const xhr = current();
    expect([xhr.method, xhr.url, xhr.timeout]).toEqual(['POST', '/api/reference-uploads', 120000]);
    expect(xhr.body).toBeInstanceOf(FormData);
    expect((xhr.body as FormData).get('file')).toBe(file);
    expect((xhr.body as FormData).get('kind')).toBe(kind);
    xhr.finish(201, saved);
    await expect(result).resolves.toEqual({ key: 'users/u/uploads/reference' });
    // Some browsers omit computable upload progress entirely.
    expect(progress).toHaveBeenCalledExactlyOnceWith({ phase: 'complete', loaded: file.size, total: file.size });
  });

  it('does not invent progress during a simulated slow upload or finish before the saved key arrives', async () => {
    vi.useFakeTimers();
    const progress: PhotoUploadProgress[] = [];
    let settled = false;
    const result = uploadReference(file, 'audio', value => progress.push(value)).then(value => { settled = true; return value; });
    const xhr = current();
    await vi.advanceTimersByTimeAsync(30000);
    expect(progress).toEqual([]);
    expect(settled).toBe(false);
    xhr.progress(25, 100);
    await vi.advanceTimersByTimeAsync(30000);
    expect(progress).toEqual([{ phase: 'uploading', loaded: 25, total: 100 }]);
    xhr.progress(100, 100);
    await vi.advanceTimersByTimeAsync(30000);
    expect(progress.at(-1)).toEqual({ phase: 'saving', loaded: 100, total: 100 });
    expect(settled).toBe(false);
    xhr.finish(200, saved);
    await expect(result).resolves.toEqual({ key: 'users/u/uploads/reference' });
    expect(progress).toEqual([
      { phase: 'uploading', loaded: 25, total: 100 },
      { phase: 'saving', loaded: 100, total: 100 },
      { phase: 'complete', loaded: 100, total: 100 },
    ]);
  });

  it('ignores uncomputable and zero-total progress while preserving the last real byte count', async () => {
    const progress = vi.fn();
    const result = uploadReference(file, 'audio', progress);
    const xhr = current();
    xhr.progress(4, 20);
    xhr.progress(6, 20, false);
    xhr.progress(0, 0);
    expect(progress).toHaveBeenCalledExactlyOnceWith({ phase: 'uploading', loaded: 4, total: 20 });
    xhr.finish(201, saved);
    await result;
    expect(progress).toHaveBeenLastCalledWith({ phase: 'complete', loaded: 20, total: 20 });
  });

  it('caps reported bytes at the total without completing until the server responds', async () => {
    const progress = vi.fn();
    const result = uploadReference(file, 'video', progress);
    current().progress(110, 100);
    expect(progress).toHaveBeenCalledExactlyOnceWith({ phase: 'saving', loaded: 100, total: 100 });
    current().finish(201, saved);
    await result;
  });
});

describe('uploadReference response failures', () => {
  it.each([400, 401, 403, 413, 422, 429, 500, 503])('rejects HTTP %i after bytes are sent without reporting completion', async status => {
    const progress = vi.fn();
    const result = uploadReference(file, 'audio', progress);
    current().progress(100, 100);
    current().finish(status, JSON.stringify({ error: `Server rejected upload: ${status}` }));
    await expect(result).rejects.toThrow(`Server rejected upload: ${status}`);
    expect(progress).toHaveBeenCalledExactlyOnceWith({ phase: 'saving', loaded: 100, total: 100 });
  });

  it.each(['<html>Proxy error</html>', 'null', '{}', '{"error":123}', '{"error":" ","message":" "}'])('keeps the HTTP status for an unusable error response: %s', async body => {
    const result = uploadReference(file, 'audio', () => {});
    current().finish(502, body);
    await expect(result).rejects.toThrow('Reference upload failed (HTTP 502).');
  });

  it.each([
    ['{"error":"Rejected file","message":"Other message"}', 'Rejected file'],
    ['{"error":" ","message":"Sign in again"}', 'Sign in again'],
  ])('selects the usable server error message from %s', async (body, message) => {
    const result = uploadReference(file, 'audio', () => {});
    current().finish(401, body);
    await expect(result).rejects.toThrow(message);
  });

  it.each(['not-json', '', 'null', '{}', '[]', '123', '"key"', '{"key":""}', '{"key":"  "}', '{"key":123}'])('rejects a successful status with an unusable saved key: %s', async body => {
    const progress = vi.fn();
    const result = uploadReference(file, 'video', progress);
    current().finish(201, body);
    await expect(result).rejects.toThrow(/invalid response|did not return a saved media key/);
    expect(progress).not.toHaveBeenCalled();
  });
});

describe('uploadReference transport failures and cancellation', () => {
  it.each([
    ['error', 20, 'network error'], ['error', 100, 'network error'],
    ['timeout', 20, 'timed out'], ['timeout', 100, 'timed out'],
  ] as const)('rejects %s after %i percent, including while waiting for server save', async (kind, loaded, message) => {
    const progress = vi.fn();
    const result = uploadReference(file, 'video', progress);
    const xhr = current();
    xhr.progress(loaded, 100);
    xhr.fail(kind);
    await expect(result).rejects.toThrow(message);
    // Late events must not revive the failed upload or mark it complete.
    xhr.progress(100, 100);
    xhr.finish(201, saved);
    expect(progress).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls[0][0].phase).not.toBe('complete');
  });

  it('rejects an already-aborted signal before constructing or sending a request', async () => {
    const controller = new AbortController(); controller.abort();
    const progress = vi.fn();
    await expect(uploadReference(file, 'audio', progress, controller.signal)).rejects.toThrow('cancelled');
    expect(FakeXHR.instances).toHaveLength(0);
    expect(progress).not.toHaveBeenCalled();
  });

  it.each([0, 20, 100])('cancels at %i percent and ignores subsequent success and progress events', async loaded => {
    const controller = new AbortController();
    const progress = vi.fn();
    const result = uploadReference(file, 'audio', progress, controller.signal);
    const xhr = current();
    if (loaded) xhr.progress(loaded, 100);
    controller.abort();
    await expect(result).rejects.toThrow('Reference upload was cancelled.');
    expect(xhr.abortCalls).toBe(1);
    xhr.progress(100, 100);
    xhr.finish(201, saved);
    expect(progress).toHaveBeenCalledTimes(loaded ? 1 : 0);
  });

  it('rejects browser-initiated abort even without an AbortSignal', async () => {
    const result = uploadReference(file, 'audio', () => {});
    current().abort();
    await expect(result).rejects.toThrow('cancelled');
  });

  it.each(['open', 'send'] as const)('rejects a synchronous %s failure and removes its signal handler', async method => {
    vi.spyOn(FakeXHR.prototype, method).mockImplementationOnce(() => { throw new Error('XHR unavailable'); });
    const controller = new AbortController();
    const progress = vi.fn();
    const result = uploadReference(file, 'audio', progress, controller.signal);
    await expect(result).rejects.toThrow('Reference upload could not be started.');
    const xhr = current();
    controller.abort();
    xhr.progress(100, 100);
    xhr.finish(201, saved);
    expect(xhr.abortCalls).toBe(0);
    expect(progress).not.toHaveBeenCalled();
  });

  it.each(['success', 'error', 'timeout'] as const)('removes signal and progress listeners after %s', async outcome => {
    const controller = new AbortController();
    const progress = vi.fn();
    const result = uploadReference(file, 'audio', progress, controller.signal);
    const xhr = current();
    if (outcome === 'success') { xhr.finish(201, saved); await result; }
    else { xhr.fail(outcome); await expect(result).rejects.toThrow(); }
    const callsAtSettlement = progress.mock.calls.length;
    controller.abort();
    xhr.progress(100, 100);
    xhr.finish(201, saved);
    xhr.fail('error');
    expect(xhr.abortCalls).toBe(0);
    expect(progress).toHaveBeenCalledTimes(callsAtSettlement);
  });

  it('keeps concurrent audio and video requests independent when audio is cancelled', async () => {
    const controller = new AbortController();
    const audioProgress = vi.fn(), videoProgress = vi.fn();
    const audio = uploadReference(file, 'audio', audioProgress, controller.signal);
    const audioXhr = current();
    const video = uploadReference(file, 'video', videoProgress);
    const videoXhr = current();
    controller.abort();
    await expect(audio).rejects.toThrow('cancelled');
    audioXhr.finish(201, saved);
    videoXhr.progress(50, 100);
    videoXhr.finish(201, JSON.stringify({ key: 'users/u/uploads/video' }));
    await expect(video).resolves.toEqual({ key: 'users/u/uploads/video' });
    expect(videoXhr.abortCalls).toBe(0);
    expect(audioProgress).not.toHaveBeenCalled();
    expect(videoProgress).toHaveBeenLastCalledWith({ phase: 'complete', loaded: 100, total: 100 });
  });
});
