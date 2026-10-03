import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateVideoRequest } from '../lib/contracts';
import type { Env } from '../lib/server/env';
import { ApiError } from '../lib/server/errors';
import { createKieVideo, getKieVideo } from '../lib/server/kie';
import { ProviderError } from '../lib/server/provider';

const env = { KIE_API_KEY: 'private-kie-test-key' } as Env;
const taskId = 'task_bytedance_1765186743319';
const payload: CreateVideoRequest = {
  leftImage: 'users/u/uploads/left', rightImage: 'users/u/uploads/right',
  aspect: '9:16', duration: 5, resolution: '720p', mode: 'pet',
};
const references = ['https://media.example.test/left?token=private', 'https://media.example.test/right?token=private'];
const resultUrl = 'https://video.example.test/output.mp4?token=private';

function respond(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body, { status }));
}
function record(state: string, fields: Record<string, unknown> = {}) {
  return { code: 200, msg: 'success', data: {
    taskId, model: 'bytedance/seedance-2', state, param: '{}', resultJson: null,
    failCode: null, failMsg: null, createTime: 1698765400000, updateTime: 1698765432000,
    ...fields,
  } };
}
async function failure(operation: Promise<unknown>, uncertain: boolean, transientQuery = false) {
  let caught: unknown;
  try { await operation; } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(ProviderError);
  expect(caught).toMatchObject({ uncertain, transientQuery });
  expect(String(caught)).not.toContain('private-kie-test-key');
  expect(String(caught)).not.toContain('token=private');
  return caught as ProviderError;
}
afterEach(() => vi.restoreAllMocks());

describe('Kie standard Seedance submission', () => {
  it('submits Wan with separate motion and song references and uppercase resolution', async () => {
    const fetcher = respond({ code: 200, data: { taskId } });
    await createKieVideo(env, { ...payload, model: 'wan-3.0', scene: 'hotel-lobby', motion: 'video', soundtrack: 'song' }, references,
      { videoUrls: ['https://media.example.test/motion.mp4'], audioUrls: ['https://media.example.test/song.wav'] });
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ model: 'wan/3-0-video', input: {
      reference_image_urls: references, reference_video_urls: ['https://media.example.test/motion.mp4'],
      reference_audio_urls: ['https://media.example.test/song.wav'], resolution: '720P', audio: true,
    } });
    expect(body.input.generate_audio).toBeUndefined();
    expect(body.input.first_frame_url).toBeUndefined();
    expect(body.input.prompt).toContain('Video1');
    expect(body.input.prompt).toContain('Audio1');
    expect(body.input.prompt).not.toContain('Original instrumental and lyrics');
  });

  it('selects Fast without losing the uploaded motion reference or rap topic', async () => {
    const fetcher = respond({ code: 200, data: { taskId } });
    await createKieVideo(env, { ...payload, model: 'seedance-2-fast', scene: 'street-cypher', soundtrack: 'ai', topic: 'weekend adventures' }, references,
      { videoUrls: ['https://media.example.test/motion.mp4'] });
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ model: 'bytedance/seedance-2-fast', input: { resolution: '720p', generate_audio: true,
      reference_video_urls: ['https://media.example.test/motion.mp4'] } });
    expect(body.input.reference_audio_urls).toBeUndefined();
    expect(body.input.prompt).toContain('weekend adventures');
    expect(body.input.prompt).toContain('street');
  });

  it('submits left and right reference images once with standard Seedance options and audio', async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json({ code: 200, msg: 'success', data: { taskId } });
    });
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    expect(await createKieVideo(env, payload, references)).toBe(taskId);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://api.kie.ai/api/v1/jobs/createTask');
    expect(requests[0].init).toMatchObject({ method: 'POST', redirect: 'manual' });
    const headers = new Headers(requests[0].init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer private-kie-test-key');
    expect(headers.get('Content-Type')).toBe('application/json');
    const body = JSON.parse(String(requests[0].init?.body));
    expect(body).toEqual({ model: 'bytedance/seedance-2', input: {
      reference_image_urls: references, prompt: expect.any(String), duration: 5,
      resolution: '720p', aspect_ratio: '9:16', generate_audio: true, nsfw_checker: true,
    } });
    expect(body.input.prompt).toContain('two expressive pets');
    expect(body.input.prompt).toContain('@图片1 is the left subject and @图片2 is the right subject');
    expect(requests[0].init?.signal).toBeInstanceOf(AbortSignal);
    expect(timeout).toHaveBeenCalledWith(20_000);
  });

  it('rejects missing credentials before a paid request', async () => {
    const fetcher = respond({ code: 200, data: { taskId } });
    await expect(createKieVideo({}, payload, references)).rejects.toBeInstanceOf(ApiError);
    await expect(createKieVideo({ KIE_API_KEY: ' ' } as Env, payload, references)).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([400, 401, 402, 404, 422, 429])('treats HTTP %s as a definitive rejection', async status => {
    const fetcher = respond({ msg: 'private-kie-test-key token=private' }, status);
    await failure(createKieVideo(env, payload, references), false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([302, 307, 408, 500, 503])('does not retry ambiguous HTTP %s paid submissions', async status => {
    const fetcher = respond({ msg: 'private-kie-test-key token=private' }, status);
    await failure(createKieVideo(env, payload, references), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([401, 402, 422, 429, 433, 455, 501, 505])('recognizes business rejection %s without leaking provider text', async code => {
    respond({ code, msg: 'private-kie-test-key token=private', data: null });
    await failure(createKieVideo(env, payload, references), false);
  });

  it('keeps server business failures uncertain', async () => {
    respond({ code: 500, msg: 'private-kie-test-key token=private', data: null });
    await failure(createKieVideo(env, payload, references), true);
  });

  it('does not retry a submission after a network failure', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('private-kie-test-key token=private'));
    await failure(createKieVideo(env, payload, references), true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { code: '200', data: { taskId } }, { code: 200, data: {} },
    { code: 200, data: { taskId: '' } }, { code: 200, data: { taskId: '../private-kie-test-key' } }])(
    'does not resubmit an unverified task receipt %#', async body => {
      respond(body);
      await failure(createKieVideo(env, payload, references), true);
    },
  );

  it('marks unreadable submission responses uncertain', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('private-kie-test-key token=private'));
    await failure(createKieVideo(env, payload, references), true);
  });
});

describe('Kie task polling', () => {
  it.each([['wan-3.0', 'wan/3-0-video'], ['seedance-2-fast', 'bytedance/seedance-2-fast']] as const)(
    'polls a persisted %s model without confusing it with standard Seedance', async (model, providerModel) => {
      respond(record('success', { model: providerModel, resultJson: JSON.stringify({ resultUrls: [resultUrl] }) }));
      expect(await getKieVideo(env, taskId, model)).toEqual({ status: 'completed', result: { videos: [{ url: [resultUrl] }] } });
    },
  );
  it('rejects a result whose model differs from the persisted Wan selection', async () => {
    respond(record('success', { resultJson: JSON.stringify({ resultUrls: [resultUrl] }) }));
    await failure(getKieVideo(env, taskId, 'wan-3.0'), true);
  });
  it.each([
    ['waiting', 'pending'], ['queuing', 'pending'], ['generating', 'processing'],
  ])('normalizes %s to %s', async (state, status) => {
    const requests: { url: string; init?: RequestInit }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json(record(state));
    });
    expect(await getKieVideo(env, taskId)).toEqual({ status });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      url: `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
      init: { method: 'GET', redirect: 'manual' },
    });
    expect(requests[0].init?.body).toBeUndefined();
    expect(new Headers(requests[0].init?.headers).get('Authorization')).toBe('Bearer private-kie-test-key');
  });

  it('decodes a completed result into the existing media result format', async () => {
    respond(record('success', { resultJson: JSON.stringify({ resultUrls: [resultUrl] }), failCode: '', failMsg: '' }));
    expect(await getKieVideo(env, taskId)).toEqual({ status: 'completed', result: { videos: [{ url: [resultUrl] }] } });
  });

  it('accepts a polling response without the optional model field', async () => {
    respond({ code: 200, data: { taskId, state: 'waiting' } });
    expect(await getKieVideo(env, taskId)).toEqual({ status: 'pending' });
  });

  it('returns a sanitized terminal failure', async () => {
    respond(record('fail', { failCode: 'UPSTREAM_FAILURE', failMsg: 'private-kie-test-key token=private' }));
    expect(await getKieVideo(env, taskId)).toEqual({ status: 'failed', error: {
      code: 'task_failed', message: 'The video generation could not be completed.',
    } });
  });

  it('preserves a known content-policy classification without exposing raw details', async () => {
    respond(record('fail', { failCode: 'content_policy_violation', failMsg: 'private-kie-test-key token=private' }));
    expect(await getKieVideo(env, taskId)).toEqual({ status: 'failed', error: {
      code: 'content_policy_blocked', message: 'The generation service rejected this content.',
    } });
  });

  it.each(['', '../another-task', 'task?token=private'])('rejects unsafe task identifier %s before querying', async id => {
    const fetcher = respond(record('waiting'));
    await failure(getKieVideo(env, id), false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([302, 307, 408, 429, 500, 503])('retries only the saved-task query after HTTP %s', async status => {
    const fetcher = respond({ msg: 'private-kie-test-key token=private' }, status);
    await failure(getKieVideo(env, taskId), false, true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([401, 404, 422])('classifies definitive HTTP %s query rejection without provider text', async status => {
    respond({ msg: 'private-kie-test-key token=private' }, status);
    await failure(getKieVideo(env, taskId), false);
  });

  it.each([408, 429, 455, 500, 503])('keeps a saved task retryable after transient business code %s', async code => {
    respond({ code, msg: 'private-kie-test-key token=private', data: null });
    await failure(getKieVideo(env, taskId), false, true);
  });

  it('keeps a saved task retryable after a network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('private-kie-test-key token=private'));
    await failure(getKieVideo(env, taskId), false, true);
  });

  it('keeps a saved task retryable after an unreadable response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('private-kie-test-key token=private'));
    await failure(getKieVideo(env, taskId), false, true);
  });

  it.each([
    { taskId: 'other-task' }, { taskId: undefined }, { model: 'bytedance/seedance-2-fast' },
    { state: 'completed' }, { state: 42 }, { resultJson: '{"resultUrls":["https://video.example.test/unexpected.mp4"]}' },
  ])('requires manual review for inconsistent task identity or state %#', async fields => {
    respond(record('waiting', fields));
    await failure(getKieVideo(env, taskId), true);
  });

  it.each([
    null, {}, '', '{', 'null', '{}', '{"resultUrls":[]}', '{"resultUrls":[42]}',
    '{"resultUrls":["http://video.example.test/video.mp4"]}',
    '{"resultUrls":["https://user:private-kie-test-key@video.example.test/video.mp4"]}',
  ])('requires manual review for malformed completed result %#', async resultJson => {
    respond(record('success', { resultJson }));
    await failure(getKieVideo(env, taskId), true);
  });

  it('rejects success with contradictory failure metadata', async () => {
    respond(record('success', { resultJson: JSON.stringify({ resultUrls: [resultUrl] }), failCode: 'FAILED' }));
    await failure(getKieVideo(env, taskId), true);
  });
});
