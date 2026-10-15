import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../lib/server/env';
import { ApiError } from '../lib/server/errors';
import { createFalOzilGoalVideo, getFalVideo } from '../lib/server/fal';
import { ProviderError } from '../lib/server/provider';

const env = { FAL_KEY: 'private-fal-test-key', APP_URL: 'https://qa.example.test', FAL_MEDIA_HOSTS: 'v3b.fal.media,v3.fal.media,fal.media' } as Env;
const requestId = 'request-123';
const root = `https://queue.fal.run/minimax/h3/requests/${requestId}`;
const receipt = { request_id: requestId, status_url: `${root}/status`, response_url: root, status: 'IN_QUEUE' };
const handle = JSON.stringify({ version: 1, requestId, statusUrl: receipt.status_url, resultUrl: receipt.response_url });
const photo = 'https://qa.example.test/api/media/photo?signature=private-photo';
const video = 'https://v3b.fal.media/files/result.mp4?token=private-video';
const rawError = `private-fal-test-key ${photo} ${video}`;
const fetchResponse = (body: unknown, status = 200) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body, { status }));

async function failure(operation: Promise<unknown>, uncertain: boolean, transientQuery = false) {
  let caught: unknown;
  try { await operation; } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(ProviderError);
  expect(caught).toMatchObject({ uncertain, transientQuery });
  expect(String(caught)).not.toMatch(/private-|signature=|token=/);
}
afterEach(() => vi.restoreAllMocks());

describe('Fal Ozil submission', () => {
  it('submits one fixed H3 request with references, native resolution and a 30 second deadline', async () => {
    const fetcher = fetchResponse(receipt);
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    expect(await createFalOzilGoalVideo(env, photo)).toBe(handle);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://queue.fal.run/minimax/h3/reference-to-video');
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual' });
    expect(new Headers(init?.headers).get('Authorization')).toBe('Key private-fal-test-key');
    expect(JSON.parse(String(init?.body))).toEqual({
      prompt: expect.stringContaining('Image 1'), duration: 15, resolution: '768P', aspect_ratio: '9:16',
      reference_image_urls: [photo], reference_video_urls: ['https://qa.example.test/templates/ozil-goal/motion.mp4'],
      prompt_expansion_mode: 'disabled', enable_safety_checker: true, sync_mode: false,
    });
    expect(JSON.parse(String(init?.body)).prompt).toContain('Video 1');
    expect(timeout).toHaveBeenCalledWith(30_000);
    expect(handle).not.toContain('private-');
  });

  it('accepts endpoint-specific queue paths and discards unrelated receipt fields', async () => {
    const endpointRoot = root.replace('/h3/', '/h3/reference-to-video/');
    fetchResponse({ ...receipt, status_url: `${endpointRoot}/status`, response_url: `${endpointRoot}/response`, secret: rawError });
    const stored = JSON.parse(await createFalOzilGoalVideo(env, photo));
    expect(stored).toEqual({ version: 1, requestId, statusUrl: `${endpointRoot}/status`, resultUrl: `${endpointRoot}/response` });
    expect(JSON.stringify(stored)).not.toContain('private-');
  });

  it('does not submit without credentials', async () => {
    const fetcher = fetchResponse(receipt);
    await expect(createFalOzilGoalVideo({ ...env, FAL_KEY: ' ' }, photo)).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([400, 401, 402, 403, 404, 422, 429])('classifies definitive HTTP %s rejection without leaking raw body', async status => {
    const fetcher = fetchResponse({ error: rawError }, status);
    await failure(createFalOzilGoalVideo(env, photo), false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([302, 307, 408, 500, 503])('does not retry an uncertain HTTP %s submission', async status => {
    const fetcher = fetchResponse({ error: rawError }, status);
    await failure(createFalOzilGoalVideo(env, photo), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('holds a network failure for reconciliation rather than submitting twice', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(rawError));
    await failure(createFalOzilGoalVideo(env, photo), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('holds an unreadable receipt for reconciliation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(rawError));
    await failure(createFalOzilGoalVideo(env, photo), true);
  });

  it.each([
    null, {}, { ...receipt, request_id: '../request-123' },
    { ...receipt, status_url: 'https://attacker.example/status' },
    { ...receipt, response_url: root.replace(requestId, 'other-task') },
  ])('holds an unverified receipt %# without resubmission', async body => {
    const fetcher = fetchResponse(body);
    await failure(createFalOzilGoalVideo(env, photo), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('Fal saved task polling', () => {
  it.each([['IN_QUEUE', 'pending'], ['IN_PROGRESS', 'processing']])('maps %s and makes only one GET', async (status, expected) => {
    const fetcher = fetchResponse({ request_id: requestId, status, queue_position: 2 });
    expect(await getFalVideo(env, handle)).toEqual({ status: expected });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(receipt.status_url, expect.objectContaining({ method: 'GET', redirect: 'manual' }));
    expect(fetcher.mock.calls[0][1]?.body).toBeUndefined();
  });

  it.each([
    'https://attacker.test/status', 'http://queue.fal.run/minimax/h3/requests/request-123/status',
    `${root}/status?redirect=private-fal-test-key`, `${root}/status#fragment`,
    `${root.replace('queue.fal.run', 'user:pass@queue.fal.run')}/status`,
    `${root.replace('queue.fal.run', 'queue.fal.run:443')}/status`,
    `${root.replace('queue.fal.run', 'queue.fal.run.evil.test')}/status`,
    `${root.replace(requestId, 'different-task')}/status`, `${root.replace('minimax/h3', 'other/model')}/status`,
  ])('does not send credentials to an invalid queue handle %#', async statusUrl => {
    const fetcher = fetchResponse({});
    await failure(getFalVideo(env, JSON.stringify({ ...JSON.parse(handle), statusUrl })), true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['', 'null', '{}', '{', JSON.stringify({ ...JSON.parse(handle), version: 2 }), JSON.stringify({ ...JSON.parse(handle), resultUrl: 'https://attacker.test' })])('rejects a malformed saved handle %# before fetching', async value => {
    const fetcher = fetchResponse({});
    await failure(getFalVideo(env, value), true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([302, 307, 408, 429, 500, 503])('keeps query HTTP %s retryable without resubmission', async status => {
    const fetcher = fetchResponse({ error: rawError }, status);
    await failure(getFalVideo(env, handle), false, true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
  });

  it('keeps a failed query transport retryable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(rawError));
    await failure(getFalVideo(env, handle), false, true);
  });

  it('keeps an unreadable query retryable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(rawError));
    await failure(getFalVideo(env, handle), false, true);
  });

  it.each([{ request_id: 'another-task', status: 'COMPLETED' }, { request_id: requestId, status: 'UNKNOWN' }])('rejects inconsistent status %# before reading results', async response => {
    const fetcher = fetchResponse(response);
    await failure(getFalVideo(env, handle), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([{ error: rawError }, { error_type: 'runner_server_error' }])('handles completed failure metadata %# without trusting a result', async fields => {
    const fetcher = fetchResponse({ request_id: requestId, status: 'COMPLETED', ...fields });
    const result = await getFalVideo(env, handle);
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('private-');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([{ error: { message: rawError } }, { error_type: ['runner_server_error'] }])('holds malformed failure metadata %# for review instead of refunding', async fields => {
    const fetcher = fetchResponse({ request_id: requestId, status: 'COMPLETED', ...fields });
    await failure(getFalVideo(env, handle), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retrieves and normalizes a valid completed video using only GET', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ request_id: requestId, status: 'COMPLETED' }))
      .mockResolvedValueOnce(Response.json({ video: { url: video, content_type: 'video/mp4' } }));
    expect(await getFalVideo(env, handle)).toEqual({ status: 'completed', result: { videos: [{ url: [video] }] } });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([receipt.status_url, receipt.response_url]);
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });

  it('does not mistake an error-bearing result for a completed video', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ request_id: requestId, status: 'COMPLETED' }))
      .mockResolvedValueOnce(Response.json({ error: rawError, error_type: 'runner_server_error', video: { url: video } }));
    const result = await getFalVideo(env, handle);
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('private-');
  });

  it.each(['http://v3b.fal.media/x.mp4', 'https://user:pass@v3b.fal.media/x.mp4', 'https://v3b.fal.media:8443/x.mp4', 'https://v3b.fal.media.attacker.test/x.mp4', ` ${video}`])('rejects unsafe result media %# without downloading it', async url => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ request_id: requestId, status: 'COMPLETED' }))
      .mockResolvedValueOnce(Response.json({ video: { url } }));
    await failure(getFalVideo(env, handle), true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
