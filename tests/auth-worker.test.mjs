import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync, sign } from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const origin='https://auth.example.invalid';
let worker, db, signingKey, publicJwk;
beforeAll(async()=>{
  const keys=generateKeyPairSync('rsa',{modulusLength:2048});
  signingKey=keys.privateKey;
  publicJwk={...keys.publicKey.export({format:'jwk'}),kid:'workerd-fixture',alg:'RS256',use:'sig'};
  const bundled=await build({stdin:{resolveDir:root,contents:`
    import {POST as register} from './app/api/auth/email/register/route';
    import {POST as login} from './app/api/auth/email/login/route';
    import {GET as me} from './app/api/me/route';
    import {GET as start, POST as finish} from './app/api/auth/google/one-tap/route';
    export default {async fetch(request,env) {
      globalThis.testEnv=env;
      const path=new URL(request.url).pathname;
      if (path==='/register') return register(request,{});
      if (path==='/login') return login(request,{});
      if (path==='/one-tap') return request.method==='POST'?finish(request,{}):start(request,{});
      return me(request,{});
    }};`},bundle:true,platform:'browser',format:'esm',write:false,external:['node:crypto'],plugins:[{name:'context',setup(builder){
      builder.onResolve({filter:/^@opennextjs\/cloudflare$/},()=>({path:'context',namespace:'test-context'}));
      builder.onLoad({filter:/.*/,namespace:'test-context'},()=>({contents:'export function getCloudflareContext(){return {env:globalThis.testEnv};}'}));
    }}]});
  worker=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:['DB'],bindings:{APP_URL:origin,GOOGLE_CLIENT_ID:'fixture-client'},outboundService:request=>{
    // Keep actual workerd Request/fetch validation; only the upstream JWKS response is controlled.
    if(request.url==='https://www.googleapis.com/oauth2/v3/certs') return Response.json({keys:[publicJwk]},{headers:{'cache-control':'public, max-age=3600'}});
    return new Response('Blocked external request',{status:403});
  }}));
  db=await worker.getD1Database('DB');
  for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort()){
    const sql=readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').replace(/^--.*$/gm,'').replace(/CREATE TRIGGER[\s\S]*?END;/g,s=>s.replace(/\s+/g,' '));
    await db.exec(sql);
  }
},30000);
afterAll(async()=>{await worker?.dispose();});
const post=(path,body,headers={})=>worker.dispatchFetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':'192.0.2.2',...headers},body:JSON.stringify(body)});
describe('authentication in Cloudflare workerd',()=>{
  it('runs real scrypt, registration, D1 session and login routes',async()=>{
    const response=await post('/register',{email:'worker@example.test',password:'workers password test'});
    expect(response.status,await response.clone().text()).toBe(200);
    expect(await response.json()).toEqual({ok:true});
    const cookie=response.headers.get('set-cookie').split(';')[0];
    const me=await worker.dispatchFetch(origin+'/me',{headers:{cookie}});
    expect(await me.json()).toMatchObject({user:{email:'worker@example.test'},credits:0,authConfigured:false,emailAuthConfigured:true,googleClientId:'fixture-client'});
    const login=await post('/login',{email:'WORKER@example.test',password:'workers password test'});
    expect(login.status,await login.clone().text()).toBe(200);
    expect(login.headers.get('set-cookie')).toContain('; Secure');
    const wrong=await post('/login',{email:'worker@example.test',password:'wrong password'});
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({error:'Email or password is incorrect.'});
  });
  it('verifies a signed One Tap credential through real workerd fetch and establishes a session',async()=>{
    const start=await worker.dispatchFetch(origin+'/one-tap');
    const {nonce}=await start.json();
    const cookie=start.headers.get('set-cookie').split(';')[0];
    const now=Math.floor(Date.now()/1000);
    const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
    const token=encode({alg:'RS256',kid:'workerd-fixture'})+'.'+encode({iss:'https://accounts.google.com',aud:'fixture-client',sub:'google-worker-user',email:'google-worker@example.test',email_verified:true,name:'Google Worker',iat:now,exp:now+3600,nonce});
    const credential=token+'.'+sign('RSA-SHA256',Buffer.from(token),signingKey).toString('base64url');
    const response=await post('/one-tap',{credential},{cookie});
    expect(response.status,await response.clone().text()).toBe(200);
    expect(await response.json()).toEqual({ok:true});
    const session=response.headers.getSetCookie().find(value=>value.startsWith('migos_session=')).split(';')[0];
    const me=await worker.dispatchFetch(origin+'/me',{headers:{cookie:session}});
    expect(await me.json()).toMatchObject({user:{email:'google-worker@example.test',name:'Google Worker'},credits:0});
  });
  it('enforces CSRF, duplicate-account and same-origin nonce boundaries through API wrappers',async()=>{
    const csrf=await post('/register',{email:'csrf@example.test',password:'workers password test'},{origin:'https://evil.example.invalid'});
    expect(csrf.status).toBe(403);
    const duplicate=await post('/register',{email:'WORKER@example.test',password:'workers password test'});
    expect(duplicate.status).toBe(409);
    const response=await worker.dispatchFetch(origin+'/one-tap');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({clientId:'fixture-client',nonce:expect.any(String)});
    const nonce=await db.prepare('SELECT nonce_hash FROM one_tap_nonces').first();
    expect(nonce.nonce_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
