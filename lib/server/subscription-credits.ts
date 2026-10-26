/** Monthly allowances are separate from users.credits (permanent purchases).
 * All read paths use SQLite's current time; expiry never depends on a cron job.
 */
export type CreditBalance = {credits:number;permanentCredits:number;subscriptionCredits:number;subscriptionCreditsExpireAt:number|null};
export const creditBalanceColumns = `u.credits AS permanentCredits,
 COALESCE((SELECT SUM(p.remaining) FROM subscription_credit_periods p WHERE p.user_id=u.id AND p.retired_at IS NULL AND p.starts_at<=unixepoch() AND p.ends_at>unixepoch()),0) AS subscriptionCredits,
 u.credits+COALESCE((SELECT SUM(p.remaining) FROM subscription_credit_periods p WHERE p.user_id=u.id AND p.retired_at IS NULL AND p.starts_at<=unixepoch() AND p.ends_at>unixepoch()),0) AS credits,
 (SELECT MIN(p.ends_at) FROM subscription_credit_periods p WHERE p.user_id=u.id AND p.retired_at IS NULL AND p.starts_at<=unixepoch() AND p.ends_at>unixepoch() AND p.remaining>0) AS subscriptionCreditsExpireAt`;
export async function getCreditBalance(db:D1Database,userId:string):Promise<CreditBalance>{
 const row=await db.prepare(`SELECT ${creditBalanceColumns} FROM users u WHERE u.id=?`).bind(userId).first<CreditBalance>();
 if(!row)throw new Error('Credit account not found.');
 return row;
}
export type SubscriptionInvoiceGrant={subscriptionId:string;userId:string;providerMode:'test'|'live';invoiceId:string;periodStart:number;periodEnd:number;interval:'month'|'year';monthlyCredits:number;allowanceCredits?:number;priceId?:string};
/** Clamp each month against the original UTC anchor, never the prior clamped date. */
function anchoredMonth(start:number,offset:number):number{
 const date=new Date(start*1000);
 const year=date.getUTCFullYear(),month=date.getUTCMonth()+offset;
 const lastDay=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return Date.UTC(year,month,Math.min(date.getUTCDate(),lastDay),date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds())/1000;
}
function validGrant(input:SubscriptionInvoiceGrant):boolean{
 return !!input.subscriptionId&&!!input.userId&&!!input.invoiceId&&['test','live'].includes(input.providerMode)&&['month','year'].includes(input.interval)&&Number.isSafeInteger(input.monthlyCredits)&&input.monthlyCredits>0&&(input.allowanceCredits===undefined||(input.interval==='month'&&Number.isSafeInteger(input.allowanceCredits)&&input.allowanceCredits>0))&&Number.isSafeInteger(input.periodStart)&&input.periodStart>0&&Number.isSafeInteger(input.periodEnd)&&input.periodEnd>input.periodStart&&(input.periodEnd-input.periodStart)>=(input.interval==='year'?364:27)*86400&&(input.periodEnd-input.periodStart)<=(input.interval==='year'?367:32)*86400;
}
function matches(row:Record<string,unknown>,input:SubscriptionInvoiceGrant):boolean{
 return row.subscription_id===input.subscriptionId&&row.user_id===input.userId&&row.provider_mode===input.providerMode&&row.invoice_id===input.invoiceId&&row.period_start===input.periodStart&&row.period_end===input.periodEnd&&row.billing_interval===input.interval&&row.price_id===input.priceId;
}
type Purchase = {user_id:string;provider_mode:string;billing_interval:'month'|'year';monthly_credits:number;price_id:string;credit_reset_at:number};
async function purchaseTerms(db:D1Database,subscriptionId:string,subscription:Purchase,priceId?:string){
 if(priceId===undefined||priceId===subscription.price_id)return subscription;
 return db.prepare('SELECT billing_interval,monthly_credits FROM subscription_plan_prices WHERE subscription_id=? AND price_id=?').bind(subscriptionId,priceId).first<{billing_interval:'month'|'year';monthly_credits:number}>();
}
function invoiceStatements(db:D1Database,input:SubscriptionInvoiceGrant,guard='1',guardArgs:unknown[]=[]){
 const invoiceKey=`${input.providerMode}:${input.invoiceId}`;
 const args=[input.subscriptionId,input.userId,input.providerMode,input.invoiceId,input.periodStart,input.periodEnd,input.interval,input.allowanceCredits??input.monthlyCredits];
 const statements=[db.prepare(`INSERT INTO subscription_invoices(id,subscription_id,user_id,provider_mode,invoice_id,period_start,period_end,billing_interval,monthly_credits,price_id) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${guard} ON CONFLICT(provider_mode,invoice_id) DO NOTHING`).bind(invoiceKey,...args,input.priceId??null,...guardArgs)];
 const count=input.interval==='year'?12:1;
 for(let index=0;index<count;index++){
  const start=anchoredMonth(input.periodStart,index),end=index===count-1?input.periodEnd:anchoredMonth(input.periodStart,index+1),id=`${invoiceKey}:${index}`;
  statements.push(db.prepare(`INSERT INTO subscription_credit_periods(id,invoice_id,subscription_id,user_id,starts_at,ends_at,granted,remaining,retired_at) SELECT ?,i.id,i.subscription_id,i.user_id,?,?,i.monthly_credits,i.monthly_credits,CASE WHEN i.period_start<s.credit_reset_at OR (i.period_start=s.credit_reset_at AND EXISTS(SELECT 1 FROM subscription_change_invoices c WHERE c.subscription_id=i.subscription_id AND c.reset_period=1 AND c.period_start=s.credit_reset_at AND c.id!=i.id)) THEN s.credit_reset_at ELSE NULL END FROM subscription_invoices i JOIN subscriptions s ON s.id=i.subscription_id WHERE i.id=? AND i.subscription_id=? AND i.user_id=? AND i.provider_mode=? AND i.invoice_id=? AND i.period_start=? AND i.period_end=? AND i.billing_interval=? AND i.monthly_credits=? AND i.price_id IS ? AND (${guard}) ON CONFLICT(id) DO NOTHING`).bind(id,start,end,invoiceKey,...args,input.priceId??null,...guardArgs));
  statements.push(db.prepare(`INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id,created_at) SELECT id||':grant',user_id,granted,'subscription_grant',id,starts_at FROM subscription_credit_periods WHERE id=? AND (${guard}) ON CONFLICT(kind,reference_id) DO NOTHING`).bind(id,...guardArgs));
 }
 return statements;
}
/** Call only after Stripe payment/ownership/price evidence has been verified.
 * monthlyCredits is the original purchase; allowanceCredits is an optional
 * verified monthly renewal policy. The invoice freezes its actual allowance.
 * One D1 batch atomically creates the invoice, all allowance buckets and ledger
 * records. A duplicate invoice cannot replenish consumed or expired allowance.
 */
export async function grantSubscriptionInvoice(db:D1Database,input:SubscriptionInvoiceGrant):Promise<{granted:boolean}>{
 if(!validGrant(input))throw new Error('Invalid subscription invoice grant.');
 const invoiceKey=`${input.providerMode}:${input.invoiceId}`;
 const subscription=await db.prepare('SELECT user_id,provider_mode,billing_interval,monthly_credits,price_id,credit_reset_at FROM subscriptions WHERE id=?').bind(input.subscriptionId).first<Purchase>();
 const terms=subscription&&await purchaseTerms(db,input.subscriptionId,subscription,input.priceId);
 if(!subscription||subscription.user_id!==input.userId||subscription.provider_mode!==input.providerMode||!terms||terms.billing_interval!==input.interval||terms.monthly_credits!==input.monthlyCredits)throw new Error('Subscription invoice does not match the subscription.');
 input={...input,priceId:input.priceId??subscription.price_id};
 // Validate the original purchase even on retries. Once granted, the persisted
 // invoice allowance wins over later policy changes or removal.
 const existing=await db.prepare('SELECT * FROM subscription_invoices WHERE provider_mode=? AND invoice_id=?').bind(input.providerMode,input.invoiceId).first<Record<string,unknown>>();
 const frozenMatches=(saved:Record<string,unknown>)=>matches(saved,input);
 if(existing){if(!frozenMatches(existing))throw new Error('Subscription invoice conflicts with the original grant.');return {granted:false};}
 const results=await db.batch(invoiceStatements(db,input));
 const saved=await db.prepare('SELECT * FROM subscription_invoices WHERE id=?').bind(invoiceKey).first<Record<string,unknown>>();
 if(!saved||!frozenMatches(saved))throw new Error('Subscription invoice conflicts with the original grant.');
 return {granted:results[0].meta.changes>0};
}

export type SubscriptionChangeGrant = {
 subscriptionId:string; userId:string; providerMode:'test'|'live'; invoiceId:string;
 periodStart:number; periodEnd:number; fromPriceId:string; toPriceId:string;
 fromMonthlyCredits:number; toMonthlyCredits:number; interval:'month'|'year'; resetPeriod:boolean;
};
type Bucket = {id:string;starts_at:number;ends_at:number;retired_at:number|null};
function changeArgs(input:SubscriptionChangeGrant){
 return [input.subscriptionId,input.userId,input.providerMode,input.invoiceId,input.periodStart,input.periodEnd,input.fromPriceId,input.toPriceId,input.fromMonthlyCredits,input.toMonthlyCredits,input.interval,input.resetPeriod?1:0];
}
const changeMatch = 'subscription_id=? AND user_id=? AND provider_mode=? AND invoice_id=? AND period_start=? AND period_end=? AND from_price_id=? AND to_price_id=? AND from_monthly_credits=? AND to_monthly_credits=? AND billing_interval=? AND reset_period=?';
function matchesChange(row:Record<string,unknown>,input:SubscriptionChangeGrant){
 const names=['subscription_id','user_id','provider_mode','invoice_id','period_start','period_end','from_price_id','to_price_id','from_monthly_credits','to_monthly_credits','billing_interval','reset_period'];
 return changeArgs(input).every((value,index)=>row[names[index]]===value);
}

/** Only called with a verified, paid Stripe change invoice. The immutable
 * journal and unique per-bucket ledger references make a D1 batch replay safe.
 * Consumption can race the read: increments apply to the current remaining
 * amount, never to a stale balance observed in JavaScript.
 */
export async function grantSubscriptionChange(db:D1Database,input:SubscriptionChangeGrant):Promise<{granted:boolean}>{
 if(!input.subscriptionId||!input.userId||!input.invoiceId||!input.fromPriceId||!input.toPriceId||input.fromPriceId===input.toPriceId||!['test','live'].includes(input.providerMode)||!['month','year'].includes(input.interval)||typeof input.resetPeriod!=='boolean'||![input.periodStart,input.periodEnd,input.fromMonthlyCredits,input.toMonthlyCredits].every(value=>Number.isSafeInteger(value)&&value>0)||input.periodEnd<=input.periodStart||(!input.resetPeriod&&input.toMonthlyCredits<=input.fromMonthlyCredits))throw new Error('Invalid subscription change grant.');
 const subscription=await db.prepare('SELECT user_id,provider_mode,billing_interval,monthly_credits,price_id,credit_reset_at FROM subscriptions WHERE id=?').bind(input.subscriptionId).first<Purchase>();
 if(!subscription||subscription.user_id!==input.userId||subscription.provider_mode!==input.providerMode)throw new Error('Subscription change does not match the subscription.');
 const [from,to]=await Promise.all([purchaseTerms(db,input.subscriptionId,subscription,input.fromPriceId),purchaseTerms(db,input.subscriptionId,subscription,input.toPriceId)]);
 if(!from||!to||from.monthly_credits!==input.fromMonthlyCredits||to.monthly_credits!==input.toMonthlyCredits||to.billing_interval!==input.interval||(!input.resetPeriod&&from.billing_interval!==input.interval))throw new Error('Subscription change price is not authorized.');
 const key=`${input.providerMode}:${input.invoiceId}`,args=changeArgs(input);
 const existing=await db.prepare('SELECT * FROM subscription_change_invoices WHERE provider_mode=? AND invoice_id=?').bind(input.providerMode,input.invoiceId).first<Record<string,unknown>>();
 if(existing){if(!matchesChange(existing,input))throw new Error('Subscription change conflicts with the original grant.');return {granted:false};}
 const journalGuard=`EXISTS(SELECT 1 FROM subscription_change_invoices WHERE id=? AND ${changeMatch})`,journalArgs=[key,...args];
 const sameSecondReset=input.periodStart===subscription.credit_reset_at?await db.prepare('SELECT billing_interval FROM subscription_change_invoices WHERE subscription_id=? AND period_start=? AND reset_period=1 ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(input.subscriptionId,input.periodStart).first<{billing_interval:string}>():null;
 const stale=input.periodStart<subscription.credit_reset_at||(!input.resetPeriod&&!!sameSecondReset&&sameSecondReset.billing_interval!==input.interval);
 let buckets:Bucket[]=[];
 if(!stale){
  buckets=(await db.prepare('SELECT p.id,p.starts_at,p.ends_at,p.retired_at FROM subscription_credit_periods p WHERE p.subscription_id=? AND p.user_id=? AND p.retired_at IS NULL AND p.ends_at>? AND p.starts_at<? ORDER BY p.starts_at').bind(input.subscriptionId,input.userId,input.periodStart,input.resetPeriod?input.periodStart+1:input.periodEnd).all<Bucket>()).results;
  if(!buckets.length||buckets[0].starts_at>input.periodStart||buckets[0].ends_at<=input.periodStart||(!input.resetPeriod&&(buckets.at(-1)!.ends_at!==input.periodEnd||buckets.some((bucket,index)=>index>0&&bucket.starts_at!==buckets[index-1].ends_at))))throw new Error('Subscription change requires complete paid base coverage.');
 }
 const resetGrant:SubscriptionInvoiceGrant={subscriptionId:input.subscriptionId,userId:input.userId,providerMode:input.providerMode,invoiceId:input.invoiceId,periodStart:input.periodStart,periodEnd:input.periodEnd,interval:input.interval,monthlyCredits:input.toMonthlyCredits,priceId:input.toPriceId};
 if(input.resetPeriod&&!validGrant(resetGrant))throw new Error('Invalid subscription reset period.');
 // Fence a reset racing this snapshot. Every bucket must still have the same
 // boundaries and be spendable when the transaction inserts its journal.
 const coverageGuard=buckets.map(()=>'(id=? AND starts_at=? AND ends_at=? AND retired_at IS NULL)').join(' OR ');
 const insertGuard=`EXISTS(SELECT 1 FROM subscriptions WHERE id=? AND user_id=? AND provider_mode=? AND credit_reset_at=?)${buckets.length?` AND (SELECT COUNT(*) FROM subscription_credit_periods WHERE ${coverageGuard})=?`:''}`;
 const insertArgs:unknown[]=[input.subscriptionId,input.userId,input.providerMode,subscription.credit_reset_at,...buckets.flatMap(bucket=>[bucket.id,bucket.starts_at,bucket.ends_at]),...(buckets.length?[buckets.length]:[])];
 const statements=[db.prepare(`INSERT INTO subscription_change_invoices(id,subscription_id,user_id,provider_mode,invoice_id,period_start,period_end,from_price_id,to_price_id,from_monthly_credits,to_monthly_credits,billing_interval,reset_period) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${insertGuard} ON CONFLICT(provider_mode,invoice_id) DO NOTHING`).bind(key,...args,...insertArgs)];
 if(!stale&&input.resetPeriod){
  statements.push(db.prepare(`UPDATE subscriptions SET credit_reset_at=MAX(credit_reset_at,?) WHERE id=? AND (${journalGuard})`).bind(input.periodStart,input.subscriptionId,...journalArgs));
  statements.push(db.prepare(`UPDATE subscription_credit_periods SET retired_at=? WHERE subscription_id=? AND retired_at IS NULL AND invoice_id!=? AND invoice_id IN(SELECT id FROM subscription_invoices WHERE subscription_id=? AND period_start<=?) AND (${journalGuard})`).bind(input.periodStart,input.subscriptionId,key,input.subscriptionId,input.periodStart,...journalArgs));
  statements.push(...invoiceStatements(db,resetGrant,journalGuard,journalArgs));
 }else if(!stale){
  for(const bucket of buckets){
   const delta=Math.floor((input.toMonthlyCredits-input.fromMonthlyCredits)*(bucket.ends_at-Math.max(bucket.starts_at,input.periodStart))/(bucket.ends_at-bucket.starts_at));
   if(delta===0)continue;
   if(!Number.isSafeInteger(delta)||delta<0)throw new Error('Invalid subscription change allowance.');
   const ledgerKey=`${key}:change:${bucket.id}`;
   const grantGuard=`(${journalGuard}) AND NOT EXISTS(SELECT 1 FROM credit_ledger WHERE kind='subscription_grant' AND reference_id=?)`;
   const unexpired=`ends_at>(SELECT created_at FROM subscription_change_invoices WHERE id=?)`;
   statements.push(db.prepare(`UPDATE subscription_credit_periods SET granted=granted+?,remaining=remaining+? WHERE id=? AND retired_at IS NULL AND ${unexpired} AND ${grantGuard}`).bind(delta,delta,bucket.id,key,...journalArgs,ledgerKey));
   statements.push(db.prepare(`INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id,created_at) SELECT ?,user_id,?,'subscription_grant',?,MAX(starts_at,?) FROM subscription_credit_periods WHERE id=? AND retired_at IS NULL AND ${unexpired} AND (${journalGuard}) ON CONFLICT(kind,reference_id) DO NOTHING`).bind(ledgerKey,delta,ledgerKey,input.periodStart,bucket.id,key,...journalArgs));
  }
 }
 const results=await db.batch(statements);
 const saved=await db.prepare('SELECT * FROM subscription_change_invoices WHERE id=?').bind(key).first<Record<string,unknown>>();
 if(!saved)throw new Error('Subscription change coverage changed; retry the invoice.');
 if(!matchesChange(saved,input))throw new Error('Subscription change conflicts with the original grant.');
 return {granted:results[0].meta.changes>0};
}
