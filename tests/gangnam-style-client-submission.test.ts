import { describe, expect, it } from 'vitest';
import { captureGangnamStyleSubmission, executeGangnamStyleSubmission, type GangnamStylePhoto, type UploadedGangnamStylePhoto } from '@/components/gangnam-style/submission';
import type { GenerationResponse } from '@/lib/contracts';

const response: GenerationResponse = { id: 'trio-1', status: 'queued', progress: 0 };
const photo = (role: string, owner = 'owner-a'): GangnamStylePhoto => ({
  fingerprint: `${owner}:${role}`, file: new File([role], `${role}.jpg`, { type: 'image/jpeg' }),
});
const trio = () => [photo('middle'), photo('right'), photo('left')];
const capture = (photos = trio()) => captureGangnamStyleSubmission({
  key: 'request-1', mode: 'friends', photos, aspect: '16:9', resolution: '720p', consent: true,
});

describe('Gangnam Style client submission', () => {
  it('captures immutable photos and output settings before asynchronous uploads', async () => {
    const photos = trio();
    const input = { key: 'request-1', mode: 'friends' as const, photos, aspect: '16:9' as const, resolution: '720p' as const, consent: true };
    const submission = captureGangnamStyleSubmission(input);
    photos.reverse();
    photos[0].fingerprint = 'changed';
    Object.assign(input, { mode: 'pets', aspect: '1:1', resolution: '480p', consent: false });
    let received: unknown;
    await executeGangnamStyleSubmission(submission, [], async file => ({ key: file.name }),
      async (body, key) => { received = { ...body, key }; return response; }, () => {}, () => {});
    expect(received).toEqual({ key: 'request-1', mode: 'friends', photos: ['middle.jpg', 'right.jpg', 'left.jpg'], aspect: '16:9', resolution: '720p', consent: true });
    expect(submission.photos[2].fingerprint).toBe('owner-a:left');
    expect(Object.isFrozen(submission)).toBe(true);
    expect(Object.isFrozen(submission.photos)).toBe(true);
    expect(Object.isFrozen(submission.photos[0])).toBe(true);
  });

  it('requires photo consent before any paid request can be captured', () => {
    expect(() => captureGangnamStyleSubmission({ ...capture(), consent: false })).toThrow(/consent|permission/i);
  });

  it.each(['friends', 'pets'] as const)('requires all three roles for %s', mode => {
    expect(() => captureGangnamStyleSubmission({ ...capture(), mode, photos: [photo('middle')] })).toThrow(/three|3/i);
  });

  it('requires exactly one selfie and submits it only once for all three dancers', async () => {
    expect(() => captureGangnamStyleSubmission({ ...capture(), mode: 'selfie' })).toThrow(/one|1/i);
    const selfie = captureGangnamStyleSubmission({ ...capture(), mode: 'selfie', photos: [photo('selfie')] });
    let received: unknown;
    await executeGangnamStyleSubmission(selfie, [], async file => ({ key: file.name }),
      async body => { received = body; return response; }, () => {}, () => {});
    expect(received).toEqual({ mode: 'selfie', photos: ['selfie.jpg'], aspect: '16:9', resolution: '720p', consent: true });
  });

  it('retains successful uploads after one role fails and retries in middle-right-left order', async () => {
    const saved: UploadedGangnamStylePhoto[] = [];
    const uploaded: string[] = [];
    let failing = true;
    let received: unknown;
    const run = () => executeGangnamStyleSubmission(capture(), saved, async file => {
      uploaded.push(file.name);
      if (file.name === 'right.jpg' && failing) { failing = false; throw new Error('Upload disconnected'); }
      return { key: `saved/${file.name}` };
    }, async body => { received = body; return response; }, value => saved.push(value), () => {});
    await expect(run()).rejects.toThrow('Upload disconnected');
    expect(received).toBeUndefined();
    expect(await run()).toEqual(response);
    expect(uploaded).toEqual(['middle.jpg', 'right.jpg', 'right.jpg', 'left.jpg']);
    expect(received).toEqual({ mode: 'friends', photos: ['saved/middle.jpg', 'saved/right.jpg', 'saved/left.jpg'], aspect: '16:9', resolution: '720p', consent: true });
  });

  it('retries an uncertain create with saved photos and the same billing identity', async () => {
    const saved: UploadedGangnamStylePhoto[] = [];
    const requests: unknown[] = [];
    let uploads = 0;
    const run = () => executeGangnamStyleSubmission(capture(), saved, async file => { uploads++; return { key: file.name }; },
      async (body, key) => {
        requests.push({ ...body, key });
        if (requests.length === 1) throw new Error('Response lost after credits reserved');
        return response;
      }, value => saved.push(value), () => {});
    await expect(run()).rejects.toThrow('Response lost');
    expect(await run()).toEqual(response);
    expect(uploads).toBe(3);
    expect(requests).toEqual([
      { mode: 'friends', photos: ['middle.jpg', 'right.jpg', 'left.jpg'], aspect: '16:9', resolution: '720p', consent: true, key: 'request-1' },
      { mode: 'friends', photos: ['middle.jpg', 'right.jpg', 'left.jpg'], aspect: '16:9', resolution: '720p', consent: true, key: 'request-1' },
    ]);
  });

  it('never reuses a saved photo from another owner', async () => {
    let received: unknown;
    const submission = capture(trio().map((item, index) => ({ ...item, fingerprint: `owner-b:${index}` })));
    await executeGangnamStyleSubmission(submission, [{ fingerprint: 'owner-a:middle', photo: 'private-photo' }],
      async file => ({ key: file.name }), async body => { received = body.photos; return response; }, () => {}, () => {});
    expect(received).toEqual(['middle.jpg', 'right.jpg', 'left.jpg']);
  });

  it('does no upload or create work when cancelled before starting', async () => {
    let touched = false;
    await expect(executeGangnamStyleSubmission(capture(), [], async () => { touched = true; return { key: 'photo' }; },
      async () => { touched = true; return response; }, () => {}, () => { throw new Error('Cancelled'); })).rejects.toThrow('Cancelled');
    expect(touched).toBe(false);
  });

  it('stops before caching a late upload or uploading more roles after an account change', async () => {
    let current = true;
    let uploads = 0;
    let cached = false;
    let created = false;
    await expect(executeGangnamStyleSubmission(capture(), [], async () => {
      uploads++; current = false; return { key: 'old-owner-photo' };
    }, async () => { created = true; return response; }, () => { cached = true; },
    () => { if (!current) throw new Error('Account changed'); })).rejects.toThrow('Account changed');
    expect({ uploads, cached, created }).toEqual({ uploads: 1, cached: false, created: false });
  });

  it('rejects a late job response after the submitting account has changed', async () => {
    let current = true;
    await expect(executeGangnamStyleSubmission(capture(), [], async file => ({ key: file.name }),
      async () => { current = false; return response; }, () => {},
      () => { if (!current) throw new Error('Account changed'); })).rejects.toThrow('Account changed');
  });
});
