import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob } from '../lib/server/jobs';
import { POST } from '../app/api/generations/route';
import * as videoAvailability from '../lib/video-availability';

const unavailableReason = videoAvailability.getVideoModelUnavailableReason;

const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));
afterEach(() => vi.restoreAllMocks());

const input = { leftImage: 'left', rightImage: 'right', aspect: '9:16', duration: 5, resolution: '480p', mode: 'human' };
async function setup() {
  const d = database(), token = 's'.repeat(43);
  const env = { ...jobEnv(d.db), KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com' };
  routeEnv.value = env;
  d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
  for (const key of ['left', 'right']) d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(key, 'u', 'image/png');
  const request = (patch = {}) => new Request('https://example.test/api/generations', {
    method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'seedance-outage-test' },
    body: JSON.stringify({ ...input, ...patch }),
  });
  const tick = async (id: string) => {
    d.sqlite.prepare('UPDATE generations SET next_poll=0 WHERE id=?').run(id);
    await advanceJob(env, id);
  };
  return { ...d, request, tick };
}

describe('Seedance audio outage protection', () => {
  // Simulate an incident while running the real policy, reservation and job code.
  beforeEach(() => vi.spyOn(videoAvailability, 'getVideoModelUnavailableReason').mockImplementation(model => unavailableReason(model, false)));
  it.each([undefined, 'seedance-2', 'seedance-2-fast'])('rejects new %s requests without a job or debit', async model => {
    const d = await setup();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No provider call expected'));
    const response = await POST(d.request(model ? { model } : {}), undefined);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('Wan 3.0') });
    expect(d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n).toBe(0);
    expect(d.sqlite.prepare('SELECT count(*) n FROM credit_ledger').get()?.n).toBe(0);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps Wan template audio generation available with one debit and an audio-enabled provider request', async () => {
    const d = await setup();
    const response = await POST(d.request({ model: 'wan-3.0' }), undefined);
    expect(response.status).toBe(202);
    const { id } = await response.json() as { id: string };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'wan_task' } }));
    await d.tick(id);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ model: 'wan/3-0-video', input: { audio: true } });
    expect(d.sqlite.prepare('SELECT status,stage,provider_id FROM generations').get()).toMatchObject({ status: 'processing', stage: 'polling', provider_id: 'wan_task' });
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(70);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
  });

  for (const stage of ['new', 'ready']) {
    it.each([undefined, 'seedance-2', 'seedance-2-fast'])(`refunds an unsubmitted %s ${stage} job once without contacting Kie`, async model => {
      const d = await setup();
      const job = await reserveGeneration(d.db, 'u', 'queued-before-outage', 'video', { ...input, ...(model ? { model } : {}), provider: 'kie' }, 50);
      d.sqlite.prepare('UPDATE generations SET stage=? WHERE id=?').run(stage, job.id);
      const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No provider call expected'));
      await d.tick(job.id); await d.tick(job.id);
      expect(d.sqlite.prepare('SELECT status,stage,provider_id,error FROM generations').get()).toMatchObject({ status: 'failed', stage: 'terminal', provider_id: null, error: expect.stringContaining('Your credits have been returned.') });
      expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);
      expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);
      expect(fetcher).not.toHaveBeenCalled();
    });
  }

  it('returns an existing reservation on an idempotent retry during the outage', async () => {
    const d = await setup();
    const job = await reserveGeneration(d.db, 'u', 'seedance-outage-test', 'video', { ...input, provider: 'kie' }, 50);
    d.sqlite.prepare("UPDATE generations SET stage='polling',status='processing',provider_id='saved_task' WHERE id=?").run(job.id);
    const response = await POST(d.request(), undefined);
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ id: job.id, status: 'processing' });
    expect(d.sqlite.prepare('SELECT count(*) n FROM generations').get()?.n).toBe(1);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
  });

  it.each(['seedance-2', 'seedance-2-fast'])('continues querying submitted %s tasks without refund or resubmission', async model => {
    const d = await setup();
    const job = await reserveGeneration(d.db, 'u', 'submitted-before-outage', 'video', { ...input, model, provider: 'kie' }, 50);
    d.sqlite.prepare("UPDATE generations SET stage='polling',status='processing',provider_id='saved_task' WHERE id=?").run(job.id);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'saved_task', model: `bytedance/${model}`, state: 'generating' } }));
    await d.tick(job.id);
    expect(d.sqlite.prepare('SELECT status,stage,provider_id FROM generations').get()).toMatchObject({ status: 'processing', stage: 'polling', provider_id: 'saved_task' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(0);
  });

  it('keeps an uncertain submission in manual review instead of refunding or resubmitting it', async () => {
    const d = await setup();
    const job = await reserveGeneration(d.db, 'u', 'uncertain-before-outage', 'video', { ...input, provider: 'kie' }, 50);
    d.sqlite.prepare("UPDATE generations SET stage='submitting_generation' WHERE id=?").run(job.id);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No provider call expected'));
    await d.tick(job.id);
    expect(d.sqlite.prepare('SELECT stage FROM generations').get()?.stage).toBe('manual_review');
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('Seedance audio service recovery', () => {
  it.each(['seedance-2', 'seedance-2-fast'])('accepts %s with audio after recovery and reserves only once', async model => {
    const d = await setup();
    const first = await POST(d.request({ model }), undefined);
    expect(first.status).toBe(202);
    const { id } = await first.json() as { id: string };
    expect(await (await POST(d.request({ model }), undefined)).json()).toMatchObject({ id });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'recovered_task' } }));
    await d.tick(id);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ model: `bytedance/${model}`, input: { generate_audio: true } });
    expect(d.sqlite.prepare('SELECT status,stage,provider_id FROM generations').get()).toMatchObject({ status: 'processing', stage: 'polling', provider_id: 'recovered_task' });
    expect(d.sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='generation'").get()?.n).toBe(1);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(model === 'seedance-2' ? 50 : 60);
  });
});
