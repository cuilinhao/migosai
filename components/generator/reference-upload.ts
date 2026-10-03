export type PhotoUploadProgress = { phase: 'uploading' | 'saving' | 'complete'; loaded: number; total: number };

export function uploadReference(
  file: File,
  kind: 'audio' | 'video',
  onProgress: (value: PhotoUploadProgress) => void,
  signal?: AbortSignal,
): Promise<{ key: string }> {
  if (signal?.aborted) return Promise.reject(new Error('Reference upload was cancelled.'));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.set('file', file);
    form.set('kind', kind);
    let loaded = 0;
    let total = file.size;
    let settled = false;

    const cleanup = () => {
      xhr.upload.removeEventListener('progress', handleProgress);
      xhr.removeEventListener('load', handleLoad);
      xhr.removeEventListener('error', handleError);
      xhr.removeEventListener('timeout', handleTimeout);
      xhr.removeEventListener('abort', handleAbort);
      signal?.removeEventListener('abort', abort);
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    const handleProgress = (event: Event) => {
      if (settled) return;
      const progress = event as ProgressEvent;
      if (!progress.lengthComputable || progress.total <= 0) return;
      loaded = Math.min(progress.loaded, progress.total);
      total = progress.total;
      onProgress({ phase: loaded >= total ? 'saving' : 'uploading', loaded, total });
    };
    const handleLoad = () => {
      if (settled) return;
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = `Reference upload failed (HTTP ${xhr.status}).`;
        try {
          const body: unknown = JSON.parse(xhr.responseText);
          if (body && typeof body === 'object') {
            const response = body as { error?: unknown; message?: unknown };
            if (typeof response.error === 'string' && response.error.trim()) message = response.error;
            else if (typeof response.message === 'string' && response.message.trim()) message = response.message;
          }
        } catch { /* Keep the HTTP status when the response is not JSON. */ }
        fail(message);
        return;
      }
      let body: unknown;
      try { body = JSON.parse(xhr.responseText); }
      catch { fail('Reference upload returned an invalid response.'); return; }
      const key = (body as { key?: unknown } | null)?.key;
      if (typeof key !== 'string' || !key.trim()) {
        fail('Reference upload did not return a saved media key.');
        return;
      }
      settled = true;
      cleanup();
      onProgress({ phase: 'complete', loaded: total, total });
      resolve({ key });
    };
    const handleError = () => fail('Reference upload failed due to a network error.');
    const handleTimeout = () => fail('Reference upload timed out. Please try again.');
    const handleAbort = () => fail('Reference upload was cancelled.');
    const abort = () => xhr.abort();

    xhr.upload.addEventListener('progress', handleProgress);
    xhr.addEventListener('load', handleLoad);
    xhr.addEventListener('error', handleError);
    xhr.addEventListener('timeout', handleTimeout);
    xhr.addEventListener('abort', handleAbort);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      xhr.open('POST', '/api/reference-uploads');
      xhr.timeout = 120000;
      xhr.send(form);
    } catch {
      fail('Reference upload could not be started.');
    }
  });
}
