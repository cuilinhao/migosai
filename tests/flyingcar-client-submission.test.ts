import { describe, expect, it, vi } from 'vitest';
import { captureFlyingCarSubmission, executeFlyingCarSubmission, type UploadedFlyingCarPhoto } from '@/components/flyingcar/submission';

const prompt = 'A red roadster flies above the city at sunset.';
const file = new File(['photo'], 'roadster.jpg', { type: 'image/jpeg' });
const photo = { file, fingerprint: 'owner-a:photo-1' };
const result = { id: 'flyingcar-job', status: 'queued' as const, progress: 0 };

describe('FlyingCar client submission', () => {
  it('creates text-only videos with the reviewed prompt and exact duration without uploading', async () => {
    const upload = vi.fn();
    const create = vi.fn(async () => result);
    const submission = captureFlyingCarSubmission({ key: 'request-text', prompt: `  ${prompt}  `, duration: 30 });
    expect(await executeFlyingCarSubmission(submission, null, upload, create, () => {}, () => {})).toEqual(result);
    expect(create).toHaveBeenCalledWith({ prompt, duration: 30 }, 'request-text');
    expect(upload).not.toHaveBeenCalled();
    expect(Object.isFrozen(submission)).toBe(true);
  });

  it('rejects missing photo consent and invalid lengths before any upload or generation can start', () => {
    expect(() => captureFlyingCarSubmission({ key: 'bad', prompt, duration: 10, photo, consent: false })).toThrow(/permission|consent/i);
    expect(() => captureFlyingCarSubmission({ key: 'bad', prompt: '  too short  ', duration: 10 })).toThrow(/12/);
    expect(() => captureFlyingCarSubmission({ key: 'bad', prompt: 'x'.repeat(601), duration: 10 })).toThrow(/600/);
    for (const duration of [0, 4, 31, 10.5, NaN]) {
      expect(() => captureFlyingCarSubmission({ key: 'bad', prompt, duration })).toThrow(/length|duration|seconds/i);
    }
  });

  it('reuses both the uploaded photo and billing identity after an uncertain generation response', async () => {
    const submission = captureFlyingCarSubmission({ key: 'retry-create', prompt, duration: 10, photo, consent: true });
    const upload = vi.fn(async () => ({ key: 'users/a/uploads/roadster' }));
    const create = vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(result);
    let cached: UploadedFlyingCarPhoto | null = null;
    const run = () => executeFlyingCarSubmission(submission, cached, upload, create, value => { cached = value; }, () => {});
    await expect(run()).rejects.toThrow('Connection lost');
    expect(await run()).toEqual(result);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(create.mock.calls).toEqual([
      [{ prompt, duration: 10, photo: 'users/a/uploads/roadster', consent: true }, 'retry-create'],
      [{ prompt, duration: 10, photo: 'users/a/uploads/roadster', consent: true }, 'retry-create'],
    ]);
  });

  it('retries a failed upload without creating a generation or changing the billing identity', async () => {
    const submission = captureFlyingCarSubmission({ key: 'retry-upload', prompt, duration: 5, photo, consent: true });
    const upload = vi.fn().mockRejectedValueOnce(new Error('Upload interrupted')).mockResolvedValueOnce({ key: 'users/a/uploads/retry' });
    const create = vi.fn(async () => result);
    let cached: UploadedFlyingCarPhoto | null = null;
    const run = () => executeFlyingCarSubmission(submission, cached, upload, create, value => { cached = value; }, () => {});
    await expect(run()).rejects.toThrow('Upload interrupted');
    expect(create).not.toHaveBeenCalled();
    expect(cached).toBeNull();
    await run();
    expect(create).toHaveBeenCalledWith({ prompt, duration: 5, photo: 'users/a/uploads/retry', consent: true }, 'retry-upload');
  });

  it('reuses an unchanged photo for a new scene but never an upload belonging to a different owner', async () => {
    const create = vi.fn(async () => result);
    const upload = vi.fn(async () => ({ key: 'users/a/uploads/new' }));
    await executeFlyingCarSubmission(captureFlyingCarSubmission({ key: 'new-scene', prompt: 'A silver car lifts off a mountain road.', duration: 15, photo, consent: true }),
      { fingerprint: photo.fingerprint, photo: 'users/a/uploads/saved' }, upload, create, () => {}, () => {});
    expect(upload).not.toHaveBeenCalled();
    expect(create).toHaveBeenLastCalledWith({ prompt: 'A silver car lifts off a mountain road.', duration: 15, photo: 'users/a/uploads/saved', consent: true }, 'new-scene');
    await executeFlyingCarSubmission(captureFlyingCarSubmission({ key: 'owner-change', prompt, duration: 10, photo, consent: true }),
      { fingerprint: 'owner-b:photo-1', photo: 'users/b/uploads/private' }, upload, create, () => {}, () => {});
    expect(create).toHaveBeenLastCalledWith({ prompt, duration: 10, photo: 'users/a/uploads/new', consent: true }, 'owner-change');
  });

  it('cannot cache or submit a photo if its owner changes during the upload', async () => {
    let current = true;
    const create = vi.fn();
    const cache = vi.fn();
    const upload = async () => { current = false; return { key: 'old-owner-photo' }; };
    const guard = () => { if (!current) throw new Error('Account changed'); };
    await expect(executeFlyingCarSubmission(captureFlyingCarSubmission({ key: 'owner', prompt, duration: 10, photo, consent: true }), null, upload, create, cache, guard)).rejects.toThrow('Account changed');
    expect(create).not.toHaveBeenCalled();
    expect(cache).not.toHaveBeenCalled();
  });

  it('does not expose a generation response after the account changes during creation', async () => {
    let current = true;
    const guard = () => { if (!current) throw new Error('Account changed'); };
    const create = async () => { current = false; return result; };
    await expect(executeFlyingCarSubmission(captureFlyingCarSubmission({ key: 'owner-text', prompt, duration: 10 }), null, vi.fn(), create, () => {}, guard)).rejects.toThrow('Account changed');
  });
});
