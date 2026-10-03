import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUser, finishGoogle, startGoogle } from '../lib/server/auth';
import { reserveGeneration } from '../lib/server/billing';
import { database } from './helpers';

const profile = {
  sub: 'google-welcome-user',
  email: 'welcome@example.test',
  email_verified: true,
  name: 'Welcome User',
  picture: 'https://example.test/profile.png',
};

describe('one-time welcome credits through Google sign-in', () => {
  let db: ReturnType<typeof database>['db'];
  let sqlite: ReturnType<typeof database>['sqlite'];

  beforeEach(() => {
    ({ db, sqlite } = database());
    vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
      if (String(url) === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'google-access-token', token_type: 'Bearer', expires_in: 3600 });
      }
      if (String(url) === 'https://openidconnect.googleapis.com/v1/userinfo') {
        return Response.json(profile);
      }
      throw new Error(`Unexpected external request: ${String(url)}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sqlite.close();
  });

  async function signIn() {
    const env = {
      DB: db,
      APP_URL: 'https://example.test',
      GOOGLE_CLIENT_ID: 'test-client',
      GOOGLE_CLIENT_SECRET: 'test-secret',
    };
    const start = await startGoogle(new Request('https://example.test/api/auth/google'), env);
    const state = new URL(start.headers.get('Location')!).searchParams.get('state')!;
    const response = await finishGoogle(new Request(
      `https://example.test/api/auth/callback/google?code=test-code&state=${state}`,
      { headers: { cookie: `migos_oauth=${state}` } },
    ), env);
    expect(response.status).toBe(302);
    const session = response.headers.getSetCookie().find(value => value.startsWith('migos_session='));
    const user = await currentUser(new Request('https://example.test/api/account', {
      headers: { cookie: session?.split(';')[0] ?? '' },
    }), env);
    if (!user) throw new Error('Google callback did not establish a valid user session');
    return user;
  }

  it('makes 50 free credits available to a newly registered user without an order', async () => {
    const user = await signIn();

    expect(user.credits).toBe(50);
    expect(sqlite.prepare('SELECT count(*) AS n FROM orders WHERE user_id=?').get(user.id)).toMatchObject({ n: 0 });
    expect(sqlite.prepare('SELECT amount,kind,reference_id FROM credit_ledger WHERE user_id=?').all(user.id))
      .toEqual([{ amount: 50, kind: 'welcome', reference_id: user.id }]);
  });

  it('grants once across repeated logins and never restores credits spent on generation', async () => {
    const first = await signIn();
    expect(await signIn()).toMatchObject({ id: first.id, credits: 50 });

    await reserveGeneration(db, first.id, 'spend-welcome-credits', 'video', {}, 50);
    expect(await signIn()).toMatchObject({ id: first.id, credits: 0 });
    expect(sqlite.prepare("SELECT count(*) AS n FROM credit_ledger WHERE user_id=? AND kind='welcome'").get(first.id))
      .toMatchObject({ n: 1 });
  });

  it.each([
    { welcome: 10, balance: 510 },
    { welcome: 100, balance: 600 },
  ])('preserves a historical $welcome-credit grant and additional test credits', async ({ welcome, balance }) => {
    sqlite.prepare('INSERT INTO users(id,email,name,google_sub) VALUES(?,?,?,?)')
      .run('historical-user', profile.email, profile.name, profile.sub);
    sqlite.prepare("INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id) VALUES(?,?,?,'welcome',?)")
      .run('historical-user:welcome', 'historical-user', welcome, 'historical-user');
    sqlite.prepare("INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id) VALUES(?,?,500,'test_credit',?)")
      .run('historical-user:test', 'historical-user', 'test-credit-grant');
    const ledgerBefore = sqlite.prepare('SELECT * FROM credit_ledger WHERE user_id=? ORDER BY id').all('historical-user');

    expect(await signIn()).toMatchObject({ id: 'historical-user', credits: balance });
    expect(await signIn()).toMatchObject({ id: 'historical-user', credits: balance });
    expect(sqlite.prepare('SELECT * FROM credit_ledger WHERE user_id=? ORDER BY id').all('historical-user'))
      .toEqual(ledgerBefore);
  });
});
