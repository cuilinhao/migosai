import type { AssetCollection, AssetLibraryResponse, AssetLibraryUpload } from '../asset-library';
import { requireUser } from './auth';
import { appOrigin, database, type Env } from './env';
import { ApiError } from './errors';
import { jsonBody, sameOrigin } from './security';

type LibraryItem = { asset_id: string; collection_id: string | null; hidden: number };
type UploadRow = { key: string; content_type: string; media_kind: string | null; created_at: number };
const headers = { 'Cache-Control': 'no-store' };
const invalid = () => new ApiError(400, 'Invalid asset library request.');
const missing = () => new ApiError(404, 'The requested asset or collection was not found.');

function uploadAsset(row: UploadRow): AssetLibraryUpload | null {
  // Preserve the private authenticated media route; do not create shareable signed URLs.
  if (!/^users\/[\w-]+\/uploads\/[\w-]+$/.test(row.key)) return null;
  const url = `/api/media/${row.key}`;
  const base = { id: row.key, status: 'completed' as const, progress: 100, cost: 0, createdAt: new Date(row.created_at * 1000).toISOString() };
  if (['image/png', 'image/jpeg', 'image/webp'].includes(row.content_type)) return { ...base, kind: 'image', imageUrls: [url] };
  if (row.media_kind === 'video' && row.content_type === 'video/mp4') return { ...base, kind: 'video', videoUrl: url };
  if (row.media_kind === 'audio' && ['audio/wav', 'audio/x-wav'].includes(row.content_type)) return { ...base, kind: 'music', audioUrls: [url] };
  return null;
}

export async function readAssetLibrary(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env), db = database(env);
  const [collections, metadata, uploads, count] = await Promise.all([
    db.prepare('SELECT id,name,source FROM asset_collections WHERE user_id=? ORDER BY created_at,id').bind(user.id).all<AssetCollection>(),
    // Joining ownership again prevents stale or invalid metadata from exposing foreign keys.
    db.prepare(`SELECT m.asset_id,m.collection_id,m.hidden FROM asset_library_items m WHERE m.user_id=? AND (
      EXISTS(SELECT 1 FROM generations g WHERE g.user_id=m.user_id AND 'generation:'||g.id=m.asset_id)
      OR EXISTS(SELECT 1 FROM uploads u WHERE u.user_id=m.user_id AND 'upload:'||u.key=m.asset_id)
    )`).bind(user.id).all<LibraryItem>(),
    db.prepare('SELECT key,content_type,media_kind,created_at FROM uploads WHERE user_id=? ORDER BY created_at DESC,key DESC LIMIT 100').bind(user.id).all<UploadRow>(),
    db.prepare('SELECT count(*) AS total FROM uploads WHERE user_id=?').bind(user.id).first<{ total: number }>(),
  ]);
  const assignments: Record<string, string> = {}, hidden: string[] = [];
  for (const item of metadata.results) {
    if (item.collection_id) assignments[item.asset_id] = item.collection_id;
    if (item.hidden) hidden.push(item.asset_id);
  }
  const result: AssetLibraryResponse = {
    collections: collections.results, assignments, hidden,
    uploads: uploads.results.map(uploadAsset).filter((asset): asset is AssetLibraryUpload => asset !== null),
    storage: { fileCount: count?.total ?? 0 },
  };
  return Response.json(result, { headers });
}

function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > 64 || /[\u0000-\u001f\u007f]/.test(value)) throw invalid();
  return value.trim();
}

function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[\w-]{1,128}$/.test(value)) throw invalid();
  return value;
}

function assetIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 100 || value.some(id => typeof id !== 'string' || !/^(generation:[\w-]{1,128}|upload:users\/[\w-]+\/uploads\/[\w-]+)$/.test(id) || id.length > 512)) throw invalid();
  return [...new Set(value)] as string[];
}

async function ownedCollection(db: D1Database, owner: string, id: unknown): Promise<AssetCollection> {
  const collection = await db.prepare('SELECT id,name,source FROM asset_collections WHERE id=? AND user_id=?').bind(identifier(id), owner).first<AssetCollection>();
  if (!collection) throw missing();
  return collection;
}

async function requireAssets(db: D1Database, owner: string, ids: string[]): Promise<void> {
  const found = new Set<string>();
  for (const [prefix, table, column] of [['generation:', 'generations', 'id'], ['upload:', 'uploads', 'key']] as const) {
    const requested = ids.filter(id => id.startsWith(prefix)).map(id => id.slice(prefix.length));
    // Keep every D1 statement below its bound-parameter limit.
    for (let offset = 0; offset < requested.length; offset += 90) {
      const chunk = requested.slice(offset, offset + 90);
      const rows = await db.prepare(`SELECT ${column} AS asset FROM ${table} WHERE user_id=? AND ${column} IN (${chunk.map(() => '?').join(',')})`).bind(owner, ...chunk).all<{ asset: string }>();
      for (const row of rows.results) found.add(prefix + row.asset);
    }
  }
  if (ids.some(id => !found.has(id))) throw missing();
}

export async function updateAssetLibrary(request: Request, env: Env): Promise<Response> {
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env), db = database(env), body: unknown = await jsonBody(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const input = body as Record<string, unknown>;
  if (input.action === 'create-collection') {
    if (input.source !== 'creation' && input.source !== 'uploaded') throw invalid();
    const collection: AssetCollection = { id: crypto.randomUUID(), name: name(input.name), source: input.source };
    await db.prepare('INSERT INTO asset_collections(id,user_id,name,source) VALUES(?,?,?,?)').bind(collection.id, user.id, collection.name, collection.source).run();
    return Response.json({ collection }, { status: 201, headers });
  }
  if (input.action === 'rename-collection' || input.action === 'delete-collection') {
    const collection = await ownedCollection(db, user.id, input.id);
    if (input.action === 'rename-collection') {
      const nextName = name(input.name);
      await db.prepare('UPDATE asset_collections SET name=? WHERE id=? AND user_id=?').bind(nextName, collection.id, user.id).run();
    } else {
      await db.batch([
        db.prepare('UPDATE asset_library_items SET collection_id=NULL,updated_at=unixepoch() WHERE collection_id=? AND user_id=?').bind(collection.id, user.id),
        db.prepare('DELETE FROM asset_collections WHERE id=? AND user_id=?').bind(collection.id, user.id),
      ]);
    }
    return Response.json({ ok: true }, { headers });
  }
  if (!['move', 'hide', 'restore'].includes(String(input.action))) throw invalid();
  const ids = assetIds(input.assetIds);
  const target = input.action === 'move' && input.collectionId !== null ? await ownedCollection(db, user.id, input.collectionId) : null;
  if (input.action === 'move' && input.collectionId !== null && !target) throw invalid();
  if (target && ids.some(id => (id.startsWith('generation:') ? 'creation' : 'uploaded') !== target.source)) throw new ApiError(400, 'Choose a collection for the same asset type.');
  // Check all source ownership before starting one atomic batch; a bad item changes nothing.
  await requireAssets(db, user.id, ids);
  const statements = ids.map(id => input.action === 'move'
    ? db.prepare(`INSERT INTO asset_library_items(user_id,asset_id,collection_id) VALUES(?,?,?)
        ON CONFLICT(user_id,asset_id) DO UPDATE SET collection_id=excluded.collection_id,updated_at=unixepoch()`).bind(user.id, id, target?.id ?? null)
    : db.prepare(`INSERT INTO asset_library_items(user_id,asset_id,hidden) VALUES(?,?,?)
        ON CONFLICT(user_id,asset_id) DO UPDATE SET hidden=excluded.hidden,updated_at=unixepoch()`).bind(user.id, id, Number(input.action === 'hide')));
  await db.batch(statements);
  return Response.json({ ok: true }, { headers });
}
