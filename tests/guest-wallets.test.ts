import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestWallet, rotateGuestRecovery, restoreGuestWallet } from '../lib/server/guest-wallets';
import { createSession, currentUser, logout } from '../lib/server/auth';
import { sha256 } from '../lib/server/security';
import { reserveGeneration } from '../lib/server/billing';
import { database } from './helpers';
import type { User } from '../lib/contracts';

type GuestResponse = { user: User; credits: number; recoveryCode: string };

const origin = 'https://example.test';
const request = (cookie = '', body: unknown = {}, headers: Record<string, string> = {}) => new Request(origin + '/api/guest-wallet', {
  method: 'POST', headers: { origin, 'content-type': 'application/json', cookie, ...headers }, body: JSON.stringify(body),
});
const responseCookie = (response: Response) => response.headers.get('set-cookie')!.split(';')[0];
describe('guest wallets without registration', () => {
  let d: ReturnType<typeof database>;
  beforeEach(() => { d = database(); });
  afterEach(() => { d.sqlite.close(); });
  const env = () => ({ DB: d.db, APP_URL: origin });
  async function create() {
    const response = await createGuestWallet(request(), env());
    return { response, cookie: responseCookie(response), body: await response.json() as GuestResponse };
  }

  it('creates a zero-credit wallet with a private persistent cookie and only a hashed recovery code', async () => {
    const g = await create();
    expect(g.body).toMatchObject({ user: { name: 'Guest', email: '', isGuest: true }, credits: 0 });
    expect(g.body.recoveryCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(g.response.headers.get('cache-control')).toBe('no-store');
    expect(g.response.headers.get('set-cookie')).toContain('migos_guest_session=');
    expect(g.response.headers.get('set-cookie')).toContain('Max-Age=31536000');
    expect(g.response.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Lax');
    expect(g.response.headers.get('set-cookie')).toContain('; Secure');
    expect(d.sqlite.prepare('SELECT email,is_guest,credits FROM users WHERE id=?').get(g.body.user.id))
      .toMatchObject({ email: expect.stringMatching(/@guest\.invalid$/), is_guest: 1, credits: 0 });
    const saved = d.sqlite.prepare('SELECT * FROM guest_wallets WHERE user_id=?').get(g.body.user.id);
    expect(saved).toMatchObject({ recovery_hash: await sha256(g.body.recoveryCode) });
    expect(JSON.stringify(saved)).not.toContain(g.body.recoveryCode);
    expect(d.sqlite.prepare('SELECT * FROM credit_ledger WHERE user_id=?').all(g.body.user.id)).toEqual([]);
    expect(await currentUser(request(g.cookie), env())).toMatchObject({ ...g.body.user, credits: 0 });
    await expect(reserveGeneration(d.db, g.body.user.id, 'unpaid-guest-generation', 'video', {}, 30))
      .rejects.toMatchObject({ status: 402 });
  });

  it('reuses an existing guest wallet and preserves paid credits without issuing another recovery code', async () => {
    const g = await create();
    d.sqlite.prepare("INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id) VALUES('guest-payment',?,300,'payment','paid-order')").run(g.body.user.id);
    const response = await createGuestWallet(request(g.cookie), env());
    expect(await response.json()).toEqual({ user: g.body.user, credits: 300 });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(d.sqlite.prepare('SELECT count(*) AS n FROM guest_wallets').get()).toMatchObject({ n: 1 });
  });

  it('keeps a normal signed-in account ahead of the retained guest wallet and allows fallback after logout', async () => {
    const g = await create();
    const normal = (await createSession('u', env())).split(';')[0];
    expect(await currentUser(request(normal + '; ' + g.cookie), env())).toMatchObject({ id: 'u', email: 'a@b.c', isGuest: false });
    const response = await createGuestWallet(request(normal + '; ' + g.cookie), env());
    expect(await response.json()).toMatchObject({ user: { id: 'u', isGuest: false }, credits: 100 });
    expect(response.headers.get('set-cookie')).toBeNull();
    await logout(request(normal + '; ' + g.cookie), env());
    expect(await currentUser(request(normal + '; ' + g.cookie), env())).toMatchObject({ id: g.body.user.id, isGuest: true });
  });

  it('does not accept a normal account token in the guest cookie or a guest token in the normal cookie', async () => {
    const g = await create();
    const normal = (await createSession('u', env())).split(';')[0];
    expect(await currentUser(request(normal.replace('migos_session=', 'migos_guest_session=')), env())).toBeNull();
    expect(await currentUser(request(g.cookie.replace('migos_guest_session=', 'migos_session=')), env())).toBeNull();
  });

  it('rotates recovery credentials without altering the current balance or ending the current session', async () => {
    const g = await create();
    const response = await rotateGuestRecovery(request(g.cookie, { expectedUserId: g.body.user.id }), env());
    const body = await response.json() as GuestResponse;
    expect(body).toMatchObject({ userId: g.body.user.id });
    expect(body.recoveryCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.recoveryCode).not.toBe(g.body.recoveryCode);
    expect(await currentUser(request(g.cookie), env())).toMatchObject({ id: g.body.user.id });
    await expect(restoreGuestWallet(request('', { recoveryCode: g.body.recoveryCode }), env())).rejects.toMatchObject({ status: 401 });
    expect(d.sqlite.prepare('SELECT recovery_hash FROM guest_wallets WHERE user_id=?').get(g.body.user.id))
      .toEqual({ recovery_hash: await sha256(body.recoveryCode) });
  });

  it('restores the same paid wallet and revokes old sessions while preserving its recovery code and assets', async () => {
    const g = await create();
    const other = await create();
    const extra = (await createSession(g.body.user.id, env())).split(';')[0];
    d.sqlite.prepare("INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id) VALUES('guest-payment',?,300,'payment','paid-order')").run(g.body.user.id);
    d.sqlite.prepare("INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,'image/png')").run(`users/${g.body.user.id}/uploads/photo`, g.body.user.id);
    const response = await restoreGuestWallet(request(other.cookie, { recoveryCode: g.body.recoveryCode }), env());
    const body = await response.json() as GuestResponse;
    expect(body).toMatchObject({ user: g.body.user, credits: 300 });
    expect(body.recoveryCode).toBe(g.body.recoveryCode);
    expect(await currentUser(request(responseCookie(response)), env())).toMatchObject({ id: g.body.user.id, credits: 300 });
    expect(await currentUser(request(g.cookie), env())).toBeNull();
    expect(d.sqlite.prepare('SELECT token_hash FROM sessions WHERE token_hash=?').get(await sha256(extra.split('=')[1]))).toBeUndefined();
    expect(d.sqlite.prepare('SELECT count(*) AS n FROM sessions WHERE user_id=?').get(g.body.user.id)).toEqual({ n: 1 });
    expect(d.sqlite.prepare('SELECT key FROM uploads WHERE user_id=?').all(g.body.user.id)).toHaveLength(1);
    expect(await currentUser(request(other.cookie), env())).toMatchObject({ id: other.body.user.id });
    const retry = await restoreGuestWallet(request('', { recoveryCode: g.body.recoveryCode }), env());
    expect(await retry.json()).toMatchObject({ user: g.body.user, credits: 300, recoveryCode: g.body.recoveryCode });
    expect(await currentUser(request(responseCookie(response)), env())).toBeNull();
    expect(await currentUser(request(responseCookie(retry)), env())).toMatchObject({ id: g.body.user.id, credits: 300 });
  });

  it('permits recovery retry after concurrent responses or a lost response without locking the wallet', async () => {
    const g = await create();
    let queue = Promise.resolve();
    const db = { ...d.db, batch: ((statements: D1PreparedStatement[]) => {
      const result = queue.then(() => d.db.batch(statements));
      queue = result.then(() => undefined, () => undefined);
      return result;
    }) } as D1Database;
    const results = await Promise.allSettled([
      restoreGuestWallet(request('', { recoveryCode: g.body.recoveryCode }), { ...env(), DB: db }),
      restoreGuestWallet(request('', { recoveryCode: g.body.recoveryCode }), { ...env(), DB: db }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2);
    expect(d.sqlite.prepare('SELECT count(*) AS n FROM sessions WHERE user_id=?').get(g.body.user.id)).toEqual({ n: 1 });
    const retry = await restoreGuestWallet(request('', { recoveryCode: g.body.recoveryCode }), env());
    expect(await currentUser(request(responseCookie(retry)), env())).toMatchObject({ id: g.body.user.id });
  });

  it('requires the intended owner before rotating and never rotates another wallet after a browser switch', async () => {
    const a = await create(), b = await create();
    await expect(rotateGuestRecovery(request(b.cookie, { expectedUserId: a.body.user.id }), env())).rejects.toMatchObject({ status: 409 });
    await expect(rotateGuestRecovery(request(b.cookie), env())).rejects.toMatchObject({ status: 409 });
    const restored = await restoreGuestWallet(request('', { recoveryCode: b.body.recoveryCode }), env());
    expect(await restored.json()).toMatchObject({ user: b.body.user });
  });

  it('never restores or replaces a normal authenticated account', async () => {
    const g = await create();
    const normal = (await createSession('u', env())).split(';')[0];
    await expect(restoreGuestWallet(request(normal, { recoveryCode: g.body.recoveryCode }), env())).rejects.toMatchObject({ status: 409 });
    await expect(rotateGuestRecovery(request(normal), env())).rejects.toMatchObject({ status: 403 });
    await expect(rotateGuestRecovery(request(), env())).rejects.toMatchObject({ status: 401 });
    expect(await currentUser(request(normal), env())).toMatchObject({ id: 'u', credits: 100 });
    d.sqlite.prepare('UPDATE users SET is_guest=0 WHERE id=?').run(g.body.user.id);
    await expect(restoreGuestWallet(request('', { recoveryCode: g.body.recoveryCode }), env())).rejects.toMatchObject({ status: 401 });
  });

  it.each([undefined, '', 'x', 'a'.repeat(44), 'a'.repeat(43)])('rejects invalid or unknown recovery codes without creating a session: %s', async code => {
    await expect(restoreGuestWallet(request('', { recoveryCode: code }), env())).rejects.toMatchObject({ status: 401 });
    expect(d.sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 0 });
  });

  it.each([createGuestWallet, rotateGuestRecovery, restoreGuestWallet])('rejects cross-site wallet changes', async operation => {
    const g = await create();
    await expect(operation(request(g.cookie, { recoveryCode: g.body.recoveryCode }, { origin: 'https://evil.test' }), env()))
      .rejects.toMatchObject({ status: 403 });
    expect(await currentUser(request(g.cookie), env())).toMatchObject({ id: g.body.user.id });
  });

  it('rate limits repeated recovery guesses and stores no raw recovery secret in rate-limit keys', async () => {
    for (let i = 0; i < 30; i++) await expect(restoreGuestWallet(request('', { recoveryCode: 'x'.repeat(43) }), env())).rejects.toMatchObject({ status: 401 });
    await expect(restoreGuestWallet(request('', { recoveryCode: 'x'.repeat(43) }), env())).rejects.toMatchObject({ status: 429 });
    expect(JSON.stringify(d.sqlite.prepare('SELECT * FROM auth_rate_limits').all())).not.toContain('x'.repeat(43));
  });
});
