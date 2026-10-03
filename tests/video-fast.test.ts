import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob } from '../lib/server/jobs';
import { verifyMediaSignature } from '../lib/server/media';

afterEach(() => vi.restoreAllMocks());

describe('Seedance 2.0 Fast video submission', () => {
  it('reviews both private photos for Fast and submits one compatible paid task in left/right order', async () => {
    const d = database(), env = jobEnv(d.db);
    const input = { leftImage: 'users/u/uploads/left', rightImage: 'users/u/uploads/right', duration: 5, resolution: '720p', aspect: '9:16', mode: 'pet' };
    const job = await reserveGeneration(d.db, 'u', 'fast-duo', 'video', input, 50);
    const calls: { path: string; body: any }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const path = new URL(String(url)).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ path, body });
      if (path === '/v1/seedance2/private-avatar') return Response.json({ code: 200, data: { id: calls.length === 1 ? 'review_left' : 'review_right', status: 'submitted' } });
      if (path === '/v1/tasks/review_left') return Response.json({ code: 200, data: { status: 'completed', result: { usable_assets: [{ asset_url: 'asset://left' }] } } });
      if (path === '/v1/tasks/review_right') return Response.json({ code: 200, data: { status: 'completed', result: { usable_assets: [{ asset_url: 'asset://right' }] } } });
      if (path === '/v1/videos/generations') return Response.json({ code: 200, data: [{ task_id: 'fast_video', status: 'submitted' }] });
      throw new Error(`Unexpected request: ${path}`);
    });

    for (let step = 0; step < 5; step++) {
      d.sqlite.prepare('UPDATE generations SET next_poll=0 WHERE id=?').run(job.id);
      await advanceJob(env, job.id);
    }

    const reviews = calls.filter(call => call.path === '/v1/seedance2/private-avatar');
    expect(reviews).toHaveLength(2);
    for (const [index, key] of [input.leftImage, input.rightImage].entries()) {
      expect(reviews[index].body).toEqual({ group: { name: `${job.id}-${index === 0 ? 'left' : 'right'}` }, asset_type: 'Image', assets: [{ url: expect.any(String), name: `${job.id}-${index === 0 ? 'left' : 'right'}` }] });
      const url = new URL(reviews[index].body.assets[0].url);
      expect(await verifyMediaSignature(env, key, url)).toBe(true);
    }
    const submissions = calls.filter(call => call.path === '/v1/videos/generations');
    expect(submissions).toHaveLength(1);
    expect(submissions[0].body).toEqual({
      model: 'seedance-2.0-fast', image_urls: ['asset://left', 'asset://right'],
      prompt: expect.stringContaining('two expressive pets'), duration: 5,
      resolution: '720p', size: '9:16', generate_audio: true, nsfw_check: true,
    });
    expect(d.sqlite.prepare('SELECT status,stage,provider_id FROM generations WHERE id=?').get(job.id)).toMatchObject({ status: 'processing', stage: 'polling', provider_id: 'fast_video' });
    expect(d.sqlite.prepare("SELECT COUNT(*) AS n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
    expect(d.sqlite.prepare('SELECT credits FROM users WHERE id=\'u\'').get()?.credits).toBe(50);
  });
});
