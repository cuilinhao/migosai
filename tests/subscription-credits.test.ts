import { describe, expect, it } from 'vitest';
import { database } from './helpers';
import { reserveGeneration, refundGeneration } from '../lib/server/billing';

function fixture() {
 const d=database();
 d.sqlite.exec("INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits) VALUES('sub','u','test','creator','month','price_test',2990,60)");
 d.sqlite.exec("INSERT INTO subscription_invoices(id,subscription_id,user_id,provider_mode,invoice_id,period_start,period_end,billing_interval,monthly_credits) VALUES('invoice','sub','u','test','in_test',unixepoch()-100,unixepoch()+100,'month',60)");
 d.sqlite.exec("INSERT INTO subscription_credit_periods(id,invoice_id,subscription_id,user_id,starts_at,ends_at,granted,remaining) VALUES('bucket','invoice','sub','u',unixepoch()-100,unixepoch()+100,60,60)");
 return d;
}
describe('separate subscription and permanent accounting',()=>{
 it('spends the monthly allowance first and refunds exactly the original split',async()=>{
  const {db,sqlite}=fixture();
  const job=await reserveGeneration(db,'u','mixed','video',{},90);
  expect(sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()).toEqual({credits:70});
  expect(sqlite.prepare("SELECT remaining FROM subscription_credit_periods").get()).toEqual({remaining:0});
  await refundGeneration(db,job.id,'failed','failed');
  await refundGeneration(db,job.id,'failed','failed');
  expect(sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()).toEqual({credits:100});
  expect(sqlite.prepare("SELECT remaining FROM subscription_credit_periods").get()).toEqual({remaining:60});
 });
 it('expired original allowance never becomes permanent credit during a late refund',async()=>{
  const {db,sqlite}=fixture();
  const job=await reserveGeneration(db,'u','late','video',{},90);
  sqlite.exec("UPDATE subscription_credit_periods SET ends_at=unixepoch()-1,starts_at=unixepoch()-200");
  await refundGeneration(db,job.id,'cancelled','cancelled');
  expect(sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()).toEqual({credits:100});
  await expect(reserveGeneration(db,'u','too-much','video',{},101)).rejects.toMatchObject({status:402});
 });
 it('future and ended buckets cannot fund a generation, and overdrafts roll back all allocations',async()=>{
  const {db,sqlite}=fixture();
  sqlite.exec("UPDATE subscription_credit_periods SET starts_at=unixepoch()+1,ends_at=unixepoch()+200");
  await expect(reserveGeneration(db,'u','future','video',{},101)).rejects.toMatchObject({status:402});
  sqlite.exec("UPDATE subscription_credit_periods SET starts_at=unixepoch()-200,ends_at=unixepoch()");
  await expect(reserveGeneration(db,'u','ended','video',{},101)).rejects.toMatchObject({status:402});
  expect(sqlite.prepare('SELECT count(*) n FROM generation_credit_allocations').get()).toEqual({n:0});
  expect(sqlite.prepare('SELECT count(*) n FROM generations').get()).toEqual({n:0});
 });
});

describe('verified invoice grants',()=>{
 it('creates twelve separate UTC anchored months for an annual January 31 payment',async()=>{
  const {db,sqlite}=database();
  sqlite.exec("INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits) VALUES('annual','u','test','elite','year','price_year',10000,60)");
  const {grantSubscriptionInvoice}=await import('../lib/server/subscription-credits');
  const input={subscriptionId:'annual',userId:'u',providerMode:'test' as const,invoiceId:'in_year',periodStart:Date.parse('2028-01-31T12:34:56Z')/1000,periodEnd:Date.parse('2029-01-31T12:34:56Z')/1000,interval:'year' as const,monthlyCredits:60};
  expect(await grantSubscriptionInvoice(db,input)).toEqual({granted:true});
  expect(await grantSubscriptionInvoice(db,input)).toEqual({granted:false});
  const buckets=sqlite.prepare('SELECT starts_at,ends_at,remaining FROM subscription_credit_periods ORDER BY starts_at').all();
  expect(buckets).toHaveLength(12);
  expect(new Date(Number(buckets[0].ends_at)*1000).toISOString()).toBe('2028-02-29T12:34:56.000Z');
  expect(new Date(Number(buckets[1].ends_at)*1000).toISOString()).toBe('2028-03-31T12:34:56.000Z');
  expect(new Date(Number(buckets[11].ends_at)*1000).toISOString()).toBe('2029-01-31T12:34:56.000Z');
  expect(sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()).toEqual({credits:100});
  await expect(grantSubscriptionInvoice(db,{...input,monthlyCredits:61})).rejects.toThrow();
  await expect(grantSubscriptionInvoice(db,{...input,invoiceId:'in_other'})).rejects.toThrow();
  expect(sqlite.prepare('SELECT count(*) n FROM subscription_invoices').get()).toEqual({n:1});
 });
 it('reads only currently active credit buckets rather than future prepaid months',async()=>{
  const {db,sqlite}=fixture();
  const {getCreditBalance}=await import('../lib/server/subscription-credits');
  expect(await getCreditBalance(db,'u')).toMatchObject({credits:160,permanentCredits:100,subscriptionCredits:60});
  sqlite.exec("UPDATE subscription_credit_periods SET starts_at=unixepoch()+1,ends_at=unixepoch()+200");
  expect(await getCreditBalance(db,'u')).toMatchObject({credits:100,permanentCredits:100,subscriptionCredits:0,subscriptionCreditsExpireAt:null});
  sqlite.exec("UPDATE subscription_credit_periods SET starts_at=unixepoch()-200,ends_at=unixepoch()");
  expect(await getCreditBalance(db,'u')).toMatchObject({credits:100,subscriptionCredits:0});
 });
});

describe('verified renewal allowances',()=>{
 function renewal(){
  const data=database();
  data.sqlite.exec("INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits) VALUES('legacy','u','test','lite','month','price_legacy',759,750)");
  const periodStart=Math.floor(Date.now()/1000)-60;
  return {...data,input:{subscriptionId:'legacy',userId:'u',providerMode:'test' as const,invoiceId:'in_renewal',periodStart,periodEnd:periodStart+30*86400,interval:'month' as const,monthlyCredits:750}};
 }
 it('records the verified allowance without changing the original purchase or permanent balance',async()=>{
  const {db,sqlite,input}=renewal();
  const {grantSubscriptionInvoice}=await import('../lib/server/subscription-credits');
  expect(await grantSubscriptionInvoice(db,{...input,allowanceCredits:400})).toEqual({granted:true});
  expect(sqlite.prepare('SELECT monthly_credits FROM subscription_invoices').get()).toEqual({monthly_credits:400});
  expect(sqlite.prepare('SELECT granted,remaining FROM subscription_credit_periods').get()).toEqual({granted:400,remaining:400});
  expect(sqlite.prepare("SELECT amount FROM credit_ledger WHERE kind='subscription_grant'").get()).toEqual({amount:400});
  expect(sqlite.prepare('SELECT amount_cents,monthly_credits FROM subscriptions').get()).toEqual({amount_cents:759,monthly_credits:750});
  expect(sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()).toEqual({credits:100});
 });
 it('keeps a consumed original invoice unchanged when a later policy is supplied on replay',async()=>{
  const {db,sqlite,input}=renewal();
  const {grantSubscriptionInvoice}=await import('../lib/server/subscription-credits');
  await grantSubscriptionInvoice(db,input);
  await reserveGeneration(db,'u','original-spend','video',{},200);
  expect(await grantSubscriptionInvoice(db,{...input,allowanceCredits:400})).toEqual({granted:false});
  expect(sqlite.prepare('SELECT monthly_credits FROM subscription_invoices').get()).toEqual({monthly_credits:750});
  expect(sqlite.prepare('SELECT granted,remaining FROM subscription_credit_periods').get()).toEqual({granted:750,remaining:550});
  expect(sqlite.prepare("SELECT count(*) n,sum(amount) amount FROM credit_ledger WHERE kind='subscription_grant'").get()).toEqual({n:1,amount:750});
 });
 it('keeps the first verified allowance after policy removal or change and still rejects conflicting purchase evidence',async()=>{
  const {db,sqlite,input}=renewal();
  const {grantSubscriptionInvoice}=await import('../lib/server/subscription-credits');
  await grantSubscriptionInvoice(db,{...input,allowanceCredits:400});
  await reserveGeneration(db,'u','renewal-spend','video',{},100);
  expect(await grantSubscriptionInvoice(db,input)).toEqual({granted:false});
  expect(await grantSubscriptionInvoice(db,{...input,allowanceCredits:500})).toEqual({granted:false});
  await expect(grantSubscriptionInvoice(db,{...input,monthlyCredits:400,allowanceCredits:400})).rejects.toThrow();
  await expect(grantSubscriptionInvoice(db,{...input,periodStart:input.periodStart+1,allowanceCredits:400})).rejects.toThrow('conflicts with the original grant');
  await expect(grantSubscriptionInvoice(db,{...input,userId:'another',allowanceCredits:400})).rejects.toThrow();
  expect(sqlite.prepare('SELECT monthly_credits FROM subscription_invoices').get()).toEqual({monthly_credits:400});
  expect(sqlite.prepare('SELECT granted,remaining FROM subscription_credit_periods').get()).toEqual({granted:400,remaining:300});
  expect(sqlite.prepare("SELECT count(*) n,sum(amount) amount FROM credit_ledger WHERE kind='subscription_grant'").get()).toEqual({n:1,amount:400});
 });
 it.each([0,-1,1.5,Number.MAX_SAFE_INTEGER+1,NaN])('rejects invalid allowance %s without creating a grant',async allowanceCredits=>{
  const {db,sqlite,input}=renewal();
  const {grantSubscriptionInvoice}=await import('../lib/server/subscription-credits');
  await expect(grantSubscriptionInvoice(db,{...input,allowanceCredits})).rejects.toThrow('Invalid subscription invoice grant');
  expect(sqlite.prepare('SELECT count(*) n FROM subscription_invoices').get()).toEqual({n:0});
 });
 it('does not allow a monthly renewal policy to modify annual allowances',async()=>{
  const {db,sqlite,input}=renewal();
  sqlite.exec("UPDATE subscriptions SET billing_interval='year'");
  const {grantSubscriptionInvoice}=await import('../lib/server/subscription-credits');
  await expect(grantSubscriptionInvoice(db,{...input,interval:'year',periodEnd:input.periodStart+365*86400,allowanceCredits:400})).rejects.toThrow('Invalid subscription invoice grant');
  expect(sqlite.prepare('SELECT count(*) n FROM subscription_invoices').get()).toEqual({n:0});
 });
});

describe('authenticated spendable balance',()=>{
 it('currentUser reports only active subscription allowance together with permanent credits',async()=>{
  const {db}=fixture();
  const {createSession,currentUser}=await import('../lib/server/auth');
  const env={DB:db,APP_URL:'https://example.test'};
  const cookie=await createSession('u',env);
  const user=await currentUser(new Request('https://example.test',{headers:{cookie:cookie.split(';')[0]}}),env);
  expect(user).toMatchObject({id:'u',credits:160,permanentCredits:100,subscriptionCredits:60});
 });
});

describe('month lengths and migration preservation',()=>{
 it('uses the paid Stripe monthly boundary when a 31st anchor resumes after February',async()=>{
  const {db,sqlite}=database();
  sqlite.exec("INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits) VALUES('monthly','u','test','creator','month','price_m',1000,60)");
  const {grantSubscriptionInvoice}=await import('../lib/server/subscription-credits');
  const input={subscriptionId:'monthly',userId:'u',providerMode:'test' as const,invoiceId:'in_feb',periodStart:Date.parse('2027-02-28T12:00:00Z')/1000,periodEnd:Date.parse('2027-03-31T12:00:00Z')/1000,interval:'month' as const,monthlyCredits:60};
  expect(await grantSubscriptionInvoice(db,input)).toEqual({granted:true});
  expect(sqlite.prepare('SELECT starts_at,ends_at FROM subscription_credit_periods').get()).toEqual({starts_at:input.periodStart,ends_at:input.periodEnd});
 });
 it('leaves historical balances, ledger and orders untouched and refunds old jobs without allocations',async()=>{
  const {DatabaseSync}=await import('node:sqlite');
  const {readFileSync,readdirSync}=await import('node:fs');
  const sqlite=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')&&f<'0009').sort())sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  sqlite.exec("INSERT INTO users(id,email,name,credits) VALUES('old','old@example.test','Old',100); INSERT INTO generations(id,user_id,idempotency_key,kind,payload,cost) VALUES('old-job','old','old-key','video','{}',70); INSERT INTO orders(id,user_id,pack_id,product_id,amount,credits) VALUES('old-order','old','starter','old-price',1000,300)");
  const before=sqlite.prepare('SELECT * FROM credit_ledger').all();
  sqlite.exec(readFileSync(new URL('../migrations/0009_subscriptions.sql',import.meta.url),'utf8'));
  expect(sqlite.prepare('SELECT * FROM credit_ledger').all()).toEqual(before);
  expect(sqlite.prepare('SELECT credits FROM users').get()).toEqual({credits:30});
  expect(sqlite.prepare('SELECT purchase_type FROM orders').get()).toEqual({purchase_type:'credits'});
  sqlite.exec("UPDATE generations SET status='failed' WHERE id='old-job'; INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id) VALUES('old-refund','old',70,'refund','old-job')");
  expect(sqlite.prepare('SELECT credits FROM users').get()).toEqual({credits:100});
 });
});
