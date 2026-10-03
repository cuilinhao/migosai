import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { database, jobEnv } from './helpers';
import { sha256 } from '../lib/server/security';
import { inspectReferenceUpload, saveReferenceUpload, validateVideoUploads } from '../lib/server/reference-uploads';

const audio = new Uint8Array(readFileSync(new URL('./fixtures/reference-media/tone.wav', import.meta.url)));
const video = new Uint8Array(readFileSync(new URL('./fixtures/reference-media/silent.mp4', import.meta.url)));
describe('reference upload validation', () => {
  it('measures actual media rather than trusting client metadata', async () => {
    expect(await inspectReferenceUpload(audio, 'audio', 'audio/wav')).toMatchObject({ kind: 'audio', duration: 4, hasAudio: true });
    expect(await inspectReferenceUpload(video, 'video', 'video/mp4')).toMatchObject({ kind: 'video', width: 640, height: 480, hasAudio: false });
  });
  it('rejects spoofed kinds, malformed containers and oversized audio', async () => {
    await expect(inspectReferenceUpload(audio, 'video', 'video/mp4')).rejects.toThrow();
    await expect(inspectReferenceUpload(video, 'audio', 'audio/wav')).rejects.toThrow();
    await expect(inspectReferenceUpload(video.subarray(0, 80), 'video', 'video/mp4')).rejects.toThrow();
    await expect(inspectReferenceUpload(new Uint8Array(15 * 1024 * 1024 + 1), 'audio', 'audio/wav')).rejects.toThrow();
  });
  it('stores verified duration under a private owner key and ignores claimed metadata', async () => {
    const d = database(), token = 'z'.repeat(43), stored = new Map<string, Uint8Array>();
    d.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token), 'u');
    const env = { ...jobEnv(d.db), MEDIA: { put: async (key: string, bytes: Uint8Array) => { stored.set(key, bytes); }, delete: async (key: string) => { stored.delete(key); } } as unknown as R2Bucket };
    const form = new FormData(); form.set('kind', 'audio'); form.set('duration', '1'); form.set('file', new File([audio], 'track.wav', { type: 'audio/wav' }));
    const response = await saveReferenceUpload(new Request('https://example.test/api/reference-uploads', { method: 'POST', headers: { origin: 'https://example.test', cookie: `migos_session=${token}` }, body: form }), env);
    const body = await response.json() as { key: string; duration: number };
    expect(response.status).toBe(201); expect(body.key).toMatch(/^users\/u\/uploads\//); expect(body.duration).toBe(4);
    expect(d.sqlite.prepare('SELECT media_kind,duration FROM uploads WHERE key=?').get(body.key)).toMatchObject({ media_kind: 'audio', duration: 4 });
    expect(stored.get(body.key)?.byteLength).toBe(audio.length);
  });
});

describe('references are checked before reserving credits', () => {
  function setup() {
    const d = database();
    for (const key of ['left', 'right']) d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').run(key, 'u', 'image/jpeg');
    d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type,media_kind,duration,has_audio) VALUES(?,?,?,?,?,?)').run('motion', 'u', 'video/mp4', 'video', 4, 0);
    d.sqlite.prepare('INSERT INTO uploads(key,user_id,content_type,media_kind,duration,has_audio) VALUES(?,?,?,?,?,?)').run('song', 'u', 'audio/wav', 'audio', 4, 1);
    return d;
  }
  const request = { leftImage: 'left', rightImage: 'right', aspect: '9:16' as const, duration: 4, resolution: '480p' as const, model: 'wan-3.0' as const, motion: 'video' as const, soundtrack: 'song' as const, referenceVideo: 'motion', referenceAudio: 'song' };
  it('returns measured reference duration for billing', async () => {
    const d = setup(); expect(await validateVideoUploads(d.db, 'u', request)).toBe(4);
  });
  it('rejects another owner, wrong media type, missing or short audio', async () => {
    const d = setup();
    await expect(validateVideoUploads(d.db, 'other-user', request)).rejects.toThrow();
    await expect(validateVideoUploads(d.db, 'u', { ...request, leftImage: 'song' })).rejects.toThrow();
    await expect(validateVideoUploads(d.db, 'u', { ...request, referenceVideo: 'song' })).rejects.toThrow();
    await expect(validateVideoUploads(d.db, 'u', { ...request, referenceAudio: 'absent' })).rejects.toThrow();
    await expect(validateVideoUploads(d.db, 'u', { ...request, duration: 10 })).rejects.toThrow();
  });
});
