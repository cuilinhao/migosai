import { describe, expect, it, vi } from 'vitest';
import { captureOzilSubmission, executeOzilSubmission, type UploadedOzilPhoto } from '@/components/generator/ozil-submission';

describe('Ozil photo submission', () => {
  const file = new File(['photo'], 'player.jpg', { type: 'image/jpeg' });
  it('retries an uncertain create using the same uploaded photo and billing identity', async () => {
    const submission = captureOzilSubmission('request-1', 'user-a:photo-1', file, true);
    const upload = vi.fn(async () => ({ key: 'users/a/uploads/photo-1' }));
    const create = vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ id: 'job-1', status: 'queued', progress: 0 });
    let cached: UploadedOzilPhoto | null = null;
    const run = () => executeOzilSubmission(submission, cached, upload, create, value => { cached = value; }, () => {});
    await expect(run()).rejects.toThrow('Connection lost');
    expect(await run()).toMatchObject({ id: 'job-1' });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(create.mock.calls).toEqual([
      [{ photo: 'users/a/uploads/photo-1', consent: true }, 'request-1'],
      [{ photo: 'users/a/uploads/photo-1', consent: true }, 'request-1'],
    ]);
  });
  it('does not reuse cached uploads from another owner or photo', async () => {
    const upload = vi.fn(async () => ({ key: 'users/b/uploads/new' }));
    const create = vi.fn(async () => ({ id: 'job', status: 'queued' as const, progress: 0 }));
    await executeOzilSubmission(captureOzilSubmission('request-2', 'user-b:photo-1', file, true),
      { fingerprint: 'user-a:photo-1', photo: 'users/a/uploads/old' }, upload, create, () => {}, () => {});
    expect(upload).toHaveBeenCalledWith(file);
    expect(create).toHaveBeenCalledWith({ photo: 'users/b/uploads/new', consent: true }, 'request-2');
  });
  it('requires consent before uploading or creating', () => {
    expect(() => captureOzilSubmission('request-3', 'photo', file, false)).toThrow('consent');
  });
  it('cannot submit or cache an upload after the account changes', async () => {
    let valid = true;
    const create = vi.fn();
    const cache = vi.fn();
    const upload = vi.fn(async () => { valid = false; return { key: 'old-owner-photo' }; });
    const guard = () => { if (!valid) throw new Error('Account changed'); };
    await expect(executeOzilSubmission(captureOzilSubmission('request-4', 'owner:photo', file, true), null,
      upload, create, cache, guard)).rejects.toThrow('Account changed');
    expect(create).not.toHaveBeenCalled();
    expect(cache).not.toHaveBeenCalled();
  });
});
