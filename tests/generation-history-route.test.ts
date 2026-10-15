import { describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import { reserveGeneration } from '../lib/server/billing';
import { GET } from '../app/api/generations/route';

const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));

describe('generation history template metadata', () => {
  it('exposes only the recognized video template while keeping payloads private', async () => {
    const d = database(), token = 'h'.repeat(43);
    routeEnv.value = jobEnv(d.db);
    d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
    const ozil = await reserveGeneration(d.db, 'u', 'ozil', 'video', { template: 'ozil-goal', photo: 'private-photo', prompt: 'private-prompt' }, 5);
    const lobby = await reserveGeneration(d.db, 'u', 'lobby', 'video', { leftImage: 'private-left' }, 5);
    const unknown = await reserveGeneration(d.db, 'u', 'unknown', 'video', { template: 'private-template' }, 5);
    const music = await reserveGeneration(d.db, 'u', 'music', 'music', { template: 'ozil-goal' }, 5);
    const malformed = await reserveGeneration(d.db, 'u', 'malformed', 'video', {}, 5);
    d.sqlite.prepare('UPDATE generations SET payload=? WHERE id=?').run('invalid json', malformed.id);
    d.sqlite.prepare("INSERT INTO users(id,email,name,credits) VALUES('other','other@example.test','Other',100)").run();
    await reserveGeneration(d.db, 'other', 'other', 'video', { template: 'ozil-goal' }, 5);

    const response = await GET(new Request('https://example.test/api/generations', { headers: { cookie: `migos_session=${token}` } }), undefined);
    expect(response.status).toBe(200);
    const body = await response.json() as { generations: Array<Record<string, unknown>> };
    expect(body.generations).toHaveLength(5);
    expect(body.generations.find(item => item.id === ozil.id)).toMatchObject({ template: 'ozil-goal', kind: 'video', cost: 5 });
    for (const job of [lobby, unknown, music, malformed]) expect(body.generations.find(item => item.id === job.id)).not.toHaveProperty('template');
    for (const item of body.generations) expect(item).not.toHaveProperty('payload');
    expect(JSON.stringify(body)).not.toMatch(/private-photo|private-prompt|private-template|private-left/);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
