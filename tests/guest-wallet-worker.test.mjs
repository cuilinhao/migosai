import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://guest.example.invalid';
let worker, db;
beforeAll(async () => {
  const bundled = await build({ stdin: { resolveDir: root, contents: `
    import {POST as create} from './app/api/guest-wallet/route';
    import {POST as recovery} from './app/api/guest-wallet/recovery/route';
    import {POST as restore} from './app/api/guest-wallet/restore/route';
    import {GET as me} from './app/api/me/route';
    export default {async fetch(request, env) {
      globalThis.testEnv = env;
      const path = new URL(request.url).pathname;
      if (path === '/create') return create(request, {});
      if (path === '/recovery') return recovery(request, {});
      if (path === '/restore') return restore(request, {});
      return me(request, {});
    }};` }, bundle: true, platform: 'browser', format: 'esm', write: false, external: ['node:crypto'], plugins: [{ name: 'context', setup(builder) {
      builder.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({ path: 'context', namespace: 'test-context' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-context' }, () => ({ contents: 'export function getCloudflareContext(){return {env:globalThis.testEnv};}' }));
    } }] });
  worker = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundled.outputFiles[0].text,
    compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'], cf: false, d1Databases: ['DB'],
    bindings: { APP_URL: origin }, outboundService: () => new Response('External request blocked', { status: 403 }),
  }));
  db = await worker.getD1Database('DB');
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8')
      .replace(/^--.*$/gm, '').replace(/CREATE TRIGGER[\s\S]*?END;/g, s => s.replace(/\s+/g, ' '));
    await db.exec(sql);
  }
}, 30000);
afterAll(async () => { await worker?.dispose(); });
const post = (path, body = {}, cookie = '', headers = {}) => worker.dispatchFetch(origin + path, {
  method: 'POST', headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.10', cookie, ...headers }, body: JSON.stringify(body),
});
const getCookie = response => response.headers.get('set-cookie')?.split(';')[0];
const me = async cookie => (await worker.dispatchFetch(origin + '/me', { headers: { cookie } })).json();

describe('guest wallet routes in real Cloudflare workerd', () => {
  it('keeps a paid wallet recoverable after concurrent restores or lost response cookies', async () => {
    const created = await post('/create');
    expect(created.status, await created.clone().text()).toBe(200);
    const oldCookie = getCookie(created), guest = await created.json();
    await db.prepare("INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id) VALUES('worker-payment',?,300,'payment','worker-guest-paid')").bind(guest.user.id).run();
    expect(await me(oldCookie)).toMatchObject({ user: { id: guest.user.id, isGuest: true, email: '' }, credits: 300 });
    const results = await Promise.all([post('/restore', { recoveryCode: guest.recoveryCode }), post('/restore', { recoveryCode: guest.recoveryCode })]);
    expect(results.map(r => r.status)).toEqual([200, 200]);
    // Deliberately discard both response cookies, as if the browser lost the response.
    const success = await post('/restore', { recoveryCode: guest.recoveryCode });
    expect(success.status).toBe(200);
    const restored = await success.json();
    expect(restored).toMatchObject({ user: { id: guest.user.id, isGuest: true }, credits: 300 });
    expect(restored.recoveryCode).toBe(guest.recoveryCode);
    expect(await me(oldCookie)).toMatchObject({ user: null, credits: 0 });
    expect(await me(getCookie(success))).toMatchObject({ user: { id: guest.user.id }, credits: 300 });
    expect(await db.prepare('SELECT count(*) AS n FROM sessions WHERE user_id=?').bind(guest.user.id).first()).toEqual({ n: 1 });
    expect(await db.prepare('SELECT count(*) AS n FROM credit_ledger WHERE user_id=?').bind(guest.user.id).first()).toEqual({ n: 1 });
  });

  it('keeps a recovered browser in the same wallet and rejects cross-site recovery rotation', async () => {
    const created = await post('/create');
    const cookie = getCookie(created), guest = await created.json();
    const blocked = await post('/recovery', {}, cookie, { origin: 'https://evil.invalid' });
    expect(blocked.status).toBe(403);
    const rotated = await post('/recovery', { expectedUserId: guest.user.id }, cookie);
    expect(rotated.status).toBe(200);
    const code = (await rotated.json()).recoveryCode;
    expect((await post('/restore', { recoveryCode: guest.recoveryCode })).status).toBe(401);
    const restored = await post('/restore', { recoveryCode: code });
    expect(restored.status).toBe(200);
    const reused = await post('/create', {}, getCookie(restored));
    expect(await reused.json()).toMatchObject({ user: { id: guest.user.id, email: '', isGuest: true }, credits: 0 });
    expect(reused.headers.get('set-cookie')).toBeNull();
  });
});
