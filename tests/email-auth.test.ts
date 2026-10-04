import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as auth from '../lib/server/auth';
import { database } from './helpers';
import { limitAuth } from '../lib/server/auth-security';

const password = 'A secure test password';
const post = (path: string, body: unknown, headers: Record<string,string> = {}) => new Request('https://example.test/api/auth/' + path, {
  method: 'POST', headers: { origin: 'https://example.test', 'Content-Type': 'application/json', 'cf-connecting-ip': '192.0.2.1', ...headers }, body: JSON.stringify(body),
});
describe('email authentication', () => {
  let db: ReturnType<typeof database>['db'];
  let sqlite: ReturnType<typeof database>['sqlite'];
  const env = () => ({ DB: db, APP_URL: 'https://example.test' });
  beforeEach(() => { ({ db, sqlite } = database()); });
  afterEach(() => sqlite.close());
  async function sessionUser(response: Response) {
    return auth.currentUser(new Request('https://example.test/api/me', { headers: { cookie: response.headers.get('set-cookie')!.split(';')[0] } }), env());
  }
  it('registers a normalized email with a salted hash, secure session and no credits', async () => {
    expect(auth).toHaveProperty('registerEmail');
    const result = await auth.registerEmail(post('email/register', { email: ' New@Example.test ', password }), env());
    expect(await result.json()).toEqual({ ok: true });
    expect(result.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Lax');
    expect(result.headers.get('set-cookie')).toContain('; Secure');
    const user = await sessionUser(result);
    expect(user).toMatchObject({ email: 'new@example.test', name: 'new', credits: 0 });
    const stored = sqlite.prepare('SELECT password_hash FROM password_credentials WHERE user_id=?').get(user!.id) as {password_hash:string};
    expect(stored.password_hash).toMatch(/^scrypt\$/);
    expect(stored.password_hash).not.toContain(password);
    expect(sqlite.prepare('SELECT * FROM credit_ledger WHERE user_id=?').all(user!.id)).toEqual([]);
    const login = await auth.loginEmail(post('email/login', { email: 'NEW@example.test', password }), env());
    expect(await sessionUser(login)).toMatchObject({ id: user!.id, credits: 0 });
    expect(login.headers.get('set-cookie')).not.toEqual(result.headers.get('set-cookie'));
  });
  it('does not reuse salts across accounts with identical passwords', async () => {
    expect(auth).toHaveProperty('registerEmail');
    await auth.registerEmail(post('email/register', { email: 'first@example.test', password }), env());
    await auth.registerEmail(post('email/register', { email: 'second@example.test', password }), env());
    const hashes = sqlite.prepare('SELECT password_hash FROM password_credentials').all() as {password_hash:string}[];
    expect(new Set(hashes.map(row => row.password_hash)).size).toBe(2);
  });
  it.each([{email:'bad',password},{email:'valid@example.test',password:'short'},{email:'valid@example.test',password:'x'.repeat(129)},null])('rejects invalid registration input %j', async input => {
    expect(auth).toHaveProperty('registerEmail');
    await expect(auth.registerEmail(post('email/register', input), env())).rejects.toMatchObject({ status:400 });
  });
  it('rejects cross-site requests and bounded-body violations before creating accounts', async () => {
    expect(auth).toHaveProperty('registerEmail');
    await expect(auth.registerEmail(post('email/register', { email:'new@example.test',password }, { origin:'https://evil.test' }), env())).rejects.toMatchObject({ status:403 });
    await expect(auth.registerEmail(post('email/register', { email:'new@example.test',password,extra:'x'.repeat(9000) }), env())).rejects.toMatchObject({ status:413 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM users').get()).toMatchObject({n:1});
  });
  it('rejects duplicate and Google email registrations case-insensitively', async () => {
    expect(auth).toHaveProperty('registerEmail');
    sqlite.prepare('INSERT INTO users(id,email,name,google_sub) VALUES(?,?,?,?)').run('google','EXISTING@example.test','Existing','google-existing');
    await expect(auth.registerEmail(post('email/register', { email:'existing@example.test',password }), env())).rejects.toMatchObject({status:409});
    await auth.registerEmail(post('email/register', { email:'new@example.test',password }), env());
    await expect(auth.registerEmail(post('email/register', { email:'NEW@example.test',password }), env())).rejects.toMatchObject({status:409});
    expect(sqlite.prepare('SELECT count(*) AS n FROM password_credentials').get()).toMatchObject({n:1});
  });
  it('uses the same login error for missing accounts, Google-only accounts and incorrect passwords', async () => {
    expect(auth).toHaveProperty('loginEmail');
    await auth.registerEmail(post('email/register', { email:'new@example.test',password }), env());
    for (const email of ['missing@example.test', 'a@b.c', 'new@example.test']) {
      await expect(auth.loginEmail(post('email/login', { email,password:'Wrong password' }), env())).rejects.toMatchObject({status:401,message:'Email or password is incorrect.'});
    }
    expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toMatchObject({n:1});
  });
  it('limits attempts by IP across distinct email addresses without trusting forwarded-for', async () => {
    for (let i=0;i<30;i++) await limitAuth(db,post('email/login', {}, {'x-forwarded-for':`192.0.2.${i}`}),'email-login',`user${i}@example.test`);
    await expect(limitAuth(db,post('email/login', {}, {'x-forwarded-for':'192.0.2.100'}),'email-login','another@example.test')).rejects.toMatchObject({status:429});
  });
  it('atomically refuses case-variant duplicate inserts in the database', () => {
    sqlite.prepare('INSERT INTO users(id,email,name) VALUES(?,?,?)').run('first','Mixed@example.test','First');
    expect(()=>sqlite.prepare('INSERT INTO users(id,email,name) VALUES(?,?,?)').run('second','mixed@example.test','Second')).toThrow('email_already_registered');
    expect(()=>sqlite.prepare('UPDATE users SET email=? WHERE id=?').run('MIXED@example.test','u')).toThrow('email_already_registered');
  });
  it('limits login attempts by normalized email even when client IP changes', async () => {
    expect(auth).toHaveProperty('loginEmail');
    for (let i = 0; i < 10; i++) await expect(auth.loginEmail(post('email/login', {email:'missing@example.test',password}, {'cf-connecting-ip':`192.0.2.${i}`}), env())).rejects.toMatchObject({status:401});
    await expect(auth.loginEmail(post('email/login', {email:'MISSING@example.test',password}, {'cf-connecting-ip':'192.0.2.100'}), env())).rejects.toMatchObject({status:429});
    sqlite.prepare('UPDATE auth_rate_limits SET expires_at=unixepoch()-1').run();
    await expect(auth.loginEmail(post('email/login', {email:'missing@example.test',password}), env())).rejects.toMatchObject({status:401});
  });
});
