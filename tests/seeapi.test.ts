import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../lib/server/env';
import { createVideoModeration, getVideoModeration, SeeApiError } from '../lib/server/seeapi';

const env = { SEEAPI_API_KEY: 'test-secret-that-must-not-leak' } as Env;
const id = 'task_test-123';
const endpoint = 'https://api.seeapi.com/v1/inferences';
const persistedBody = '{ "model": "video-nsfw-filter", "endpoint":"video-moderation", "provider":"seeapi", "input":{"video_url":"https://media.example.test/video?token=private","num_frames":32}}\n';

function task(status = 'queued') {
  return { id, object: 'inference', model: 'video-nsfw-filter', endpoint: 'video-moderation', provider: 'seeapi', status, result: null, error: null };
}
function cleanReport(): any {
  return { ...task('succeeded'), result: { type: 'json', data: { flagged: false, output: {
    nsfw_detected: false, scope: 'sampled_frames', sampling_complete: true, checked_frames: 2,
    timestamp_source: 'frame_index_div_fps_estimate', output_layout: 'named-files-v1', report_schema_version: 5,
    flagged_frame_count: 0, frames: [
      { frame_number: 1, timestamp_seconds: 0, nsfw_detected: false, nsfw: [], special: [] },
      { frame_number: 901, timestamp_seconds: 30, nsfw_detected: false, nsfw: [] },
    ],
  } } } };
}
function respond(value: unknown, status = 200, headers?: HeadersInit) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(value, { status, headers }));
}
async function expectFailure(operation: Promise<unknown>, retryable: boolean, retryAfter?: number) {
  let caught: unknown;
  try { await operation; } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(SeeApiError);
  expect(caught).toMatchObject({ retryable, retryAfter });
  expect(String(caught)).not.toContain('test-secret-that-must-not-leak');
  expect(String(caught)).not.toContain('token=private');
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('SeeAPI idempotent submission', () => {
  it('sends the identical persisted body and idempotency key on retries', async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json(task(), { status: 202 });
    });
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    expect(await createVideoModeration(env, persistedBody, 'moderation-generation-1')).toEqual({ id });
    expect(await createVideoModeration(env, persistedBody, 'moderation-generation-1')).toEqual({ id });
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.url).toBe(endpoint);
      expect(request.init).toMatchObject({ method: 'POST', body: persistedBody, redirect: 'manual' });
      const headers = new Headers(request.init?.headers);
      expect(headers.get('Authorization')).toBe('Bearer test-secret-that-must-not-leak');
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('User-Agent')).toBe('MigosAI-Moderation/1.0 (+https://migosai.design)');
      expect(headers.get('Idempotency-Key')).toBe('moderation-generation-1');
      expect(request.init?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(timeout).toHaveBeenCalledWith(20_000);
  });
  it('retains the existing task id when an idempotent replay is already completed', async () => {
    respond(cleanReport());
    expect(await createVideoModeration(env, persistedBody, 'stable-key')).toEqual({ id });
  });
  it('rejects missing credentials before sending any request', async () => {
    const fetcher = respond(task());
    await expectFailure(createVideoModeration({} as Env, persistedBody, 'stable-key'), false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['', 'x'.repeat(256), 'invalid\r\nkey'])('rejects an unusable idempotency key (%s)', async (key) => {
    const fetcher = respond(task());
    await expectFailure(createVideoModeration(env, persistedBody, key), false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([null, {}, { id: '../private' }, { ...task(), id: '' }, { ...task(), model: 'wrong' }])('rejects an unidentifiable creation response %#', async (value) => {
    respond(value);
    await expectFailure(createVideoModeration(env, persistedBody, 'stable-key'), false);
  });
});

describe('SeeAPI moderation verdicts', () => {
  it('passes only a complete clean report, without requiring optional frame images or special labels', async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json(cleanReport());
    });
    expect(await getVideoModeration(env, id)).toEqual({ verdict: 'passed', checkedFrames: 2, flaggedFrames: 0 });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(`${endpoint}/${id}`);
    expect(requests[0].init).toMatchObject({ method: 'GET', redirect: 'manual' });
    expect(requests[0].init?.body).toBeUndefined();
  });
  it.each(['queued', 'processing'])('keeps %s pending', async (status) => {
    respond(task(status));
    expect(await getVideoModeration(env, id)).toEqual({ verdict: 'pending' });
  });
  it('blocks a dirty report even though its execution succeeded', async () => {
    const report = cleanReport();
    report.result.data.flagged = true;
    report.result.data.output.nsfw_detected = true;
    report.result.data.output.flagged_frame_count = 1;
    report.result.data.output.frames[0].nsfw_detected = true;
    report.result.data.output.frames[0].nsfw = ['explicit'];
    respond(report);
    expect(await getVideoModeration(env, id)).toEqual({ verdict: 'blocked', checkedFrames: 2, flaggedFrames: 1 });
  });
  it('blocks content_policy_blocked without requiring a frame report', async () => {
    respond({ ...task('succeeded'), result: { type: 'json', data: { flagged: true, output: null, reason: 'content_policy_blocked', message: 'Blocked.' } } });
    expect(await getVideoModeration(env, id)).toEqual({ verdict: 'blocked' });
  });
  it.each(['failed', 'cancelled', 'canceled', 'completed', 'unknown', ''])('does not retry or pass terminal/unknown state %s', async (status) => {
    respond({ ...task(status), error: { code: 'failure', message: persistedBody } });
    await expectFailure(getVideoModeration(env, id), false);
  });
  const invalidChanges: [string, (r: any) => void][] = [
    ['different task id', r => { r.id = 'task_other'; }],
    ['missing task id', r => { delete r.id; }],
    ['wrong resource type', r => { r.object = 'generation'; }],
    ['wrong model', r => { r.model = 'image-nsfw-filter'; }],
    ['wrong endpoint', r => { r.endpoint = 'other'; }],
    ['wrong provider', r => { r.provider = 'other'; }],
    ['non-null task error', r => { r.error = { code: 'x' }; }],
    ['missing task error', r => { delete r.error; }],
    ['missing result', r => { r.result = null; }],
    ['wrong result type', r => { r.result.type = 'text'; }],
    ['missing overall flag', r => { delete r.result.data.flagged; }],
    ['non-boolean overall flag', r => { r.result.data.flagged = 'false'; }],
    ['missing output', r => { r.result.data.output = null; }],
    ['contradictory policy block', r => { r.result.data.reason = 'content_policy_blocked'; }],
    ['unknown result reason', r => { r.result.data.reason = 'unknown'; }],
    ['dirty output despite clean flag', r => { r.result.data.output.nsfw_detected = true; }],
    ['missing output flag', r => { delete r.result.data.output.nsfw_detected; }],
    ['unknown coverage scope', r => { r.result.data.output.scope = 'whole_video'; }],
    ['incomplete sampling', r => { r.result.data.output.sampling_complete = false; }],
    ['missing sampling status', r => { delete r.result.data.output.sampling_complete; }],
    ['zero checked frames', r => { r.result.data.output.checked_frames = 0; }],
    ['too many checked frames', r => { r.result.data.output.checked_frames = 33; }],
    ['fractional checked frames', r => { r.result.data.output.checked_frames = 1.5; }],
    ['checked frames mismatch', r => { r.result.data.output.checked_frames = 3; }],
    ['wrong report layout', r => { r.result.data.output.output_layout = 'unknown'; }],
    ['wrong report version', r => { r.result.data.output.report_schema_version = 6; }],
    ['flagged frame count conflict', r => { r.result.data.output.flagged_frame_count = 1; }],
    ['missing flagged frame count', r => { delete r.result.data.output.flagged_frame_count; }],
    ['missing frames', r => { delete r.result.data.output.frames; }],
    ['non-object frame', r => { r.result.data.output.frames[0] = null; }],
    ['duplicate source frames', r => { r.result.data.output.frames[1].frame_number = 1; }],
    ['zero source frame', r => { r.result.data.output.frames[0].frame_number = 0; }],
    ['fractional source frame', r => { r.result.data.output.frames[0].frame_number = 1.5; }],
    ['invalid timestamp type', r => { r.result.data.output.frames[0].timestamp_seconds = '0'; }],
    ['negative timestamp', r => { r.result.data.output.frames[0].timestamp_seconds = -0.01; }],
    ['timestamp outside duration limit', r => { r.result.data.output.frames[0].timestamp_seconds = 30.01; }],
    ['non-finite timestamp', r => { r.result.data.output.frames[0].timestamp_seconds = Infinity; }],
    ['dirty individual frame', r => { r.result.data.output.frames[0].nsfw_detected = true; }],
    ['missing individual frame flag', r => { delete r.result.data.output.frames[0].nsfw_detected; }],
    ['contradictory NSFW labels', r => { r.result.data.output.frames[0].nsfw = ['explicit']; }],
    ['missing NSFW labels', r => { delete r.result.data.output.frames[0].nsfw; }],
    ['invalid NSFW labels type', r => { r.result.data.output.frames[0].nsfw = ''; }],
    ['contradictory special labels', r => { r.result.data.output.frames[0].special = ['sensitive']; }],
    ['invalid special labels type', r => { r.result.data.output.frames[0].special = null; }],
  ];
  it.each(invalidChanges)('fails closed for %s', async (_name, mutate) => {
    const report = cleanReport();
    mutate(report);
    respond(report);
    await expectFailure(getVideoModeration(env, id), false);
  });
  it.each(['', '../private', 'task/id', 'task?other=true', 'task%2fid', 'x'.repeat(201)])('rejects unsafe task id %s before fetch', async (unsafeId) => {
    const fetcher = respond(cleanReport());
    await expectFailure(getVideoModeration(env, unsafeId), false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('SeeAPI transport failures', () => {
  it.each([408, 429, 500, 502, 503])('marks HTTP %i retryable and cancels the body', async (status) => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }), { status, headers: { 'Retry-After': '17' } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    await expectFailure(getVideoModeration(env, id), true, 17);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it.each([300, 301, 302, 307, 308, 400, 401, 402, 403, 404, 409, 422])('marks HTTP %i permanent without following a redirect', async (status) => {
    const requests: RequestInit[] = [];
    const cancel = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      requests.push(init!);
      return new Response(new ReadableStream({ cancel }), { status, headers: { Location: 'https://attacker.example.test' } });
    });
    await expectFailure(createVideoModeration(env, persistedBody, 'stable-key'), false);
    expect(requests).toHaveLength(1);
    expect(requests[0].redirect).toBe('manual');
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('ignores cancellation failures and retains the HTTP classification', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ReadableStream({ cancel() { throw new Error(persistedBody); } }), { status: 429 }));
    await expectFailure(getVideoModeration(env, id), true);
  });
  it.each([['99999', 600], ['0', 0], ['garbage', undefined], ['-2', undefined]])('bounds Retry-After %s', async (header, expected) => {
    respond({}, 429, { 'Retry-After': String(header) });
    await expectFailure(getVideoModeration(env, id), true, expected as number | undefined);
  });
  it('supports HTTP-date Retry-After values', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T00:00:00Z'));
    respond({}, 503, { 'Retry-After': 'Fri, 02 Oct 2026 00:00:45 GMT' });
    await expectFailure(getVideoModeration(env, id), true, 45);
  });
  it('classifies network and timeout failures as retryable without leaking their messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(`test-secret-that-must-not-leak ${persistedBody}`));
    await expectFailure(createVideoModeration(env, persistedBody, 'stable-key'), true);
  });
  it('classifies truncated JSON as retryable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"id":'));
    await expectFailure(getVideoModeration(env, id), true);
  });
  it('classifies a failed response stream as retryable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.error(new Error(persistedBody)); } })));
    await expectFailure(getVideoModeration(env, id), true);
  });
  it('rejects oversized Content-Length and cancels without consuming the response', async () => {
    const cancel = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Length': '131073' } }));
    await expectFailure(getVideoModeration(env, id), false);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('bounds streamed bytes even when Content-Length is absent or misleading', async () => {
    const cancel = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(70_000)); controller.enqueue(new Uint8Array(70_000)); }, cancel,
    }), { headers: { 'Content-Length': '100' } }));
    await expectFailure(getVideoModeration(env, id), false);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
