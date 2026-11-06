import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import { reserveGeneration } from '../lib/server/billing';
import { generationResponse, advanceJob } from '../lib/server/jobs';
import { getResumableVideo, type VideoHistoryItem } from '../components/generator/generation-history';
import type { GenerationResponse } from '../lib/contracts';
import { GET } from '../app/api/generations/route';

const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));
afterEach(() => vi.restoreAllMocks());
const effectId = 'goodbye-2026-welcome-2027';
const photo = 'users/u/uploads/trend';
const imageBytes = new Uint8Array(readFileSync(new URL('./fixtures/flyingcar-images/320x480.png', import.meta.url)));
const savedPayload = { template: 'flyingcar', trendEffect: effectId, trendVariant: 'fur-collar', workflowVersion: 'trend-video-v1', provider: 'kie', model: 'seedance-2-5', aspect: '9:16', resolution: '480p', duration: 10, generateAudio: false, photo, consent: true, prompt: 'Original frozen prompt' };
async function post(request: Request) {
  const { POST } = await import('../app/api/trend-video/generations/route');
  return POST(request, undefined);
}
async function setup() {
  const d = database(), token = 't'.repeat(43);
  d.sqlite.prepare("UPDATE users SET credits=1000 WHERE id='u'").run();
  d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
  d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(photo, 'u', 'image/png');
  const head = vi.fn(async () => ({ size: imageBytes.length, etag: 'trend-etag', httpMetadata: { contentType: 'image/png' } }));
  const get = vi.fn(async () => ({ size: imageBytes.length, etag: 'trend-etag', httpMetadata: { contentType: 'image/png' }, arrayBuffer: async () => imageBytes.slice().buffer }));
  routeEnv.value = { ...jobEnv(d.db), KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com', MEDIA: { head, get } };
  const request = (patch: Record<string, unknown> = {}, headers: Record<string, string> = {}) => new Request('https://example.test/api/trend-video/generations', { method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'trend-generation-once', ...headers }, body: JSON.stringify({ effectId, photo, consent: true, ...patch }) });
  const row = () => d.sqlite.prepare('SELECT * FROM generations').get() as any;
  const credits = () => d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()?.credits;
  return { ...d, request, row, credits, head, get };
}

describe('server-owned trend templates', () => {
  it.each(['fur-collar', 'everyone-up', 'arms-wide', 'snow-climb', 'final-seven'])('reserves %s from one owned photo with fixed quote and settings', async variant => {
    const d = await setup();
    const response = await post(d.request({ variant }));
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ template: 'flyingcar', trendEffect: effectId, trendVariant: variant });
    expect(JSON.parse(d.row().payload)).toMatchObject({ ...savedPayload, trendVariant: variant, prompt: expect.any(String) });
    expect(d.row().cost).toBe(75); expect(d.credits()).toBe(925);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('uses a ground-level stone pile without adding a person to the castle scene', async () => {
    const d = await setup();
    expect((await post(d.request({ effectId: 'stones-to-castle-ai' }))).status).toBe(202);
    const payload = JSON.parse(d.row().payload);
    expect(payload).toMatchObject({ trendEffect: 'stones-to-castle-ai', trendVariant: 'default', photo });
    expect(payload.prompt).toMatch(/ground/i); expect(payload.prompt).toMatch(/No people/i); expect(payload.prompt).toMatch(/castle/i);
  });
  it.each([{ effectId: 'unknown' }, { variant: 'unknown' }, { effectId: 'stones-to-castle-ai', variant: 'fur-collar' }, { variant: 'default' }, { consent: false }, { photo: undefined }, { photo: 'users/other/uploads/trend' }, { photo: 'https://attacker.test/x.png' }])('rejects invalid public input %# without debit', async patch => {
    const d = await setup(); expect((await post(d.request(patch))).status).toBe(400); expect(d.row()).toBeUndefined(); expect(d.credits()).toBe(1000);
  });
  it.each(['prompt', 'model', 'provider', 'cost', 'duration', 'resolution', 'aspect', 'generateAudio', 'workflowVersion', 'referenceVideo'])('rejects client-owned %s overrides', async field => {
    const d = await setup(); expect((await post(d.request({ [field]: 'injected' }))).status).toBe(400); expect(d.row()).toBeUndefined();
  });
  it('recovers a paid reservation across prompt and workflow changes before reading unavailable media or services', async () => {
    const d = await setup();
    const original = await reserveGeneration(d.db, 'u', 'trend-generation-once', 'video', { ...savedPayload, workflowVersion: 'older-version' }, 60);
    delete routeEnv.value.KIE_API_KEY; delete routeEnv.value.SEEAPI_API_KEY; delete routeEnv.value.MEDIA;
    const response = await post(d.request());
    expect(response.status).toBe(202); expect((await response.json() as GenerationResponse).id).toBe(original.id);
    expect(d.row().payload).toBe(original.payload); expect(d.credits()).toBe(940); expect(d.head).not.toHaveBeenCalled();
  });
  it('matches an existing reservation after server prompt, version, and price changes', async () => {
    const d = await setup(); const original = await reserveGeneration(d.db, 'u', 'direct-key', 'video', savedPayload, 60);
    const retry = await reserveGeneration(d.db, 'u', 'direct-key', 'video', { ...savedPayload, prompt: 'Updated prompt', workflowVersion: 'trend-video-v2' }, 75);
    expect(retry.id).toBe(original.id); expect(retry.cost).toBe(60); expect(retry.payload).toBe(original.payload); expect(d.credits()).toBe(940);
  });
  it.each([{ variant: 'arms-wide' }, { effectId: 'stones-to-castle-ai' }, { photo: 'users/u/uploads/other' }])('rejects changed public options for an existing key %#', async patch => {
    const d = await setup(); await reserveGeneration(d.db, 'u', 'trend-generation-once', 'video', savedPayload, 75);
    expect((await post(d.request(patch))).status).toBe(409); expect(d.credits()).toBe(925);
  });
  it('does not confuse an ordinary FlyingCar reservation with a trend template', async () => {
    const d = await setup(); const { trendEffect, trendVariant, workflowVersion, ...flyingcar } = savedPayload;
    await reserveGeneration(d.db, 'u', 'trend-generation-once', 'video', flyingcar, 75);
    expect((await post(d.request())).status).toBe(409); expect(d.credits()).toBe(925);
  });
  it.each([false, true])('checks the winning concurrent reservation after the initial reads, changed=%s', async changed => {
    const d = await setup();
    const original = await reserveGeneration(d.db, 'u', 'trend-generation-once', 'video', { ...savedPayload, workflowVersion: 'older-version' }, 60);
    const prepare = d.db.prepare.bind(d.db); let hiddenReads = 2;
    vi.spyOn(d.db, 'prepare').mockImplementation(sql => {
      const statement = prepare(sql);
      if (sql === 'SELECT * FROM generations WHERE user_id=? AND idempotency_key=?' && hiddenReads-- > 0) {
        return { ...statement, bind: (...args: unknown[]) => ({ ...statement.bind(...args), first: async () => null }) } as D1PreparedStatement;
      }
      return statement;
    });
    const response = await post(d.request(changed ? { variant: 'arms-wide' } : {}));
    expect(response.status).toBe(changed ? 409 : 202);
    if (!changed) expect((await response.json() as GenerationResponse).id).toBe(original.id);
    expect(d.row().payload).toBe(original.payload); expect(d.credits()).toBe(940);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
  });
  it('does not recover another account reservation with the same request key', async () => {
    const d = await setup();
    d.sqlite.prepare("INSERT INTO users(id,email,name,credits) VALUES('other','other@example.test','Other',1000)").run();
    const old = await reserveGeneration(d.db, 'other', 'trend-generation-once', 'video', savedPayload, 75);
    const response = await post(d.request()); expect(response.status).toBe(202);
    expect((await response.json() as GenerationResponse).id).not.toBe(old.id); expect(d.credits()).toBe(925);
  });
  it('uses the existing guest wallet session and balance', async () => {
    const d = await setup(); d.sqlite.prepare("UPDATE users SET is_guest=1 WHERE id='u'").run();
    const response = await post(d.request({}, { cookie: `migos_guest_session=${'t'.repeat(43)}` }));
    expect(response.status).toBe(202); expect(d.row().user_id).toBe('u'); expect(d.credits()).toBe(925);
  });
  it('rejects malformed JSON, arrays, empty and invalid request keys', async () => {
    const d = await setup();
    for (const body of ['{', 'null', '[]']) {
      const request = d.request();
      expect((await post(new Request(request.url, { method: 'POST', headers: request.headers, body }))).status).toBe(400);
    }
    for (const key of ['', 'bad', 'x'.repeat(129)]) expect((await post(d.request({}, { 'Idempotency-Key': key }))).status).toBe(400);
    expect(d.row()).toBeUndefined(); expect(d.credits()).toBe(1000);
  });
  it('deduplicates implicit request keys for unchanged public choices', async () => {
    const d = await setup();
    const request = () => { const value = d.request(); value.headers.delete('Idempotency-Key'); return value; };
    const first = await post(request()), second = await post(request());
    expect(first.status).toBe(202); expect(await second.json()).toEqual(await first.json()); expect(d.credits()).toBe(925);
  });
  it('deduplicates simultaneous submissions and enforces the real balance', async () => {
    const d = await setup();
    d.sqlite.prepare("UPDATE users SET credits=74 WHERE id='u'").run();
    expect((await post(d.request())).status).toBe(402); expect(d.row()).toBeUndefined();
    d.sqlite.prepare("UPDATE users SET credits=75 WHERE id='u'").run();
    const responses = await Promise.all([post(d.request()), post(d.request())]);
    expect(responses.map(r => r.status)).toEqual([202, 202]);
    expect((await responses[0].json() as GenerationResponse).id).toBe((await responses[1].json() as GenerationResponse).id);
    expect(d.credits()).toBe(0); expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
  });
  it.each(['KIE_API_KEY', 'SEEAPI_API_KEY', 'MEDIA_SIGNING_SECRET'])('rejects a new reservation without %s before debit', async key => {
    const d = await setup(); delete routeEnv.value[key]; expect((await post(d.request())).status).toBe(503); expect(d.row()).toBeUndefined();
  });
  it('authenticates and checks origin before any media lookup', async () => {
    const d = await setup();
    expect((await post(d.request({}, { cookie: '' }))).status).toBe(401);
    expect((await post(d.request({}, { origin: 'https://attacker.test' }))).status).toBe(403);
    expect(d.head).not.toHaveBeenCalled(); expect(d.row()).toBeUndefined();
  });
  it('exposes only recognized public trend metadata and isolates generator history', async () => {
    const d = await setup(); const trend = await reserveGeneration(d.db, 'u', 'trend-history', 'video', savedPayload, 75);
    const normal = await reserveGeneration(d.db, 'u', 'normal-history', 'video', { template: 'flyingcar', prompt: 'private generic prompt' }, 75);
    expect(generationResponse(trend)).toMatchObject({ trendEffect: effectId, trendVariant: 'fur-collar' });
    const response = await GET(new Request('https://example.test/api/generations', { headers: d.request().headers }), undefined);
    const { generations } = await response.json() as { generations: VideoHistoryItem[] };
    expect(getResumableVideo(generations, 'flyingcar')).toMatchObject({ id: normal.id });
    expect(getResumableVideo(generations, 'flyingcar', effectId)).toMatchObject({ id: trend.id });
    expect(getResumableVideo(generations, 'flyingcar', 'stones-to-castle-ai')).toBeNull();
    expect(JSON.stringify(generations)).not.toMatch(/Original frozen prompt|users\/u\/uploads|private generic prompt/);
  });
  it('sends the frozen template through the existing single-image adapter once', async () => {
    const d = await setup(); await post(d.request({ variant: 'final-seven' }));
    const job = d.row();
    // The dedicated endpoint must preserve a full template beyond the generic editor's 600-character limit.
    expect(JSON.parse(job.payload).prompt.length).toBeGreaterThan(600);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'trend_task' } }));
    await Promise.all([advanceJob(routeEnv.value, job.id), advanceJob(routeEnv.value, job.id)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ model: 'bytedance/seedance-2-5', input: { prompt: JSON.parse(job.payload).prompt, duration: 10, resolution: '480p', aspect_ratio: '9:16', generate_audio: false, nsfw_checker: true } });
    expect(body.input.reference_image_urls).toHaveLength(1); expect(body.input.reference_video_urls).toBeUndefined();
    expect(d.row()).toMatchObject({ stage: 'polling', provider_id: 'trend_task' });
  });
});
