import { describe, it, expect } from 'vitest';
import { safeReturnTo, imageType, validMediaUrl, verifyHmac, hmac } from '../lib/server/security';
import { getVideoCost, validateVideo } from '../lib/video-options';
import { reserveGeneration, refundGeneration } from '../lib/server/billing';
import { database,jobEnv } from './helpers';
describe('security boundaries',()=>{
 it('blocks external and browser-normalized OAuth redirects',()=>{for(const value of ['https://evil.test','//evil.test','/\\evil.test','/%2f%2fevil.test'])expect(safeReturnTo(value)).toBe('/');expect(safeReturnTo('/pricing?ok=1')).toBe('/pricing?ok=1');});
 it('checks image signatures rather than declared MIME alone',()=>{expect(imageType(new Uint8Array([0xff,0xd8,0xff,0xe0]),'image/jpeg')).toBe('image/jpeg');expect(()=>imageType(new TextEncoder().encode('<svg/>'),'image/png')).toThrow();expect(()=>imageType(new Uint8Array([0xff,0xd8,0xff]),'image/png')).toThrow();});
 it('limits fetched media to explicit HTTPS hosts',()=>{expect(validMediaUrl('https://cdn.apimart.ai/a','cdn.apimart.ai')).toBe(true);for(const url of ['http://cdn.apimart.ai/a','https://evil.test/a','https://127.0.0.1/a','https://cdn.apimart.ai.evil.test/a'])expect(validMediaUrl(url,'cdn.apimart.ai')).toBe(false);});
 it('verifies exact raw webhook bodies',async()=>{const signature=await hmac('test-secret','{"a":1}');expect(await verifyHmac('test-secret','{"a":1}',signature)).toBe(true);expect(await verifyHmac('test-secret','{"a":2}',signature)).toBe(false);});
});
describe('server pricing',()=>{
 it('calculates all six prices',()=>expect([5,10,15].flatMap(d=>['480p','720p'].map(r=>getVideoCost(d as 5,r as '480p')))).toEqual([50,100,75,150,150,300]));
 it('rejects altered generation parameters',()=>expect(()=>validateVideo({leftImage:'x',rightImage:'y',duration:1,resolution:'1080p',aspect:'1:1'})).toThrow());
});
describe('transactional credits',()=>{
 it('never overdraws on competing generations',async()=>{const {db,sqlite}=database();const requests=await Promise.allSettled([reserveGeneration(db,'u','a','video',{},75),reserveGeneration(db,'u','b','video',{},75)]);expect(requests.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(25);expect(sqlite.prepare('SELECT count(*) n FROM generations').get()?.n).toBe(1);});
 it('reuses an idempotency key without charging twice',async()=>{const {db,sqlite}=database();const a=await reserveGeneration(db,'u','same','video',{},50);const b=await reserveGeneration(db,'u','same','video',{},50);expect(b.id).toBe(a.id);expect(sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);});
 it('refunds a failed or cancelled job exactly once',async()=>{const {db,sqlite}=database();const job=await reserveGeneration(db,'u','x','video',{},100);await refundGeneration(db,job.id,'cancelled','Cancelled');await refundGeneration(db,job.id,'cancelled','Cancelled');expect(sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);expect(sqlite.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='refund'").get()?.n).toBe(1);});
});
import { normalizeProviderStatus, usableAsset, validateSong } from '../lib/server/provider';
import { applyCheckout } from '../lib/server/payments';
describe('provider transitions',()=>{
 it('recognizes cancellation as a terminal refundable state',()=>expect(normalizeProviderStatus('cancelled')).toBe('cancelled'));
 it('rejects a legacy music model instead of silently substituting V6',()=>expect(()=>validateSong({model:'v5',custom:false,instrumental:false,prompt:'Original rap'})).toThrow(/available Suno V6/i));
 it('rejects partially successful or unidentifiable avatar results',()=>{expect(()=>usableAsset({usable_assets:[]})).toThrow();expect(()=>usableAsset({usable_assets:[{asset_url:'https://example.com/a'}]})).toThrow();expect(usableAsset({usable_assets:[{asset_url:'asset://a'}]})).toBe('asset://a');});
});
function paidEvent(){return {id:'evt_1',eventType:'checkout.completed',object:{id:'ch_1',request_id:'o',status:'completed',product:{id:'prod_1'},metadata:{userId:'u',packId:'starter'},order:{id:'ord_1',status:'paid',amount:990,currency:'USD',product:'prod_1'}}};}
function orderDB(){const d=database();d.sqlite.exec("INSERT INTO orders(id,user_id,pack_id,product_id,amount,currency,credits,checkout_id) VALUES('o','u','starter','prod_1',990,'USD',300,'ch_1')");return d;}
describe('verified payment accounting',()=>{
 it('credits an exact paid order once across duplicate and alternative event ids',async()=>{const {db,sqlite}=orderDB();const e=paidEvent();await applyCheckout(db,e);await applyCheckout(db,e);await applyCheckout(db,{...e,id:'evt_2'});expect(sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(400);});
 it('rejects wrong amount, product, account and unpaid checkout',async()=>{for(const field of ['amount','product','user','status']){const {db,sqlite}=orderDB(),e=paidEvent();if(field==='amount')e.object.order.amount=1;if(field==='product')e.object.product.id='evil';if(field==='user')e.object.metadata.userId='evil';if(field==='status')e.object.order.status='pending';await expect(applyCheckout(db,e)).rejects.toThrow();expect(sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);}});
});
import { vi } from 'vitest';
import { advanceJob } from '../lib/server/jobs';
import { currentUser } from '../lib/server/auth';
import { randomToken,sha256,readLimited,sameOrigin } from '../lib/server/security';
import { signedMediaUrl,verifyMediaSignature } from '../lib/server/media';
describe('task recovery and session isolation',()=>{
 it('does not submit a second paid request after an ambiguous submission',async()=>{const {db,sqlite}=database();const j=await reserveGeneration(db,'u','uncertain','video',{},50);sqlite.prepare("UPDATE generations SET stage='submitting_generation' WHERE id=?").run(j.id);const fetcher=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Network must not be used'));try{await advanceJob(jobEnv(db),j.id);expect(sqlite.prepare('SELECT stage FROM generations').get()?.stage).toBe('manual_review');expect(fetcher).not.toHaveBeenCalled();expect(sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);}finally{fetcher.mockRestore();}});
 it('returns credits when the provider cancels a submitted job',async()=>{const {db,sqlite}=database();const j=await reserveGeneration(db,'u','cancel-provider','video',{},100);sqlite.prepare("UPDATE generations SET stage='polling',provider_id='task_1' WHERE id=?").run(j.id);const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({code:200,data:{status:'cancelled'}}));try{await advanceJob(jobEnv(db),j.id);await advanceJob(jobEnv(db),j.id);expect(sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);expect(sqlite.prepare('SELECT status FROM generations').get()?.status).toBe('cancelled');}finally{fetcher.mockRestore();}});
 it('does not refund an already completed generation',async()=>{const {db,sqlite}=database();const j=await reserveGeneration(db,'u','completed','video',{},50);sqlite.prepare("UPDATE generations SET status='completed' WHERE id=?").run(j.id);await refundGeneration(db,j.id,'failed','late failure');expect(sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(50);});
 it('refuses changed options on an existing idempotency key',async()=>{const {db}=database();await reserveGeneration(db,'u','same','video',{duration:5},50);await expect(reserveGeneration(db,'u','same','video',{duration:15},100)).rejects.toThrow(/identifier/);});
 it('requires a valid unexpired opaque session token',async()=>{const {db,sqlite}=database(),token=randomToken();sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+60)').run(await sha256(token),'u');expect((await currentUser(new Request('https://example.test',{headers:{cookie:`migos_session=${token}`}}),{DB:db}))?.id).toBe('u');expect(await currentUser(new Request('https://example.test',{headers:{cookie:'migos_session=forged'}}),{DB:db})).toBeNull();sqlite.exec('UPDATE sessions SET expires_at=0');expect(await currentUser(new Request('https://example.test',{headers:{cookie:`migos_session=${token}`}}),{DB:db})).toBeNull();});
 it('rejects oversized streamed uploads and cross-site mutations',async()=>{await expect(readLimited(new Request('https://example.test',{method:'POST',body:'12345'}),4)).rejects.toThrow(/large/);expect(()=>sameOrigin(new Request('https://example.test',{headers:{origin:'https://evil.test'}}),'https://example.test')).toThrow();});
 it('binds signed media to the exact key and expiry',async()=>{const env=jobEnv({} as D1Database),key='users/u/uploads/a';const url=new URL(await signedMediaUrl(env,key));expect(await verifyMediaSignature(env,key,url)).toBe(true);expect(await verifyMediaSignature(env,'users/other/uploads/a',url)).toBe(false);url.searchParams.set('expires','1');expect(await verifyMediaSignature(env,key,url)).toBe(false);});
});
