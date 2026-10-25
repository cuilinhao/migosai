import type { User } from '../contracts';
import { cookie, currentUser, GUEST_SESSION, setCookie } from './auth';
import { authBody, limitAuth } from './auth-security';
import { appOrigin, database, type Env } from './env';
import { ApiError } from './errors';
import { randomToken, sameOrigin, sha256 } from './security';
import { creditBalanceColumns, type CreditBalance } from './subscription-credits';

const lifetime = 31_536_000;
const invalidRecovery = () => new ApiError(401, 'This recovery code is invalid or has been replaced.');

function publicUser(user: User): User {
  return { id: user.id, name: user.name, email: user.email, ...(typeof user.picture === 'string' ? { picture: user.picture } : {}), isGuest: !!user.isGuest };
}

async function limitWallet(request: Request, env: Env, action: string) {
  sameOrigin(request, appOrigin(env));
  try { await limitAuth(database(env), request, `guest-wallet-${action}`); }
  catch (error) {
    if (error instanceof ApiError && error.status === 429) throw new ApiError(429, 'Too many guest wallet requests. Please try again in 15 minutes.');
    throw error;
  }
}

export async function createGuestWallet(request: Request, env: Env): Promise<Response> {
  await limitWallet(request, env, 'create');
  const existing = await currentUser(request, env);
  if (existing) return Response.json({ user: publicUser(existing), credits: existing.credits }, { headers: { 'Cache-Control': 'no-store' } });
  const db = database(env), id = crypto.randomUUID(), token = randomToken(), recoveryCode = randomToken();
  const [tokenHash, recoveryHash] = await Promise.all([sha256(token), sha256(recoveryCode)]);
  await db.batch([
    db.prepare("INSERT INTO users(id,email,name,is_guest) VALUES(?,?,'Guest',1)").bind(id, `${id}@guest.invalid`),
    db.prepare('INSERT INTO guest_wallets(user_id,recovery_hash) VALUES(?,?)').bind(id, recoveryHash),
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+?)').bind(tokenHash, id, lifetime),
  ]);
  return Response.json({ user: { id, name: 'Guest', email: '', isGuest: true }, credits: 0, recoveryCode }, {
    headers: { 'Cache-Control': 'no-store', 'Set-Cookie': setCookie(GUEST_SESSION, token, env, lifetime) },
  });
}

export async function rotateGuestRecovery(request: Request, env: Env): Promise<Response> {
  await limitWallet(request, env, 'recovery');
  const user = await currentUser(request, env);
  if (!user) throw new ApiError(401, 'A guest wallet session is required.');
  if (!user.isGuest) throw new ApiError(403, 'Recovery codes are only available for guest wallets.');
  const body = await authBody(request);
  if (body.expectedUserId !== user.id) throw new ApiError(409, 'The guest wallet changed. Refresh and try again.');
  const db = database(env);
  const previous = await db.prepare('SELECT recovery_hash FROM guest_wallets WHERE user_id=?').bind(user.id).first<{ recovery_hash: string }>();
  if (!previous) throw new ApiError(409, 'The guest wallet changed. Refresh and try again.');
  const recoveryCode = randomToken();
  const result = await db.prepare(`UPDATE guest_wallets SET recovery_hash=? WHERE user_id=? AND recovery_hash=?
    AND EXISTS(SELECT 1 FROM users WHERE id=guest_wallets.user_id AND is_guest=1)
    AND EXISTS(SELECT 1 FROM sessions WHERE user_id=guest_wallets.user_id AND token_hash=? AND expires_at>unixepoch())`)
    .bind(await sha256(recoveryCode), user.id, previous.recovery_hash, await sha256(cookie(request, GUEST_SESSION)!)).run();
  if (result.meta.changes !== 1) throw new ApiError(409, 'The guest wallet changed. Refresh and try again.');
  return Response.json({ recoveryCode, userId: user.id }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function restoreGuestWallet(request: Request, env: Env): Promise<Response> {
  await limitWallet(request, env, 'restore');
  const existing = await currentUser(request, env);
  if (existing && !existing.isGuest) throw new ApiError(409, 'Sign out of your account before restoring a guest wallet.');
  const body = await authBody(request);
  if (typeof body.recoveryCode !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.recoveryCode)) throw invalidRecovery();
  const db = database(env), recoveryCode = body.recoveryCode, token = randomToken();
  const [recoveryHash, tokenHash] = await Promise.all([sha256(recoveryCode), sha256(token)]);
  const user = await db.prepare(`SELECT u.id,u.name,u.email,u.picture,${creditBalanceColumns}
    FROM guest_wallets w JOIN users u ON u.id=w.user_id WHERE w.recovery_hash=? AND u.is_guest=1`)
    .bind(recoveryHash).first<User & CreditBalance>();
  if (!user) throw invalidRecovery();
  // Keep the saved recovery code valid if the response or its cookie is lost.
  // Only explicit rotation replaces the code; each restore revokes old sessions.
  const results = await db.batch([
    db.prepare(`DELETE FROM sessions WHERE user_id=(SELECT w.user_id FROM guest_wallets w
      JOIN users u ON u.id=w.user_id WHERE w.recovery_hash=? AND u.is_guest=1)`).bind(recoveryHash),
    db.prepare(`INSERT INTO sessions(token_hash,user_id,expires_at)
      SELECT ?,w.user_id,unixepoch()+? FROM guest_wallets w JOIN users u ON u.id=w.user_id
      WHERE w.recovery_hash=? AND u.is_guest=1`).bind(tokenHash, lifetime, recoveryHash),
  ]);
  if (results[1].meta.changes !== 1) throw invalidRecovery();
  return Response.json({ user: publicUser({ ...user, name: 'Guest', email: '', isGuest: true }), credits: user.credits, recoveryCode }, {
    headers: { 'Cache-Control': 'no-store', 'Set-Cookie': setCookie(GUEST_SESSION, token, env, lifetime) },
  });
}
