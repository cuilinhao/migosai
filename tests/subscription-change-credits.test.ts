import { describe, expect, it } from 'vitest';
import { database } from './helpers';
import { reserveGeneration, refundGeneration } from '../lib/server/billing';
import { getCreditBalance, grantSubscriptionInvoice, grantSubscriptionChange } from '../lib/server/subscription-credits';

const day = 86400;
async function fixture(interval: 'month' | 'year' = 'month', grant = true) {
  const data = database();
  const now = Math.floor(Date.now() / 1000);
  const start = now - (interval === 'year' ? 45 : 15) * day;
  const end = interval === 'year' ? Date.UTC(new Date(start * 1000).getUTCFullYear() + 1, new Date(start * 1000).getUTCMonth(), new Date(start * 1000).getUTCDate(), new Date(start * 1000).getUTCHours(), new Date(start * 1000).getUTCMinutes(), new Date(start * 1000).getUTCSeconds()) / 1000 : start + 30 * day;
  data.sqlite.prepare("INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits) VALUES('sub','u','test','lite',?,'price_old',1490,100)").run(interval);
  data.sqlite.prepare("INSERT INTO subscription_plan_prices(subscription_id,price_id,plan_id,billing_interval,amount_cents,monthly_credits) VALUES('sub','price_new','standard',?,2990,300),('sub','price_top','pro',?,4990,500),('sub','price_year','standard','year',32000,300)").run(interval, interval);
  const base = { subscriptionId: 'sub', userId: 'u', providerMode: 'test' as const, invoiceId: 'in_base', periodStart: start, periodEnd: end, interval, monthlyCredits: 100 };
  if (grant) await grantSubscriptionInvoice(data.db, base);
  const change = { subscriptionId: 'sub', userId: 'u', providerMode: 'test' as const, invoiceId: 'in_change', periodStart: now, periodEnd: end, fromPriceId: 'price_old', toPriceId: 'price_new', fromMonthlyCredits: 100, toMonthlyCredits: 300, interval, resetPeriod: false };
  return { ...data, now, base, change };
}

describe('paid subscription changes', () => {
  it('adds only the remaining-period difference without replenishing consumed credits', async () => {
    const { db, sqlite, change } = await fixture();
    await reserveGeneration(db, 'u', 'consume', 'video', {}, 40);
    expect(await grantSubscriptionChange(db, change)).toEqual({ granted: true });
    expect(sqlite.prepare('SELECT granted,remaining FROM subscription_credit_periods').get()).toEqual({ granted: 200, remaining: 160 });
    expect(await getCreditBalance(db, 'u')).toMatchObject({ permanentCredits: 100, subscriptionCredits: 160 });
    expect(await grantSubscriptionChange(db, change)).toEqual({ granted: false });
    expect(sqlite.prepare('SELECT granted,remaining FROM subscription_credit_periods').get()).toEqual({ granted: 200, remaining: 160 });
    await expect(grantSubscriptionChange(db, { ...change, periodStart: change.periodStart + 1 })).rejects.toThrow('conflicts');
  });

  it('tops up the active annual month proportionally and future months fully', async () => {
    const { db, sqlite, change, now } = await fixture('year');
    const before = sqlite.prepare('SELECT id,starts_at,ends_at,granted,remaining FROM subscription_credit_periods ORDER BY starts_at').all() as Array<{id:string;starts_at:number;ends_at:number;granted:number;remaining:number}>;
    await grantSubscriptionChange(db, change);
    const after = sqlite.prepare('SELECT id,starts_at,ends_at,granted,remaining FROM subscription_credit_periods ORDER BY starts_at').all();
    expect(after).toEqual(before.map(bucket => {
      const delta = bucket.ends_at <= now ? 0 : Math.floor(200 * (bucket.ends_at - Math.max(bucket.starts_at, now)) / (bucket.ends_at - bucket.starts_at));
      return { ...bucket, granted: 100 + delta, remaining: 100 + delta };
    }));
    expect(sqlite.prepare('SELECT monthly_credits FROM subscription_invoices').get()).toEqual({ monthly_credits: 100 });
  });

  it('accepts out-of-order paid upgrades once base coverage exists without replaying either increment', async () => {
    const { db, sqlite, change } = await fixture();
    const later = { ...change, invoiceId: 'in_second', periodStart: change.periodStart + day, fromPriceId: 'price_new', toPriceId: 'price_top', fromMonthlyCredits: 300, toMonthlyCredits: 500 };
    await grantSubscriptionChange(db, later);
    await grantSubscriptionChange(db, change);
    await grantSubscriptionChange(db, later);
    expect(sqlite.prepare('SELECT granted,remaining FROM subscription_credit_periods').get()).toEqual({ granted: 293, remaining: 293 });
    expect(sqlite.prepare('SELECT count(*) n FROM subscription_change_invoices').get()).toEqual({ n: 2 });
  });

  it('does not replenish months already expired when an annual change invoice arrives late', async () => {
    const { db, sqlite, base, change } = await fixture('year');
    await grantSubscriptionChange(db, { ...change, periodStart: base.periodStart + day });
    expect(sqlite.prepare('SELECT granted,remaining FROM subscription_credit_periods ORDER BY starts_at LIMIT 1').get()).toEqual({ granted: 100, remaining: 100 });
    expect(sqlite.prepare('SELECT granted,remaining FROM subscription_credit_periods ORDER BY starts_at LIMIT 1 OFFSET 1').get()).toEqual({ granted: 300, remaining: 300 });
  });

  it('waits for base invoice and rejects missing or conflicting authorization', async () => {
    const { db, sqlite, base, change } = await fixture('month', false);
    await expect(grantSubscriptionChange(db, change)).rejects.toThrow('coverage');
    expect(sqlite.prepare('SELECT count(*) n FROM subscription_change_invoices').get()).toEqual({ n: 0 });
    await grantSubscriptionInvoice(db, base);
    await expect(grantSubscriptionChange(db, { ...change, toPriceId: 'price_unknown' })).rejects.toThrow();
    await expect(grantSubscriptionChange(db, { ...change, toMonthlyCredits: 301 })).rejects.toThrow();
    await expect(grantSubscriptionChange(db, { ...change, periodEnd: change.periodEnd + 1 })).rejects.toThrow('coverage');
  });

  it('retires old buckets on a paid cycle reset and late refunds cannot revive them', async () => {
    const { db, sqlite, base, change } = await fixture();
    const job = await reserveGeneration(db, 'u', 'before-reset', 'video', {}, 120);
    const reset = { ...change, toPriceId: 'price_year', interval: 'year' as const, resetPeriod: true, periodEnd: change.periodStart + 365 * day };
    expect(await grantSubscriptionChange(db, reset)).toEqual({ granted: true });
    expect(sqlite.prepare("SELECT retired_at,remaining FROM subscription_credit_periods WHERE invoice_id='test:in_base'").get()).toEqual({ retired_at: change.periodStart, remaining: 0 });
    expect(await getCreditBalance(db, 'u')).toMatchObject({ permanentCredits: 80, subscriptionCredits: 300 });
    await refundGeneration(db, job.id, 'failed', 'failed');
    expect(await getCreditBalance(db, 'u')).toMatchObject({ permanentCredits: 100, subscriptionCredits: 300 });
    expect(sqlite.prepare("SELECT remaining FROM subscription_credit_periods WHERE invoice_id='test:in_base'").get()).toEqual({ remaining: 100 });
    expect(await grantSubscriptionChange(db, reset)).toEqual({ granted: false });
    expect(await grantSubscriptionInvoice(db, base)).toEqual({ granted: false });
    await grantSubscriptionChange(db, { ...change, invoiceId: 'in_late_old', periodStart: change.periodStart - day });
    expect(await getCreditBalance(db, 'u')).toMatchObject({ subscriptionCredits: 300 });
    await expect(reserveGeneration(db, 'u', 'retired-not-spendable', 'video', {}, 401)).rejects.toMatchObject({ status: 402 });
  });

  it('keeps a delayed old invoice retired after reset and permits authorized new-price renewals', async () => {
    const { db, sqlite, base, change } = await fixture();
    await grantSubscriptionChange(db, { ...change, toPriceId: 'price_year', interval: 'year', resetPeriod: true, periodEnd: change.periodStart + 365 * day });
    const older = { ...base, invoiceId: 'in_old_delayed', periodStart: base.periodStart - 30 * day, periodEnd: base.periodStart };
    await grantSubscriptionInvoice(db, older);
    expect(sqlite.prepare("SELECT retired_at FROM subscription_credit_periods WHERE invoice_id='test:in_old_delayed'").get()).toEqual({ retired_at: change.periodStart });
    await grantSubscriptionInvoice(db, { ...base, invoiceId: 'in_same_second_delayed', periodStart: change.periodStart, periodEnd: change.periodStart + 30 * day });
    expect(sqlite.prepare("SELECT retired_at FROM subscription_credit_periods WHERE invoice_id='test:in_same_second_delayed'").get()).toEqual({ retired_at: change.periodStart });
    expect(await getCreditBalance(db, 'u')).toMatchObject({ subscriptionCredits: 300 });
    const renewed = { ...base, invoiceId: 'in_new_renewal', priceId: 'price_year', interval: 'year' as const, monthlyCredits: 300, periodStart: change.periodStart + 365 * day, periodEnd: change.periodStart + 730 * day };
    expect(await grantSubscriptionInvoice(db, renewed)).toEqual({ granted: true });
    expect(await grantSubscriptionInvoice(db, renewed)).toEqual({ granted: false });
    expect(sqlite.prepare("SELECT count(*) n FROM subscription_credit_periods WHERE invoice_id='test:in_new_renewal' AND retired_at IS NULL AND remaining=300").get()).toEqual({ n: 12 });
  });

  it('resets the exact same bucket anchor once while preserving old allocations and rejecting duplicate ordinary periods', async () => {
    const { db, sqlite, base, change } = await fixture();
    const job = await reserveGeneration(db, 'u', 'same-second-spend', 'video', {}, 40);
    const reset = { ...change, periodStart: base.periodStart, toPriceId: 'price_year', interval: 'year' as const, resetPeriod: true, periodEnd: base.periodStart + 365 * day };
    expect(await grantSubscriptionChange(db, reset)).toEqual({ granted: true });
    expect(await grantSubscriptionChange(db, reset)).toEqual({ granted: false });
    expect(sqlite.prepare("SELECT retired_at,remaining FROM subscription_credit_periods WHERE invoice_id='test:in_base'").get()).toEqual({ retired_at: base.periodStart, remaining: 60 });
    expect(await getCreditBalance(db, 'u')).toMatchObject({ permanentCredits: 100, subscriptionCredits: 300 });
    await refundGeneration(db, job.id, 'failed', 'failed');
    expect(await getCreditBalance(db, 'u')).toMatchObject({ permanentCredits: 100, subscriptionCredits: 300 });
    expect(await grantSubscriptionInvoice(db, base)).toEqual({ granted: false });
    await expect(grantSubscriptionInvoice(db, { ...base, invoiceId: 'in_duplicate_period' })).rejects.toThrow();
    await expect(grantSubscriptionInvoice(db, { ...base, invoiceId: 'in_duplicate_explicit_price', priceId: 'price_old' })).rejects.toThrow();
    expect(sqlite.prepare('SELECT count(*) n FROM subscription_invoices').get()).toEqual({ n: 2 });
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('preserves original paid invoices when callers begin supplying their original price ID', async () => {
    const { db, base } = await fixture();
    expect(await grantSubscriptionInvoice(db, { ...base, priceId: 'price_old' })).toEqual({ granted: false });
  });

  it('serializes duplicate and conflicting change deliveries in real Cloudflare D1', async () => {
    const { build } = await import('esbuild');
    const { Miniflare, convertV4MiniflareOptions } = await import('miniflare');
    const { readFileSync, readdirSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const root = fileURLToPath(new URL('../', import.meta.url));
    const bundle = await build({stdin:{resolveDir:root,contents:`
      import {grantSubscriptionInvoice,grantSubscriptionChange} from './lib/server/subscription-credits';
      export default {async fetch(request,env){try {const input=await request.json();return Response.json(await (new URL(request.url).pathname==='/change'?grantSubscriptionChange:grantSubscriptionInvoice)(env.DB,input));}catch(error){return Response.json({error:error.message},{status:500});}}};
    `},bundle:true,platform:'browser',format:'esm',write:false});
    const worker = new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-01',cf:false,d1Databases:['DB'],outboundService:()=>new Response('External requests forbidden',{status:403})}));
    try {
      const db = await worker.getD1Database('DB');
      for (const file of readdirSync(root+'/migrations').filter(file=>file.endsWith('.sql')&&file<'0011').sort()) {
        const sql = readFileSync(root+'/migrations/'+file,'utf8').replace(/^--.*$/gm,'').replace(/CREATE TRIGGER[\s\S]*?END;/g,sql=>sql.replace(/\s+/g,' '));
        await db.exec(sql);
      }
      await db.exec("INSERT INTO users(id,email,name,credits) VALUES('legacy','legacy@example.invalid','Legacy',100); INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits) VALUES('legacy','legacy','test','lite','month','price_legacy',1490,60); INSERT INTO subscription_invoices(id,subscription_id,user_id,provider_mode,invoice_id,period_start,period_end,billing_interval,monthly_credits) VALUES('legacy-invoice','legacy','legacy','test','in_legacy',unixepoch()-86400,unixepoch()+2592000,'month',60); INSERT INTO subscription_credit_periods(id,invoice_id,subscription_id,user_id,starts_at,ends_at,granted,remaining) VALUES('legacy-bucket','legacy-invoice','legacy','legacy',unixepoch()-86400,unixepoch()+2592000,60,60); INSERT INTO generations(id,user_id,idempotency_key,kind,payload,cost) VALUES('legacy-job','legacy','legacy-key','video','{}',70)");
      const beforeLedger=await db.prepare('SELECT * FROM credit_ledger').all();
      const beforeAllocations=await db.prepare('SELECT * FROM generation_subscription_allocations').all();
      const beforePermanent=await db.prepare("SELECT credits FROM users WHERE id='legacy'").first();
      const migration=readFileSync(root+'/migrations/0011_subscription_changes.sql','utf8').replace(/^--.*$/gm,'').replace(/CREATE TRIGGER[\s\S]*?END;/g,sql=>sql.replace(/\s+/g,' '));
      await db.exec(migration);
      expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
      expect((await db.prepare('SELECT * FROM credit_ledger').all()).results).toEqual(beforeLedger.results);
      expect((await db.prepare('SELECT * FROM generation_subscription_allocations').all()).results).toEqual(beforeAllocations.results);
      expect(await db.prepare("SELECT credits FROM users WHERE id='legacy'").first()).toEqual(beforePermanent);
      expect(await db.prepare("SELECT price_id FROM subscription_invoices WHERE id='legacy-invoice'").first()).toEqual({price_id:'price_legacy'});
      await db.prepare("UPDATE generations SET status='failed' WHERE id='legacy-job'").run();
      await db.prepare("INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id) VALUES('legacy-refund','legacy',70,'refund','legacy-job')").run();
      expect(await db.prepare("SELECT credits FROM users WHERE id='legacy'").first()).toEqual({credits:100});
      expect(await db.prepare("SELECT remaining FROM subscription_credit_periods WHERE id='legacy-bucket'").first()).toEqual({remaining:60});
      // The deployed previous Worker omits price_id and inserts buckets/ledger
      // itself. Its rollout-window writes must remain safe and replayable.
      const legacyStart=Math.floor(Date.now()/1000)+31*day,legacyEnd=legacyStart+30*day;
      const legacyInsert=db.prepare("INSERT INTO subscription_invoices(id,subscription_id,user_id,provider_mode,invoice_id,period_start,period_end,billing_interval,monthly_credits) VALUES('test:in_legacy_rollout','legacy','legacy','test','in_legacy_rollout',?,?,'month',60) ON CONFLICT(provider_mode,invoice_id) DO NOTHING").bind(legacyStart,legacyEnd);
      await db.batch([
        legacyInsert,
        db.prepare("INSERT INTO subscription_credit_periods(id,invoice_id,subscription_id,user_id,starts_at,ends_at,granted,remaining) SELECT 'legacy-rollout-bucket',id,subscription_id,user_id,period_start,period_end,monthly_credits,monthly_credits FROM subscription_invoices WHERE id='test:in_legacy_rollout' ON CONFLICT(id) DO NOTHING"),
        db.prepare("INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id,created_at) SELECT id||':grant',user_id,granted,'subscription_grant',id,starts_at FROM subscription_credit_periods WHERE id='legacy-rollout-bucket' ON CONFLICT(kind,reference_id) DO NOTHING"),
      ]);
      expect(await db.prepare("SELECT price_id FROM subscription_invoices WHERE id='test:in_legacy_rollout'").first()).toEqual({price_id:'price_legacy'});
      expect((await legacyInsert.run()).meta.changes).toBe(0);
      await expect(db.prepare("INSERT INTO subscription_invoices(id,subscription_id,user_id,provider_mode,invoice_id,period_start,period_end,billing_interval,monthly_credits) VALUES('test:in_legacy_duplicate','legacy','legacy','test','in_legacy_duplicate',?,?,'month',60)").bind(legacyStart,legacyEnd).run()).rejects.toThrow();
      const replay=await worker.dispatchFetch('https://fixture.invalid/grant',{method:'POST',body:JSON.stringify({subscriptionId:'legacy',userId:'legacy',providerMode:'test',invoiceId:'in_legacy_rollout',periodStart:legacyStart,periodEnd:legacyEnd,interval:'month',monthlyCredits:60})});
      expect(replay.status).toBe(200);
      expect(await replay.json()).toEqual({granted:false});
      expect(await db.prepare("SELECT count(*) n FROM subscription_credit_periods WHERE invoice_id='test:in_legacy_rollout'").first()).toEqual({n:1});
      expect(await db.prepare("SELECT count(*) n FROM credit_ledger WHERE reference_id='legacy-rollout-bucket'").first()).toEqual({n:1});
      await db.exec("INSERT INTO users(id,email,name,credits) VALUES('u','u@example.invalid','Test',100); INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits) VALUES('sub','u','test','lite','month','price_old',1490,100); INSERT INTO subscription_plan_prices(subscription_id,price_id,plan_id,billing_interval,amount_cents,monthly_credits) VALUES('sub','price_new','standard','month',2990,300),('sub','price_year','standard','year',32000,300)");
      const now = Math.floor(Date.now()/1000),start=now-15*day,end=now+15*day;
      const post=(path:string,input:unknown)=>worker.dispatchFetch('https://fixture.invalid/'+path,{method:'POST',body:JSON.stringify(input)});
      expect((await post('grant',{subscriptionId:'sub',userId:'u',providerMode:'test',invoiceId:'in_base',periodStart:start,periodEnd:end,interval:'month',monthlyCredits:100})).status).toBe(200);
      const change={subscriptionId:'sub',userId:'u',providerMode:'test',invoiceId:'in_change',periodStart:now,periodEnd:end,fromPriceId:'price_old',toPriceId:'price_new',fromMonthlyCredits:100,toMonthlyCredits:300,interval:'month',resetPeriod:false};
      const replies=await Promise.all(Array.from({length:8},()=>post('change',change)));
      expect(replies.every(reply=>reply.status===200)).toBe(true);
      expect((await Promise.all(replies.map(reply=>reply.json() as Promise<{granted:boolean}>))).filter(reply=>reply.granted)).toHaveLength(1);
      expect(await db.prepare("SELECT granted,remaining FROM subscription_credit_periods WHERE subscription_id='sub'").first()).toEqual({granted:200,remaining:200});
      expect(await db.prepare("SELECT count(*) n FROM credit_ledger WHERE reference_id LIKE '%:change:%'").first()).toEqual({n:1});
      const conflicting=await Promise.all([post('change',{...change,invoiceId:'in_conflict',periodStart:now+1}),post('change',{...change,invoiceId:'in_conflict',periodStart:now+2})]);
      expect(conflicting.map(reply=>reply.status).sort()).toEqual([200,500]);
      expect(await db.prepare("SELECT granted,remaining FROM subscription_credit_periods WHERE subscription_id='sub'").first()).toEqual({granted:299,remaining:299});
      const reset={...change,invoiceId:'in_reset',periodStart:now+3,periodEnd:now+3+365*day,toPriceId:'price_year',interval:'year',resetPeriod:true};
      const resets=await Promise.all(Array.from({length:6},()=>post('change',reset)));
      expect(resets.every(reply=>reply.status===200)).toBe(true);
      expect((await Promise.all(resets.map(reply=>reply.json() as Promise<{granted:boolean}>))).filter(reply=>reply.granted)).toHaveLength(1);
      expect(await db.prepare("SELECT count(*) n FROM subscription_credit_periods WHERE subscription_id='sub' AND retired_at IS NULL").first()).toEqual({n:12});
      expect(await db.prepare("SELECT count(*) n FROM subscription_credit_periods WHERE subscription_id='sub' AND retired_at IS NOT NULL").first()).toEqual({n:1});
    } finally { await worker.dispose(); }
  }, 30000);
});
