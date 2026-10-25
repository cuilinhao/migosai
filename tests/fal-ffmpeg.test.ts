import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../lib/server/env';
import { ApiError } from '../lib/server/errors';
import { createFalWindowPeeperAudio, getFalWindowPeeperAudio } from '../lib/server/fal-ffmpeg';
import { ProviderError } from '../lib/server/provider';

const env = { FAL_KEY: 'private-fal-test-key', APP_URL: 'https://qa.example.test/path', FAL_MEDIA_HOSTS: 'v3b.fal.media,v3.fal.media,fal.media' } as Env;
const requestId = 'ffmpeg-request-123';
const endpoint = 'https://queue.fal.run/fal-ai/ffmpeg-api/merge-audio-video';
const root = `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}`;
const receipt = { request_id: requestId, status_url: `${root}/status`, response_url: root };
const parsedHandle = { version: 1, requestId, statusUrl: receipt.status_url, resultUrl: receipt.response_url };
const handle = JSON.stringify(parsedHandle);
const video = 'https://v3b.fal.media/files/input.mp4?token=private-video';
const output = 'https://v3.fal.media/files/output.mp4';
const rawError = `private-fal-test-key ${video}`;
const response = (body: unknown, status = 200) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body, { status }));
async function failure(operation: Promise<unknown>, uncertain: boolean, transientQuery = false) {
  let caught: unknown;
  try { await operation; } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(ProviderError);
  expect(caught).toMatchObject({ uncertain, transientQuery });
  expect(String(caught)).not.toMatch(/private-|token=/);
}
afterEach(() => vi.restoreAllMocks());

describe('Window Peeper fixed soundtrack FFmpeg submission', () => {
  it('submits exactly one audio replacement, without calling a generation model', async () => {
    const fetcher = response(receipt);
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    expect(await createFalWindowPeeperAudio(env, video)).toBe(handle);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(endpoint);
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual' });
    expect(new Headers(init?.headers).get('Authorization')).toBe('Key private-fal-test-key');
    expect(new Headers(init?.headers).get('X-Fal-No-Retry')).toBe('1');
    expect(JSON.parse(String(init?.body))).toEqual({ video_url: video, audio_url: 'https://qa.example.test/templates/window-peeper/soundtrack.m4a', start_offset: 0 });
    expect(timeout).toHaveBeenCalledWith(30_000);
  });

  it('accepts an exact endpoint-specific receipt and keeps only the queue handle', async () => {
    const endpointRoot = `${endpoint}/requests/${requestId}`;
    response({ ...receipt, status_url: `${endpointRoot}/status`, response_url: `${endpointRoot}/response`, extra: rawError });
    expect(JSON.parse(await createFalWindowPeeperAudio(env, video))).toEqual({ ...parsedHandle, statusUrl: `${endpointRoot}/status`, resultUrl: `${endpointRoot}/response` });
  });

  it.each([
    'https://evil.test/video.mp4', 'http://v3b.fal.media/video.mp4', `${video}#fragment`, `${video}#`, ` ${video}`, `${video}\n`,
    'https://user:pass@v3b.fal.media/video.mp4', 'https://@v3b.fal.media/video.mp4',
    'https://v3b.fal.media.evil.test/video.mp4', 'https://v3b.fal.media:444/video.mp4',
    'https://v3b.fal.media\\@evil.test/video.mp4', '',
  ])('rejects unsafe source URL %# before making any request', async url => {
    const fetcher = response(receipt);
    await failure(createFalWindowPeeperAudio(env, url), false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requires a configured key before submitting', async () => {
    const fetcher = response(receipt);
    await expect(createFalWindowPeeperAudio({ ...env, FAL_KEY: ' ' }, video)).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([400, 401, 402, 403, 404, 405, 422, 429])('does not retry definitive POST %s rejection', async status => {
    const fetcher = response({ error: rawError }, status);
    await failure(createFalWindowPeeperAudio(env, video), false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([302, 307, 408, 500, 503])('holds ambiguous POST %s without retrying', async status => {
    const fetcher = response({ error: rawError }, status);
    await failure(createFalWindowPeeperAudio(env, video), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('holds a network error without submitting twice', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(rawError));
    await failure(createFalWindowPeeperAudio(env, video), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('holds an unreadable submission response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(rawError));
    await failure(createFalWindowPeeperAudio(env, video), true);
  });
  it.each([null, {}, { ...receipt, request_id: '../bad' }, { ...receipt, status_url: 'https://evil.test/status' }, { ...receipt, response_url: root.replace(requestId, 'other') }])('holds an unverified receipt %#', async body => {
    const fetcher = response(body);
    await failure(createFalWindowPeeperAudio(env, video), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('Window Peeper FFmpeg saved handle polling', () => {
  it.each([['IN_QUEUE', 'pending'], ['IN_PROGRESS', 'processing']])('maps %s using only the saved GET', async (status, expected) => {
    const fetcher = response({ request_id: requestId, status });
    expect(await getFalWindowPeeperAudio(env, handle)).toEqual({ status: expected });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(receipt.status_url, expect.objectContaining({ method: 'GET', redirect: 'manual' }));
    expect(fetcher.mock.calls[0][1]?.body).toBeUndefined();
  });
  it.each([
    `${root}/status?x=1`, `${root}/status#x`, `${root}/status `,
    `${root.replace('queue.fal.run', 'user:pass@queue.fal.run')}/status`,
    `${root.replace('queue.fal.run', 'queue.fal.run:443')}/status`,
    `${root.replace('queue.fal.run', 'queue.fal.run.evil.test')}/status`,
    `${root.replace('fal-ai/ffmpeg-api', 'minimax/h3')}/status`,
    `${root.replace(requestId, 'other-task')}/status`, 'https://evil.test/status',
  ])('never sends credentials to an unverified queue URL %#', async statusUrl => {
    const fetcher = response({});
    await failure(getFalWindowPeeperAudio(env, JSON.stringify({ ...parsedHandle, statusUrl })), true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['', '{', 'null', '{}', JSON.stringify({ ...parsedHandle, version: 2 }), JSON.stringify({ ...parsedHandle, resultUrl: 'https://evil.test' })])('rejects malformed handles %# before fetching', async value => {
    const fetcher = response({});
    await failure(getFalWindowPeeperAudio(env, value), true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([404, 405])('does not invent a fallback namespace after GET %s', async status => {
    const fetcher = response({ error: rawError }, status);
    await failure(getFalWindowPeeperAudio(env, handle), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([302, 408, 429, 500, 503])('retains the saved handle after transient GET %s', async status => {
    const fetcher = response({ error: rawError }, status);
    await failure(getFalWindowPeeperAudio(env, handle), false, true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('classifies GET network failure as retryable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(rawError));
    await failure(getFalWindowPeeperAudio(env, handle), false, true);
  });
  it.each([{ request_id: 'other', status: 'COMPLETED' }, { request_id: requestId, status: 'UNKNOWN' }, { request_id: requestId, status: 'IN_PROGRESS', error: rawError }])('holds inconsistent status %#', async body => {
    const fetcher = response(body);
    await failure(getFalWindowPeeperAudio(env, handle), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('returns a terminal failure without exposing provider error strings', async () => {
    response({ request_id: requestId, status: 'COMPLETED', error: rawError });
    expect(await getFalWindowPeeperAudio(env, handle)).toEqual({ status: 'failed' });
  });
  it.each(['video/mp4', undefined, null])('returns a verified video result with optional MIME %#', async contentType => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ request_id: requestId, status: 'COMPLETED' }))
      .mockResolvedValueOnce(Response.json({ video: { url: output, content_type: contentType } }));
    expect(await getFalWindowPeeperAudio(env, handle)).toEqual({ status: 'completed', result: { videos: [{ url: [output] }] } });
    expect(fetcher).toHaveBeenNthCalledWith(2, receipt.response_url, expect.objectContaining({ method: 'GET' }));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([{ video: { url: 'https://evil.test/file.mp4' } }, { video: { url: `${output}#x` } }, { video: { url: output, content_type: 'text/html' } }, { video: {} }, { error: {} }])('holds unverified result %#', async body => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ request_id: requestId, status: 'COMPLETED' })).mockResolvedValueOnce(Response.json(body));
    await failure(getFalWindowPeeperAudio(env, handle), true);
  });
  it.each([[422, {}], [500, { error_type: 'runner_server_error' }], [200, { error: rawError }]])('returns failed for definitive completed-task result %#', async (status, body) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ request_id: requestId, status: 'COMPLETED' })).mockResolvedValueOnce(Response.json(body, { status: Number(status) }));
    expect(await getFalWindowPeeperAudio(env, handle)).toEqual({ status: 'failed' });
  });
  it('retries transport failure when reading a completed task result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ request_id: requestId, status: 'COMPLETED' })).mockResolvedValueOnce(Response.json({ error: rawError }, { status: 503 }));
    await failure(getFalWindowPeeperAudio(env, handle), false, true);
  });
});
