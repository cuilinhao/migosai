/** Monthly allowances are separate from users.credits (permanent purchases).
 * All read paths use SQLite's current time; expiry never depends on a cron job.
 */
export type CreditBalance = {credits:number;permanentCredits:number;subscriptionCredits:number;subscriptionCreditsExpireAt:number|null};
export const creditBalanceColumns = `u.credits AS permanentCredits,
 COALESCE((SELECT SUM(p.remaining) FROM subscription_credit_periods p WHERE p.user_id=u.id AND p.starts_at<=unixepoch() AND p.ends_at>unixepoch()),0) AS subscriptionCredits,
 u.credits+COALESCE((SELECT SUM(p.remaining) FROM subscription_credit_periods p WHERE p.user_id=u.id AND p.starts_at<=unixepoch() AND p.ends_at>unixepoch()),0) AS credits,
 (SELECT MIN(p.ends_at) FROM subscription_credit_periods p WHERE p.user_id=u.id AND p.starts_at<=unixepoch() AND p.ends_at>unixepoch() AND p.remaining>0) AS subscriptionCreditsExpireAt`;
export async function getCreditBalance(db:D1Database,userId:string):Promise<CreditBalance>{
 const row=await db.prepare(`SELECT ${creditBalanceColumns} FROM users u WHERE u.id=?`).bind(userId).first<CreditBalance>();
 if(!row)throw new Error('Credit account not found.');
 return row;
}
export type SubscriptionInvoiceGrant={subscriptionId:string;userId:string;providerMode:'test'|'live';invoiceId:string;periodStart:number;periodEnd:number;interval:'month'|'year';monthlyCredits:number};
/** Clamp each month against the original UTC anchor, never the prior clamped date. */
function anchoredMonth(start:number,offset:number):number{
 const date=new Date(start*1000);
 const year=date.getUTCFullYear(),month=date.getUTCMonth()+offset;
 const lastDay=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return Date.UTC(year,month,Math.min(date.getUTCDate(),lastDay),date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds())/1000;
}
function validGrant(input:SubscriptionInvoiceGrant):boolean{
 return !!input.subscriptionId&&!!input.userId&&!!input.invoiceId&&['test','live'].includes(input.providerMode)&&['month','year'].includes(input.interval)&&Number.isSafeInteger(input.monthlyCredits)&&input.monthlyCredits>0&&Number.isSafeInteger(input.periodStart)&&input.periodStart>0&&Number.isSafeInteger(input.periodEnd)&&input.periodEnd>input.periodStart&&(input.periodEnd-input.periodStart)>=(input.interval==='year'?364:27)*86400&&(input.periodEnd-input.periodStart)<=(input.interval==='year'?367:32)*86400;
}
function matches(row:Record<string,unknown>,input:SubscriptionInvoiceGrant):boolean{
 return row.subscription_id===input.subscriptionId&&row.user_id===input.userId&&row.provider_mode===input.providerMode&&row.invoice_id===input.invoiceId&&row.period_start===input.periodStart&&row.period_end===input.periodEnd&&row.billing_interval===input.interval&&row.monthly_credits===input.monthlyCredits;
}
/** Call only after Stripe payment/ownership/price evidence has been verified.
 * One D1 batch atomically creates the invoice, all allowance buckets and ledger
 * records. A duplicate invoice cannot replenish consumed or expired allowance.
 */
export async function grantSubscriptionInvoice(db:D1Database,input:SubscriptionInvoiceGrant):Promise<{granted:boolean}>{
 if(!validGrant(input))throw new Error('Invalid subscription invoice grant.');
 const invoiceKey=`${input.providerMode}:${input.invoiceId}`;
 const args=[input.subscriptionId,input.userId,input.providerMode,input.invoiceId,input.periodStart,input.periodEnd,input.interval,input.monthlyCredits];
 const existing=await db.prepare('SELECT * FROM subscription_invoices WHERE provider_mode=? AND invoice_id=?').bind(input.providerMode,input.invoiceId).first<Record<string,unknown>>();
 if(existing){if(!matches(existing,input))throw new Error('Subscription invoice conflicts with the original grant.');return {granted:false};}
 const subscription=await db.prepare('SELECT user_id,provider_mode,billing_interval,monthly_credits FROM subscriptions WHERE id=?').bind(input.subscriptionId).first<Record<string,unknown>>();
 if(!subscription||subscription.user_id!==input.userId||subscription.provider_mode!==input.providerMode||subscription.billing_interval!==input.interval||subscription.monthly_credits!==input.monthlyCredits)throw new Error('Subscription invoice does not match the subscription.');
 const statements=[db.prepare(`INSERT INTO subscription_invoices(id,subscription_id,user_id,provider_mode,invoice_id,period_start,period_end,billing_interval,monthly_credits) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(provider_mode,invoice_id) DO NOTHING`).bind(invoiceKey,...args)];
 const count=input.interval==='year'?12:1;
 for(let index=0;index<count;index++){
  const start=anchoredMonth(input.periodStart,index),end=index===count-1?input.periodEnd:anchoredMonth(input.periodStart,index+1),id=`${invoiceKey}:${index}`;
  // The full match predicate prevents a racing conflicting invoice delivery
  // from adding buckets using another delivery's amount or account identity.
  statements.push(db.prepare(`INSERT INTO subscription_credit_periods(id,invoice_id,subscription_id,user_id,starts_at,ends_at,granted,remaining) SELECT ?,id,subscription_id,user_id,?,?,monthly_credits,monthly_credits FROM subscription_invoices WHERE id=? AND subscription_id=? AND user_id=? AND provider_mode=? AND invoice_id=? AND period_start=? AND period_end=? AND billing_interval=? AND monthly_credits=? ON CONFLICT(id) DO NOTHING`).bind(id,start,end,invoiceKey,...args));
  statements.push(db.prepare(`INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id,created_at) SELECT id||':grant',user_id,granted,'subscription_grant',id,starts_at FROM subscription_credit_periods WHERE id=? ON CONFLICT(kind,reference_id) DO NOTHING`).bind(id));
 }
 const results=await db.batch(statements);
 const saved=await db.prepare('SELECT * FROM subscription_invoices WHERE id=?').bind(invoiceKey).first<Record<string,unknown>>();
 if(!saved||!matches(saved,input))throw new Error('Subscription invoice conflicts with the original grant.');
 return {granted:results[0].meta.changes>0};
}
