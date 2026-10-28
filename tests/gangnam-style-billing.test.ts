import { describe, expect, it } from 'vitest';
import { database } from './helpers';
import { reserveGeneration } from '../lib/server/billing';

const options = { mode: 'friends', photos: ['users/u/uploads/middle', 'users/u/uploads/right', 'users/u/uploads/left'], aspect: '16:9', resolution: '480p', consent: true };
describe('Gangnam Style cross-version reservation matching', () => {
  it('retains the original reservation when only server settings change', async () => {
    const d = database();
    const old = await reserveGeneration(d.db, 'u', 'same-key', 'video', { ...options, template: 'gangnam-style', prompt: 'Old direction', provider: 'kie', model: 'seedance-2-5', duration: 15 }, 50);
    const retry = await reserveGeneration(d.db, 'u', 'same-key', 'video', { ...options, template: 'gangnam-style', workflow: 'reference-edit-v1', prompt: 'New editing direction', provider: 'kie', model: 'seedance-2-5', duration: 15 }, 150);
    expect(retry.id).toBe(old.id); expect(retry.cost).toBe(50); expect(retry.payload).toBe(old.payload);
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
  });
  it.each(['ozil-goal', 'flyingcar', undefined])('does not match another template %s with the same public fields', async template => {
    const d = database();
    await reserveGeneration(d.db, 'u', 'same-key', 'video', { ...options, template }, 50);
    await expect(reserveGeneration(d.db, 'u', 'same-key', 'video', { ...options, template: 'gangnam-style', workflow: 'reference-edit-v1' }, 50)).rejects.toMatchObject({ status: 409 });
    expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);
  });
});
