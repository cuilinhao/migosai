import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKieImage as create, getKieImage as query } from '../lib/server/kie';
import { ProviderError } from '../lib/server/provider';
import type { CreateImageRequest } from '../lib/contracts';

afterEach(() => vi.restoreAllMocks());
const env = { KIE_API_KEY: 'test-image-key' };
const payload: CreateImageRequest = { prompt: 'An orange cat', images: [], aspect: 'auto', resolution: '1K', outputFormat: 'png' };
const resultUrl = 'https://tempfile.aiquickdraw.com/cat.png';
const record = (state: string, patch: Record<string, unknown> = {}) => ({ code: 200, data: { taskId: 'image-task', model: 'nano-banana-2', state, resultJson: null, failCode: null, failMsg: null, ...patch } });

describe('Kie Nano Banana 2 image adapter', () => {
  it.each([{ references: [] }, { references: ['https://example.test/private-photo?signature=test'] }])('submits exactly one image task with references $references', async ({ references }) => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'image-task' } }));
    expect(await create(env, payload, references)).toBe('image-task');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.kie.ai/api/v1/jobs/createTask');
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ model: 'nano-banana-2', input: { prompt: 'An orange cat', image_input: references, aspect_ratio: 'auto', resolution: '1K', output_format: 'png' } });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', redirect: 'manual' });
  });
  it.each([400, 402, 422, 429])('classifies HTTP %s submissions as definite rejection', async status => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ secret: 'private-provider-detail' }, { status }));
    await expect(create(env, payload, [])).rejects.toMatchObject({ uncertain: false, transientQuery: false });
  });
  it.each([302, 408, 500])('keeps HTTP %s submission uncertain without retry', async status => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}, { status }));
    await expect(create(env, payload, [])).rejects.toMatchObject({ uncertain: true }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('keeps a missing task receipt uncertain', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: {} }));
    await expect(create(env, payload, [])).rejects.toMatchObject({ uncertain: true });
  });
  it.each([['waiting', 'pending'], ['queuing', 'pending'], ['generating', 'processing']])('normalizes %s status', async (state, status) => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(record(state)));
    expect(await query(env, 'image-task')).toEqual({ status });
    expect(fetcher.mock.calls[0][0]).toBe('https://api.kie.ai/api/v1/jobs/recordInfo?taskId=image-task');
  });
  it('decodes one completed image', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(record('success', { resultJson: JSON.stringify({ resultUrls: [resultUrl] }) })));
    expect(await query(env, 'image-task')).toEqual({ status: 'completed', result: { images: [resultUrl] } });
  });
  it('sanitizes a failed task', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(record('fail', { failCode: 'UPSTREAM_FAILURE', failMsg: 'private-provider-detail' })));
    const result = await query(env, 'image-task'); expect(result.status).toBe('failed'); expect(JSON.stringify(result)).not.toContain('private-provider-detail');
  });
  it.each([{ taskId: 'other' }, { model: 'other' }, { failCode: 'failed' }, { resultJson: '{' }, { resultJson: '{"resultUrls":[]}' }, { resultJson: '{"resultUrls":["http://evil.test/a.png"]}' }, { resultJson: JSON.stringify({ resultUrls: [resultUrl, resultUrl] }) }])('holds inconsistent completed result %# for support', async patch => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(record('success', { resultJson: JSON.stringify({ resultUrls: [resultUrl] }), ...patch })));
    await expect(query(env, 'image-task')).rejects.toMatchObject({ uncertain: true });
  });
  it.each([429, 500, 503])('keeps a saved query retryable after HTTP %s', async status => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}, { status }));
    await expect(query(env, 'image-task')).rejects.toMatchObject({ uncertain: false, transientQuery: true });
  });
  it('never includes credentials or signed references in network errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('test-image-key private-signature'));
    const error = await create(env, payload, []).catch(error => error);
    expect(error).toBeInstanceOf(ProviderError); expect(String(error)).not.toMatch(/test-image-key|private-signature/);
  });
});
