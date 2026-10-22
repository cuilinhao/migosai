import { describe, expect, it, vi } from 'vitest';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import { GET, POST } from '../app/api/asset-library/route';
import type { AssetLibraryResponse } from '../lib/asset-library';

const routeEnv = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));

async function setup() {
  const d = database(), token = 'a'.repeat(43);
  routeEnv.value = jobEnv(d.db);
  d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
  d.sqlite.exec("INSERT INTO users(id,email,name,credits) VALUES('other','other@example.test','Other',100)");
  for (const owner of ['u', 'other']) {
    d.sqlite.prepare('INSERT INTO generations(id,user_id,idempotency_key,kind,payload,cost) VALUES(?,?,?,?,?,?)').run(owner + '-job', owner, 'test', 'video', '{"prompt":"private"}', 1);
    d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type,created_at) VALUES(?,?,?,?)').run(`users/${owner}/uploads/image`, owner, 'image/png', 1792600000);
  }
  const request = (body?: unknown, headers: Record<string, string> = {}) => new Request('https://example.test/api/asset-library', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { cookie: `migos_session=${token}`, origin: 'https://example.test', 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const post = (body: unknown, headers?: Record<string, string>) => POST(request(body, headers), undefined);
  const get = () => GET(request(), undefined);
  const library = async () => await (await get()).json() as AssetLibraryResponse;
  const folder = async (source: 'creation' | 'uploaded' = 'creation', name = 'My collection') => {
    const response = await post({ action: 'create-collection', source, name });
    expect(response.status).toBe(201);
    return (await response.json() as { collection: { id: string } }).collection.id;
  };
  return { ...d, request, post, get, library, folder };
}

describe('asset library private uploads and collections', () => {
  it('returns only current-owner uploads with private media links and no payloads', async () => {
    const d = await setup();
    d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type,media_kind) VALUES(?,?,?,?)').run('users/u/uploads/video', 'u', 'video/mp4', 'video');
    d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type,media_kind) VALUES(?,?,?,?)').run('users/u/uploads/audio', 'u', 'audio/wav', 'audio');
    const response = await d.get(), body = await response.json() as AssetLibraryResponse;
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toMatchObject({ collections: [], assignments: {}, hidden: [], storage: { fileCount: 3 } });
    expect(body.uploads).toHaveLength(3);
    expect(body.uploads.find(upload => upload.kind === 'image')).toMatchObject({ id: 'users/u/uploads/image', status: 'completed', progress: 100, imageUrls: ['/api/media/users/u/uploads/image'], cost: 0 });
    expect(body.uploads.find(upload => upload.kind === 'video')?.videoUrl).toBe('/api/media/users/u/uploads/video');
    expect(body.uploads.find(upload => upload.kind === 'music')?.audioUrls).toEqual(['/api/media/users/u/uploads/audio']);
    expect(JSON.stringify(body)).not.toMatch(/other|payload|private|prompt|signature/);
  });

  it('persists collection creation, rename, assignment and deletion without deleting media or generations', async () => {
    const d = await setup(), id = await d.folder();
    expect((await d.post({ action: 'rename-collection', id, name: '  Final work  ' })).status).toBe(200);
    expect((await d.post({ action: 'move', assetIds: ['generation:u-job'], collectionId: id })).status).toBe(200);
    expect(await d.library()).toMatchObject({ collections: [{ id, name: 'Final work', source: 'creation' }], assignments: { 'generation:u-job': id } });
    expect((await d.post({ action: 'delete-collection', id })).status).toBe(200);
    expect(await d.library()).toMatchObject({ collections: [], assignments: {} });
    expect(d.sqlite.prepare("SELECT id FROM generations WHERE id='u-job'").get()).toBeTruthy();
    expect(d.sqlite.prepare("SELECT key FROM uploads WHERE key='users/u/uploads/image'").get()).toBeTruthy();
  });

  it('moves uploaded items to collections and back to Unsorted', async () => {
    const d = await setup(), id = await d.folder('uploaded');
    expect((await d.post({ action: 'move', assetIds: ['upload:users/u/uploads/image'], collectionId: id })).status).toBe(200);
    expect((await d.library()).assignments).toEqual({ 'upload:users/u/uploads/image': id });
    expect((await d.post({ action: 'move', assetIds: ['upload:users/u/uploads/image'], collectionId: null })).status).toBe(200);
    expect((await d.library()).assignments).toEqual({});
  });

  it('soft hides and restores assets without dropping collection assignments or files', async () => {
    const d = await setup(), id = await d.folder();
    await d.post({ action: 'move', assetIds: ['generation:u-job'], collectionId: id });
    expect((await d.post({ action: 'hide', assetIds: ['generation:u-job', 'upload:users/u/uploads/image'] })).status).toBe(200);
    expect((await d.library()).hidden.sort()).toEqual(['generation:u-job', 'upload:users/u/uploads/image']);
    expect(d.sqlite.prepare('SELECT count(*) n FROM uploads').get()?.n).toBe(2);
    expect((await d.post({ action: 'restore', assetIds: ['generation:u-job'] })).status).toBe(200);
    expect(await d.library()).toMatchObject({ hidden: ['upload:users/u/uploads/image'], assignments: { 'generation:u-job': id }, storage: { fileCount: 1 } });
  });

  it('validates an entire mixed-owner batch before any writes', async () => {
    const d = await setup(), id = await d.folder();
    for (const action of ['hide', 'restore', 'move']) {
      expect((await d.post({ action, assetIds: ['generation:u-job', 'generation:other-job'], collectionId: id })).status).toBe(404);
      expect((await d.post({ action, assetIds: ['upload:users/u/uploads/image', 'upload:users/other/uploads/image'], collectionId: null })).status).toBe(404);
    }
    expect(d.sqlite.prepare('SELECT count(*) n FROM asset_library_items').get()?.n).toBe(0);
  });

  it('does not let another owner inspect or mutate a collection', async () => {
    const d = await setup(), id = await d.folder();
    d.sqlite.prepare('UPDATE asset_collections SET user_id=? WHERE id=?').run('other', id);
    for (const body of [{ action: 'rename-collection', id, name: 'Stolen' }, { action: 'delete-collection', id }, { action: 'move', assetIds: ['generation:u-job'], collectionId: id }]) {
      expect((await d.post(body)).status).toBe(404);
    }
    expect((await d.library()).collections).toEqual([]);
    expect(d.sqlite.prepare('SELECT name FROM asset_collections WHERE id=?').get(id)?.name).toBe('My collection');
  });

  it('rejects source mismatches atomically', async () => {
    const d = await setup(), creation = await d.folder(), uploaded = await d.folder('uploaded');
    expect((await d.post({ action: 'move', assetIds: ['upload:users/u/uploads/image'], collectionId: creation })).status).toBe(400);
    expect((await d.post({ action: 'move', assetIds: ['generation:u-job'], collectionId: uploaded })).status).toBe(400);
    expect(d.sqlite.prepare('SELECT count(*) n FROM asset_library_items').get()?.n).toBe(0);
  });

  it('requires authentication and same origin for writes', async () => {
    const d = await setup();
    expect((await GET(d.request(undefined, { cookie: '' }), undefined)).status).toBe(401);
    expect((await d.post({ action: 'create-collection', source: 'creation', name: 'A' }, { cookie: '' })).status).toBe(401);
    expect((await d.post({ action: 'hide', assetIds: ['generation:u-job'] }, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await d.post({ action: 'hide', assetIds: ['generation:u-job'] }, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  });

  it.each([null, [], {}, { action: 'unknown' }, { action: 'create-collection', name: '', source: 'creation' }, { action: 'create-collection', name: 'a'.repeat(65), source: 'creation' }, { action: 'create-collection', name: 'A', source: 'invalid' }, { action: 'hide', assetIds: [] }, { action: 'hide', assetIds: Array(101).fill('generation:u-job') }, { action: 'hide', assetIds: [null] }, { action: 'hide', assetIds: ['https://example.test/file'] }, { action: 'move', assetIds: ['generation:u-job'] }])('rejects malformed input %#', async body => {
    const d = await setup();
    expect((await d.post(body)).status).toBe(400);
  });

  it('caps upload results at 100 while reporting the complete storage count', async () => {
    const d = await setup();
    for (let i = 0; i < 105; i++) d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type,created_at) VALUES(?,?,?,?)').run(`users/u/uploads/photo-${i}`, 'u', 'image/png', 1800000000 + i);
    const body = await d.library();
    expect(body.uploads).toHaveLength(100);
    expect(body.uploads[0].id).toBe('users/u/uploads/photo-104');
    expect(body.storage.fileCount).toBe(106);
  });

  it('accepts 100 owned assets and deduplicates repeated selections', async () => {
    const d = await setup(), ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      const key = `users/u/uploads/owned-${i}`;
      ids.push(`upload:${key}`);
      d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(key, 'u', 'image/png');
    }
    expect((await d.post({ action: 'hide', assetIds: ids })).status).toBe(200);
    expect((await d.library()).hidden).toHaveLength(100);
    expect((await d.post({ action: 'restore', assetIds: [ids[0], ids[0]] })).status).toBe(200);
    expect((await d.library()).hidden).toHaveLength(99);
  });

  it('rolls back earlier writes when the atomic batch fails', async () => {
    const d = await setup();
    d.sqlite.exec("CREATE TRIGGER reject_test_asset BEFORE INSERT ON asset_library_items WHEN NEW.asset_id='upload:users/u/uploads/image' BEGIN SELECT RAISE(ABORT,'test write failure'); END");
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await d.post({ action: 'hide', assetIds: ['generation:u-job', 'upload:users/u/uploads/image'] });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'The service is temporarily unavailable. Please try again later.' });
      expect(d.sqlite.prepare('SELECT count(*) n FROM asset_library_items').get()?.n).toBe(0);
    } finally { logger.mockRestore(); }
  });

  it('bounds request bodies and handles invalid JSON without exposing internals', async () => {
    const d = await setup();
    const request = d.request({});
    expect((await POST(new Request(request.url, { method: 'POST', headers: request.headers, body: '{' }), undefined)).status).toBe(400);
    expect((await d.post({ action: 'hide', assetIds: ['generation:u-job'], extra: 'a'.repeat(33 * 1024) })).status).toBe(413);
    expect(d.sqlite.prepare('SELECT count(*) n FROM asset_library_items').get()?.n).toBe(0);
  });
});
