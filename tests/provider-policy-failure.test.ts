import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob, generationResponse } from '../lib/server/jobs';

afterEach(() => vi.restoreAllMocks());

async function pollingVideo() {
  const d = database();
  const job = await reserveGeneration(d.db, 'u', 'provider-failure', 'video', { duration: 5, resolution: '480p', aspect: '9:16' }, 50);
  d.sqlite.prepare("UPDATE generations SET status='processing',stage='polling',provider_id='video_task' WHERE id=?").run(job.id);
  const row = () => d.sqlite.prepare('SELECT * FROM generations WHERE id=?').get(job.id) as any;
  const refunds = () => (d.sqlite.prepare("SELECT COUNT(*) AS n FROM credit_ledger WHERE kind='refund' AND reference_id=?").get(job.id) as { n: number }).n;
  return { ...d, env: jobEnv(d.db), id: job.id, row, refunds };
}

describe('provider task failure messaging', () => {
  it('shows a safe content-policy hint for the observed APIMart rejection and refunds once', async () => {
    const d = await pollingVideo();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: {
      id: 'video_task', status: 'failed', progress: 100, cost: 0,
      error: { code: 'task_failed', type: 'task_failed', param: '', message: 'Blocked by a specific content policy (e.g. public figures, minors, audio copyright). https://private.example/token?secret=abc <script>alert(1)</script>' },
    } }));

    await advanceJob(d.env, d.id);
    await advanceJob(d.env, d.id);

    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal' });
    expect(generationResponse(d.row()).error).toBe('The generation service rejected this content. Please use different reference photos. Your credits have been returned.');
    expect(generationResponse(d.row()).error).not.toMatch(/private\.example|<script>|public figures|minors|audio copyright/i);
    expect(d.refunds()).toBe(1);
    expect(d.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()).toMatchObject({ credits: 100 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
  });

  it('retains the generic refunded message for unrelated provider failures', async () => {
    const d = await pollingVideo();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: {
      id: 'video_task', status: 'failed', progress: 100, cost: 0,
      error: { code: 'task_failed', type: 'task_failed', param: '', message: 'Internal render timeout. https://private.example/token' },
    } }));

    await advanceJob(d.env, d.id);

    expect(d.row()).toMatchObject({ status: 'failed', stage: 'terminal' });
    expect(generationResponse(d.row()).error).toBe('The provider could not complete your generation. Your credits have been returned.');
    expect(d.refunds()).toBe(1);
  });
});
