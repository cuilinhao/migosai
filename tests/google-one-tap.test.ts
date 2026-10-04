import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as auth from '../lib/server/auth';
import { database } from './helpers';

const origin = 'https://example.test';
const payload = { iss: 'https://accounts.google.com', aud: 'test-client', sub: 'google-one-tap-user', email: 'google@example.test', email_verified: true, name: 'Google User' };
const base64 = (value: string | Uint8Array) => Buffer.from(value).toString('base64url');
let privateKey: CryptoKey, jwk: JsonWebKey;
beforeAll(async () => {
  const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash:'SHA-256' }, true, ['sign','verify']);
  privateKey = keys.privateKey;
  jwk = { ...await crypto.subtle.exportKey('jwk',keys.publicKey), kid: 'fixture-key', alg: 'RS256', use:'sig' } as JsonWebKey;
});
async function sign(nonce: string, patch: Record<string,unknown> = {}, header: Record<string,unknown> = {}) {
  const now = Math.floor(Date.now()/1000);
  const message = base64(JSON.stringify({alg:'RS256',kid:'fixture-key',...header})) + '.' + base64(JSON.stringify({...payload,iat:now,exp:now+3600,nonce,...patch}));
  return message + '.' + base64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,new TextEncoder().encode(message))));
}
describe('Google One Tap authentication', () => {
  let db: ReturnType<typeof database>['db'];
  let sqlite: ReturnType<typeof database>['sqlite'];
  const env = () => ({DB:db, APP_URL:origin, GOOGLE_CLIENT_ID:'test-client'});
  beforeEach(() => {
    ({db,sqlite}=database());
    vi.spyOn(globalThis,'fetch').mockImplementation(async url => {
      if (String(url)==='https://www.googleapis.com/oauth2/v3/certs') return Response.json({keys:[jwk]}, {headers:{'Cache-Control':'public, max-age=3600'}});
      throw new Error('Unexpected external request');
    });
  });
  afterEach(() => {vi.restoreAllMocks();sqlite.close();});
  async function start() {
    expect(auth).toHaveProperty('startOneTap');
    const response = await auth.startOneTap(new Request(origin+'/api/auth/google/one-tap'),env());
    const body = await response.json() as {nonce:string;clientId:string};
    expect(body.clientId).toBe('test-client');
    expect(response.headers.get('set-cookie')).toContain('; HttpOnly; SameSite=Lax;');
    expect(response.headers.get('set-cookie')).toContain('; Secure');
    return {...body,cookie:response.headers.get('set-cookie')!.split(';')[0]};
  }
  const post = (credential:string,cookie:string,requestOrigin=origin) => new Request(origin+'/api/auth/google/one-tap',{method:'POST',headers:{origin:requestOrigin,cookie,'Content-Type':'application/json'},body:JSON.stringify({credential})});
  it('signs in using verified Google tokens without a client secret, persists zero-credit session and blocks replay', async () => {
    const config=await start(), credential=await sign(config.nonce);
    const response=await auth.finishOneTap(post(credential,config.cookie),env());
    expect(await response.json()).toEqual({ok:true});
    const session=response.headers.getSetCookie().find(value=>value.startsWith('migos_session='))!;
    const user=await auth.currentUser(new Request(origin+'/api/me',{headers:{cookie:session.split(';')[0]}}),env());
    expect(user).toMatchObject({email:payload.email,name:payload.name,credits:0});
    expect(sqlite.prepare('SELECT * FROM credit_ledger WHERE user_id=?').all(user!.id)).toEqual([]);
    await expect(auth.finishOneTap(post(credential,config.cookie),env())).rejects.toMatchObject({status:400});
    expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toMatchObject({n:1});
  });
  it('rejects cross-origin login, missing cookies, nonce mismatches and expired nonces', async () => {
    const config=await start(), credential=await sign(config.nonce);
    await expect(auth.finishOneTap(post(credential,config.cookie,'https://evil.test'),env())).rejects.toMatchObject({status:403});
    await expect(auth.finishOneTap(post(credential,''),env())).rejects.toMatchObject({status:400});
    await expect(auth.finishOneTap(post(await sign('another-nonce'),config.cookie),env())).rejects.toMatchObject({status:401});
    sqlite.prepare('UPDATE one_tap_nonces SET expires_at=unixepoch()-1').run();
    await expect(auth.finishOneTap(post(credential,config.cookie),env())).rejects.toMatchObject({status:400});
    expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toMatchObject({n:0});
  });
  it.each([{iss:'https://evil.test'},{aud:'another-app'},{exp:1},{iat:9999999999},{email_verified:false},{sub:''}])('rejects invalid verified claims %j',async patch=>{
    const config=await start();
    await expect(auth.finishOneTap(post(await sign(config.nonce,patch),config.cookie),env())).rejects.toMatchObject({status:401});
  });
  it('rejects signature tampering and algorithm substitution',async()=>{
    const config=await start(), credential=await sign(config.nonce);
    const parts=credential.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
    await expect(auth.finishOneTap(post(parts.join('.'),config.cookie),env())).rejects.toMatchObject({status:401});
    await expect(auth.finishOneTap(post(await sign(config.nonce,{}, {alg:'none'}),config.cookie),env())).rejects.toMatchObject({status:401});
  });
  it('does not auto-link a case-insensitive email collision with an unverified password account',async()=>{
    expect(auth).toHaveProperty('registerEmail');
    await auth.registerEmail(new Request(origin+'/api/auth/email/register',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({email:'GOOGLE@example.test',password:'my long password'})}),env());
    const config=await start();
    await expect(auth.finishOneTap(post(await sign(config.nonce),config.cookie),env())).rejects.toMatchObject({status:409});
    expect(sqlite.prepare('SELECT google_sub FROM users WHERE email=?').get(payload.email)).toMatchObject({google_sub:null});
    expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toMatchObject({n:1});
  });
  it('reuses Google subject identity across logins and preserves purchased credits',async()=>{
    sqlite.prepare('INSERT INTO users(id,email,name,google_sub,credits) VALUES(?,?,?,?,?)').run('google','old@example.test','Old',payload.sub,500);
    const config=await start();
    await auth.finishOneTap(post(await sign(config.nonce),config.cookie),env());
    expect(sqlite.prepare('SELECT id,name,credits FROM users WHERE google_sub=?').get(payload.sub)).toMatchObject({id:'google',name:payload.name,credits:500});
  });
  it('only creates one session for parallel submissions of the same nonce',async()=>{
    const config=await start(), credential=await sign(config.nonce);
    const results=await Promise.allSettled([auth.finishOneTap(post(credential,config.cookie),env()),auth.finishOneTap(post(credential,config.cookie),env())]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(results.find(result=>result.status==='rejected')).toMatchObject({reason:{status:400}});
    expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toMatchObject({n:1});
  });
  it('reuses a live cookie nonce across concurrent tab requests without extending its expiry',async()=>{
    const config=await start();
    sqlite.prepare('UPDATE one_tap_nonces SET expires_at=unixepoch()+120').run();
    const before=sqlite.prepare('SELECT nonce_hash,expires_at FROM one_tap_nonces').get();
    const requests=await Promise.all([1,2].map(()=>auth.startOneTap(new Request(origin+'/api/auth/google/one-tap',{headers:{cookie:config.cookie}}),env())));
    for(const response of requests){
      expect(await response.json()).toMatchObject({nonce:config.nonce,clientId:'test-client'});
      const cookieHeader=response.headers.get('set-cookie')!;
      expect(cookieHeader.split(';')[0]).toBe(config.cookie);
      const maxAge=Number(/Max-Age=(\d+)/.exec(cookieHeader)![1]);
      expect(maxAge).toBeGreaterThan(115);
      expect(maxAge).toBeLessThanOrEqual(120);
    }
    expect(sqlite.prepare('SELECT nonce_hash,expires_at FROM one_tap_nonces').all()).toEqual([before]);
    expect((await auth.finishOneTap(post(await sign(config.nonce),config.cookie),env())).status).toBe(200);
  });
  it('replaces an expired cookie nonce and rejects credentials from its old prompt',async()=>{
    const config=await start();
    sqlite.prepare('UPDATE one_tap_nonces SET expires_at=unixepoch()-1').run();
    const response=await auth.startOneTap(new Request(origin+'/api/auth/google/one-tap',{headers:{cookie:config.cookie}}),env());
    const replacement=await response.json() as {nonce:string};
    expect(replacement.nonce).not.toBe(config.nonce);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=600');
    expect(sqlite.prepare('SELECT count(*) AS n FROM one_tap_nonces').get()).toMatchObject({n:1});
    await expect(auth.finishOneTap(post(await sign(config.nonce),config.cookie),env())).rejects.toMatchObject({status:400});
    const newCookie=response.headers.get('set-cookie')!.split(';')[0];
    expect((await auth.finishOneTap(post(await sign(replacement.nonce),newCookie),env())).status).toBe(200);
  });
  it('rejects cross-site nonce requests',async()=>{
    expect(auth).toHaveProperty('startOneTap');
    await expect(auth.startOneTap(new Request(origin+'/api/auth/google/one-tap',{headers:{'sec-fetch-site':'cross-site'}}),env())).rejects.toMatchObject({status:403});
    expect(sqlite.prepare('SELECT count(*) AS n FROM one_tap_nonces').get()).toMatchObject({n:0});
  });
});
