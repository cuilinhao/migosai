import { ApiError } from './errors';
import { readLimited, sha256 } from './security';

export function normalizeEmail(input: unknown): string {
  if (typeof input !== 'string') throw new ApiError(400, 'Enter a valid email address.');
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.split('@')[0].length > 64) {
    throw new ApiError(400, 'Enter a valid email address.');
  }
  return email;
}
export async function authBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'Send a JSON request.');
  try {
    const body = JSON.parse(new TextDecoder().decode(await readLimited(request, 8192)));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid object');
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Invalid JSON.');
  }
}
export async function limitAuth(db: D1Database, request: Request, action: string, email?: string): Promise<void> {
  // Cloudflare overwrites this header at the edge. Do not trust forwarded-for.
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  const buckets: [string, number][] = [[`${action}:ip:${ip}`, action === 'one-tap-start' ? 60 : 30]];
  if (email) buckets.push([`${action}:email:${email}`, 10]);
  await db.prepare('DELETE FROM auth_rate_limits WHERE expires_at<=unixepoch()').run();
  for (const [value, limit] of buckets) {
    const row = await db.prepare(`INSERT INTO auth_rate_limits(key,attempts,expires_at) VALUES(?,1,unixepoch()+900)
      ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts`).bind(await sha256(value)).first<{attempts: number}>();
    if (!row || row.attempts > limit) throw new ApiError(429, 'Too many sign-in attempts. Please try again in 15 minutes.');
  }
}
