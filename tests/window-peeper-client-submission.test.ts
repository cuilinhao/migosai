import { describe, expect, it } from 'vitest';
import { captureWindowPeeperSubmission, executeWindowPeeperSubmission, type UploadedWindowPeeperPhoto } from '@/components/generator/window-peeper-submission';
import type { GenerationResponse } from '@/lib/contracts';

describe('Window Peeper photo submission', () => {
  const file = new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' });
  const response: GenerationResponse = { id: 'job-1', status: 'queued', progress: 0 };

  it('requires consent before capturing a paid request', () => {
    expect(() => captureWindowPeeperSubmission('request-1', 'owner:photo', file, false)).toThrow('consent');
  });

  it('retries an uncertain create with the saved upload and the same billing identity', async () => {
    const submission = captureWindowPeeperSubmission('request-1', 'owner:photo', file, true);
    let uploadCount = 0;
    let cached: UploadedWindowPeeperPhoto | null = null;
    const requests: { photo: string; consent: true; key: string }[] = [];
    const run = () => executeWindowPeeperSubmission(submission, cached,
      async () => { uploadCount++; return { key: 'users/owner/uploads/photo' }; },
      async (body, key) => {
        requests.push({ ...body, key });
        if (requests.length === 1) throw new Error('Connection lost after reservation');
        return response;
      }, value => { cached = value; }, () => {});
    await expect(run()).rejects.toThrow('Connection lost');
    expect(await run()).toEqual(response);
    expect(uploadCount).toBe(1);
    expect(requests).toEqual([
      { photo: 'users/owner/uploads/photo', consent: true, key: 'request-1' },
      { photo: 'users/owner/uploads/photo', consent: true, key: 'request-1' },
    ]);
  });

  it('never reuses a cached upload belonging to a different owner or photo', async () => {
    let submittedPhoto = '';
    await executeWindowPeeperSubmission(captureWindowPeeperSubmission('request-2', 'owner-b:photo', file, true),
      { fingerprint: 'owner-a:photo', photo: 'private-old-photo' },
      async () => ({ key: 'new-owner-photo' }), async body => { submittedPhoto = body.photo; return response; },
      () => {}, () => {});
    expect(submittedPhoto).toBe('new-owner-photo');
  });

  it('does not upload when a request has already been cancelled', async () => {
    let uploaded = false;
    await expect(executeWindowPeeperSubmission(captureWindowPeeperSubmission('request-3', 'owner:photo', file, true), null,
      async () => { uploaded = true; return { key: 'photo' }; }, async () => response,
      () => {}, () => { throw new Error('Cancelled'); })).rejects.toThrow('Cancelled');
    expect(uploaded).toBe(false);
  });

  it('does not cache or submit a photo after the account changes during upload', async () => {
    let current = true;
    let created = false;
    let cached = false;
    await expect(executeWindowPeeperSubmission(captureWindowPeeperSubmission('request-4', 'owner:photo', file, true), null,
      async () => { current = false; return { key: 'old-owner-photo' }; },
      async () => { created = true; return response; }, () => { cached = true; },
      () => { if (!current) throw new Error('Account changed'); })).rejects.toThrow('Account changed');
    expect({ created, cached }).toEqual({ created: false, cached: false });
  });

  it('rejects a late create response after the submitting account changes', async () => {
    let current = true;
    await expect(executeWindowPeeperSubmission(captureWindowPeeperSubmission('request-5', 'owner:photo', file, true),
      { fingerprint: 'owner:photo', photo: 'saved-photo' }, async () => ({ key: 'photo' }),
      async () => { current = false; return response; }, () => {},
      () => { if (!current) throw new Error('Account changed'); })).rejects.toThrow('Account changed');
  });
});
