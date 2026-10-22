import {afterAll,beforeAll,beforeEach,describe,it,expect} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),origin='https://credits.example.invalid';
let worker,db,cookie;
beforeAll(async()=>{
 const bundled=await build({stdin:{resolveDir:root,contents:`
 import {grantSubscriptionInvoice,getCreditBalance} from './lib/server/subscription-credits';
 import {reserveGeneration,refundGeneration} from './lib/server/billing';
 import {createSession} from './lib/server/auth';
 import {GET as me} from './app/api/me/route';
 import {GET as credits} from './app/api/credits/route';
 export default {async fetch(request,env){globalThis.testEnv=env;try{
  const path=new URL(request.url).pathname;
  if(path==='/session')return Response.json({cookie:await createSession('u',env)});
  if(path==='/me')return me(request,{});
  if(path==='/credits')return credits(request,{});
  const input=await request.json();
  if(path==='/grant')return Response.json(await grantSubscriptionInvoice(env.DB,input));
  if(path==='/spend')return Response.json(await reserveGeneration(env.DB,'u',input.key,'video',{},input.cost));
  if(path==='/refund'){await refundGeneration(env.DB,input.id,'failed','fixture');return Response.json(await getCreditBalance(env.DB,'u'));}
  return new Response('missing',{status:404});
 }catch(error){return Response.json({error:error.message},{status:error.status||500});}}};`},bundle:true,platform:'browser',format:'esm',write:false,external:['node:crypto'],plugins:[{name:'context',setup(builder){builder.onResolve({filter:/^@opennextjs\/cloudflare$/},()=>({path:'context',namespace:'test-context'}));builder.onLoad({filter:/.*/,namespace:'test-context'},()=>({contents:'export function getCloudflareContext(){return {env:globalThis.testEnv};}'}));}}]});
 worker=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:['DB'],bindings:{APP_URL:origin},outboundService:()=>new Response('External requests forbidden',{status:403})}));
 db=await worker.getD1Database('DB');
 for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()){
  const sql=readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').replace(/^--.*$/gm,'').replace(/CREATE TRIGGER[\s\S]*?END;/g,s=>s.replace(/\s+/g,' '));
  await db.exec(sql);
 }
 await db.exec("INSERT INTO users(id,email,name,credits) VALUES('u','u@example.invalid','Fixture',100)");
 cookie=(await (await worker.dispatchFetch(origin+'/session')).json()).cookie.split(';')[0];
},30000);
afterAll(async()=>{await worker?.dispose();});
beforeEach(async()=>{
 await db.batch(['DELETE FROM generation_subscription_allocations','DELETE FROM generation_credit_allocations','DELETE FROM credit_ledger','DELETE FROM generations','DELETE FROM subscription_credit_periods','DELETE FROM subscription_invoices','DELETE FROM subscriptions',"UPDATE users SET credits=100 WHERE id='u'"].map(sql=>db.prepare(sql)));
});
const post=(path,body)=>worker.dispatchFetch(origin+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
async function sub(interval='month',start=Math.floor(Date.now()/1000)-100){
 const anchor=new Date(start*1000),next=new Date(anchor);next.setUTCMonth(anchor.getUTCMonth()+(interval==='year'?12:1));
 await db.prepare("INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits) VALUES('sub','u','test','creator',?,'price_test',1000,60)").bind(interval).run();
 return {subscriptionId:'sub',userId:'u',providerMode:'test',invoiceId:'in_fixture',periodStart:start,periodEnd:Math.floor(next.getTime()/1000),interval,monthlyCredits:60};
}
async function active(){
 const input=await sub();expect((await post('/grant',input)).status).toBe(200);return input;
}
async function balance(){return (await worker.dispatchFetch(origin+'/credits',{headers:{cookie}})).json();}
describe('subscription accounting in real Cloudflare D1/workerd',()=>{
 it('serializes concurrent overspending across allowance and permanent balances',async()=>{
  await active();
  const responses=await Promise.all(Array.from({length:8},(_,i)=>post('/spend',{key:'parallel-'+i,cost:40})));
  expect(responses.map(r=>r.status).sort()).toEqual([200,200,200,200,402,402,402,402]);
  expect(await db.prepare("SELECT credits FROM users WHERE id='u'").first()).toEqual({credits:0});
  expect(await db.prepare('SELECT SUM(remaining) remaining FROM subscription_credit_periods').first()).toEqual({remaining:0});
  expect(await db.prepare('SELECT count(*) n FROM generations').first()).toEqual({n:4});
  expect(await db.prepare('SELECT SUM(permanent_amount) amount FROM generation_credit_allocations').first()).toEqual({amount:100});
 });
 it('reports active breakdown and ISO expiry through both authenticated routes',async()=>{
  const input=await active();
  expect(await balance()).toMatchObject({balance:160,permanentCredits:100,subscriptionCredits:60,subscriptionCreditsExpireAt:new Date(input.periodEnd*1000).toISOString()});
  expect(await (await worker.dispatchFetch(origin+'/me',{headers:{cookie}})).json()).toMatchObject({credits:160,permanentCredits:100,subscriptionCredits:60});
  expect((await worker.dispatchFetch(origin+'/credits')).status).toBe(401);
 });
 it('duplicate and concurrent paid invoice deliveries never replenish spent allowances',async()=>{
  const input=await sub();
  const deliveries=await Promise.all(Array.from({length:6},()=>post('/grant',input)));
  const bodies=await Promise.all(deliveries.map(r=>r.json()));
  expect(bodies.filter(b=>b.granted)).toHaveLength(1);
  const spent=await (await post('/spend',{key:'consume',cost:90})).json();
  expect((await post('/grant',input)).status).toBe(200);
  expect(await balance()).toMatchObject({balance:70,permanentCredits:70,subscriptionCredits:0});
  const refunds=await Promise.all(Array.from({length:6},()=>post('/refund',{id:spent.id})));
  expect(refunds.every(r=>r.status===200)).toBe(true);
  expect(await balance()).toMatchObject({balance:160,permanentCredits:100,subscriptionCredits:60});
 });
 it('expires at the exclusive end boundary and refunds into the original bucket only',async()=>{
  await active();const spent=await (await post('/spend',{key:'expire',cost:90})).json();
  await db.prepare('UPDATE subscription_credit_periods SET starts_at=unixepoch()-100,ends_at=unixepoch()').run();
  expect(await (await post('/refund',{id:spent.id})).json()).toMatchObject({credits:100,permanentCredits:100,subscriptionCredits:0});
  expect((await post('/spend',{key:'cannot-reuse-expired',cost:101})).status).toBe(402);
  expect(await balance()).toMatchObject({balance:100,subscriptionCredits:0,subscriptionCreditsExpireAt:null});
 });
 it('uses the earliest expiring allowance first even when paid periods overlap',async()=>{
  await active();
  await db.exec("INSERT INTO subscription_credit_periods(id,invoice_id,subscription_id,user_id,starts_at,ends_at,granted,remaining) SELECT 'early',id,'sub','u',unixepoch()-50,unixepoch()+100,20,20 FROM subscription_invoices");
  expect((await post('/spend',{key:'earliest',cost:50})).status).toBe(200);
  expect(await db.prepare("SELECT remaining FROM subscription_credit_periods WHERE id='early'").first()).toEqual({remaining:0});
  expect(await balance()).toMatchObject({balance:130,permanentCredits:100,subscriptionCredits:30});
 });
 it('a new month activates at its inclusive start while last month stays unusable',async()=>{
  await active();
  await db.exec("UPDATE subscription_credit_periods SET starts_at=unixepoch()-100,ends_at=unixepoch(); INSERT INTO subscription_credit_periods(id,invoice_id,subscription_id,user_id,starts_at,ends_at,granted,remaining) SELECT 'new-month',id,'sub','u',unixepoch(),unixepoch()+1000,25,25 FROM subscription_invoices");
  expect(await balance()).toMatchObject({balance:125,permanentCredits:100,subscriptionCredits:25});
  expect((await post('/spend',{key:'new-month',cost:30})).status).toBe(200);
  expect(await db.prepare("SELECT remaining FROM subscription_credit_periods WHERE id='new-month'").first()).toEqual({remaining:0});
  expect(await db.prepare("SELECT SUM(remaining) remaining FROM subscription_credit_periods WHERE id!='new-month'").first()).toEqual({remaining:60});
  expect(await balance()).toMatchObject({balance:95,subscriptionCredits:0});
 });
 it('prepaid annual invoice grants twelve anchored months and cannot spend future months',async()=>{
  const input=await sub('year',Date.parse('2028-01-31T12:00:00Z')/1000);
  expect((await post('/grant',input)).status).toBe(200);
  const rows=(await db.prepare('SELECT starts_at,ends_at FROM subscription_credit_periods ORDER BY starts_at').all()).results;
  expect(rows).toHaveLength(12);
  expect(new Date(rows[0].ends_at*1000).toISOString()).toBe('2028-02-29T12:00:00.000Z');
  expect(new Date(rows[1].ends_at*1000).toISOString()).toBe('2028-03-31T12:00:00.000Z');
  expect(await balance()).toMatchObject({balance:100,subscriptionCredits:0,ledger:[]});
  expect((await post('/spend',{key:'future',cost:101})).status).toBe(402);
 });
});
