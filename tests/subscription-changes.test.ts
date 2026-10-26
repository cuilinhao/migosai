import { afterEach, describe, expect, it, vi } from "vitest";
import { database, jobEnv } from "./helpers";
import * as subscriptions from "../lib/server/subscriptions";
import type { Env } from "../lib/server/env";

const start = Math.floor(Date.now()/1000)-15*86400;
const end = start+30*86400;
const changedAt = start+15*86400;
const price = (id="price_lite", amount=1490) => ({ id, active:true, livemode:false, currency:"usd", unit_amount:amount, type:"recurring", product:`prod_${id}`, recurring:{interval:"month",interval_count:1,usage_type:"licensed"} });
function fixture() {
  const {db,sqlite}=database();
  sqlite.exec(`INSERT INTO subscriptions(id,user_id,provider_mode,plan_id,billing_interval,price_id,amount_cents,monthly_credits,customer_id,subscription_id,status,current_period_start,current_period_end) VALUES('local','u','test','lite','month','price_lite',1490,550,'cus_test','sub_test','active',${start},${end})`);
  const metadata={app:"migosai",orderId:"local",userId:"u",planId:"lite",billingInterval:"month",priceId:"price_lite",amount:"1490",credits:"550",mode:"test"};
  const sub:any={id:"sub_test",customer:"cus_test",livemode:false,status:"active",metadata,discounts:[],cancel_at_period_end:false,pending_update:null,schedule:null,items:{has_more:false,data:[{id:"si_test",quantity:1,price:price(),current_period_start:start,current_period_end:end}]}};
  const config:any={id:"bpc_change",active:true,livemode:false,features:{subscription_update:{enabled:true,default_allowed_updates:["price"],proration_behavior:"always_invoice",billing_cycle_anchor:"unchanged",schedule_at_period_end:{conditions:[{type:"decreasing_item_amount"},{type:"shortening_interval"}]},products:[{product:"prod_price_standard",prices:["price_standard"]}]}}};
  const env:Env={...jobEnv(db),PAYMENT_PROVIDER:"stripe",STRIPE_MODE:"test",STRIPE_SECRET_KEY:"sk_test_fixture123",STRIPE_WEBHOOK_SECRET:"whsec_fixture123",STRIPE_PRICE_MONTHLY_STANDARD:"price_standard",STRIPE_SUBSCRIPTION_CHANGE_CONFIGURATION:"bpc_change"} as Env;
  const portalRequests:URLSearchParams[]=[];
  const invoices=new Map<string,any>();
  const invoiceLines=new Map<string,any[]>();
  const payments=new Map<string,number>();
  const balances:any[]=[];
  vi.spyOn(globalThis,"fetch").mockImplementation(async (input,init)=>{
    const url=new URL(String(input));
    if(url.origin!=="https://api.stripe.com")throw Error("Unexpected destination");
    if(url.pathname==="/v1/subscriptions/sub_test")return Response.json(sub);
    if(url.pathname==="/v1/customers/cus_test/balance_transactions")return Response.json({has_more:false,data:balances});
    if(url.pathname==="/v1/prices/price_standard")return Response.json(price("price_standard",2990));
    if(url.pathname==="/v1/billing_portal/configurations/bpc_change")return Response.json(config);
    if(url.pathname==="/v1/billing_portal/sessions"){
      portalRequests.push(new URLSearchParams(String(init?.body)));
      return Response.json({customer:"cus_test",configuration:"bpc_change",livemode:false,url:"https://billing.stripe.com/p/session/test"});
    }
    const match=url.pathname.match(/^\/v1\/invoices\/(in_\w+)(\/lines)?$/);
    if(match)return Response.json(match[2]?{has_more:false,data:invoiceLines.get(match[1])}:invoices.get(match[1]));
    if(url.pathname==="/v1/invoice_payments"){
      const id=url.searchParams.get("invoice")!;
      if(payments.get(id)===0)return Response.json({has_more:false,data:[]});
      return Response.json({has_more:false,data:[{id:"inpay_test",invoice:id,livemode:false,status:"paid",currency:"usd",amount_paid:payments.get(id),payment:{type:"payment_intent",payment_intent:`pi_${id}`}}]});
    }
    if(url.pathname.startsWith("/v1/payment_intents/pi_in_")){
      const id=url.pathname.split("/pi_")[1];
      return Response.json({id:`pi_${id}`,customer:"cus_test",livemode:false,status:"succeeded",currency:"usd",amount:payments.get(id),amount_received:payments.get(id)});
    }
    throw Error(`Unexpected Stripe path ${url.pathname}`);
  });
  function addInvoice(id:string,amount:number,reason:string,lines:any[]){
    invoices.set(id,{id,customer:"cus_test",livemode:false,status:"paid",currency:"usd",amount_due:amount,amount_paid:amount,total:amount,subtotal:amount,amount_remaining:0,amount_paid_off_stripe:0,discounts:[],total_discount_amounts:[],billing_reason:reason,parent:{subscription_details:{subscription:"sub_test",metadata}}});
    invoiceLines.set(id,lines);payments.set(id,amount);
  }
  const line=(priceId:string,amount:number,from=start,to=end,proration=false)=>({id:`il_${priceId}`,livemode:false,currency:"usd",quantity:1,amount,subtotal:amount,discount_amounts:[],period:{start:from,end:to},pricing:{price_details:{price:priceId}},parent:{type:"subscription_item_details",subscription_item_details:{subscription:"sub_test",subscription_item:"si_test",proration}}});
  const deliver=(id:string)=>subscriptions.applySubscriptionEvent(env,{id:`evt_${id.replaceAll("_", "")}`,object:"event",livemode:false,type:"invoice.paid",data:{object:{id}}} as any);
  return {db,sqlite,env,sub,config,portalRequests,addInvoice,line,deliver,invoices,payments,balances};
}
afterEach(()=>vi.restoreAllMocks());

describe("existing subscription plan changes",()=>{
  it("opens a selected-price confirmation for the existing item, without buying a second subscription",async()=>{
    const f=fixture();
    const result=await subscriptions.createSubscriptionChange(f.env,"u","local","standard","month","ja");
    expect(result).toEqual({url:"https://billing.stripe.com/p/session/test"});
    const request=f.portalRequests[0];
    expect(request.get("flow_data[type]")).toBe("subscription_update_confirm");
    expect(request.get("flow_data[subscription_update_confirm][subscription]")).toBe("sub_test");
    expect(request.get("flow_data[subscription_update_confirm][items][0][id]")).toBe("si_test");
    expect(request.get("flow_data[subscription_update_confirm][items][0][price]")).toBe("price_standard");
    expect(request.get("flow_data[subscription_update_confirm][items][0][quantity]")).toBe("1");
    expect(request.get("flow_data[after_completion][redirect][return_url]")).toBe("https://example.test/ja/pricing?subscription=updated");
    expect(f.sqlite.prepare("SELECT count(*) n FROM subscriptions").get()).toEqual({n:1});
    expect(f.sqlite.prepare("SELECT count(*) n FROM subscription_plan_prices").get()).toEqual({n:1});
    expect(f.sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()).toEqual({credits:100});
  });
  it.each(["other","missing"])("rejects a stale or foreign subscription identifier %s",async id=>{
    const f=fixture();
    await expect(subscriptions.createSubscriptionChange(f.env,"u",id,"standard","month")).rejects.toMatchObject({status:409});
    expect(f.portalRequests).toHaveLength(0);
  });
  it.each(["past_due","unpaid","canceled"])("does not offer changes for %s",async status=>{
    const f=fixture();f.sub.status=status;
    await expect(subscriptions.createSubscriptionChange(f.env,"u","local","standard","month")).rejects.toMatchObject({status:409});
    expect(f.portalRequests).toHaveLength(0);
  });
  it("rejects quantity, coupon or unsafe proration configuration before returning a portal",async()=>{
    const f=fixture();f.config.features.subscription_update.default_allowed_updates.push("quantity");
    await expect(subscriptions.createSubscriptionChange(f.env,"u","local","standard","month")).rejects.toMatchObject({status:503});
    expect(f.portalRequests).toHaveLength(0);
  });
  it("synchronizes an approved upgrade, grants only paid remaining-period difference, and accepts its later renewal",async()=>{
    const f=fixture();
    f.addInvoice("in_initial",1490,"subscription_create",[f.line("price_lite",1490)]);
    await f.deliver("in_initial");
    await subscriptions.createSubscriptionChange(f.env,"u","local","standard","month");
    f.sub.items.data[0].price=price("price_standard",2990);
    f.sub.latest_invoice="in_change";
    f.addInvoice("in_change",750,"subscription_update",[f.line("price_lite",-745,changedAt,end,true),f.line("price_standard",1495,changedAt,end,true)]);
    expect((await subscriptions.subscriptionStatus(f.env,"u")).subscription).toMatchObject({creditsPending:true});
    await f.deliver("in_change");await f.deliver("in_change");
    expect(f.sqlite.prepare("SELECT granted,remaining FROM subscription_credit_periods").get()).toEqual({granted:850,remaining:850});
    expect((await subscriptions.subscriptionStatus(f.env,"u")).subscription).toMatchObject({planId:"standard",canChange:true,creditsPending:false});
    f.addInvoice("in_renewal",2990,"subscription_cycle",[f.line("price_standard",2990,end,end+30*86400)]);
    await f.deliver("in_renewal");await f.deliver("in_initial");
    expect(f.sqlite.prepare("SELECT monthly_credits FROM subscription_invoices WHERE invoice_id='in_renewal'").get()).toEqual({monthly_credits:1150});
    expect(f.sqlite.prepare("SELECT pack_id,amount,credits FROM orders WHERE provider_order_id='in_renewal'").get()).toEqual({pack_id:"standard",amount:2990,credits:1150});
    expect(f.sqlite.prepare("SELECT plan_id,amount_cents FROM subscriptions").get()).toEqual({plan_id:"lite",amount_cents:1490});
  });
  it("rejects an unapproved changed price before synchronizing or granting credits",async()=>{
    const f=fixture();f.sub.items.data[0].price=price("price_standard",2990);
    await expect(subscriptions.subscriptionStatus(f.env,"u")).rejects.toMatchObject({status:400});
    expect(f.sqlite.prepare("SELECT count(*) n FROM subscription_credit_periods").get()).toEqual({n:0});
  });
  it("rejects an unpaid or short-paid upgrade without modifying credits",async()=>{
    const f=fixture();await subscriptions.createSubscriptionChange(f.env,"u","local","standard","month");
    f.sub.items.data[0].price=price("price_standard",2990);
    f.addInvoice("in_change",750,"subscription_update",[f.line("price_lite",-745,changedAt,end,true),f.line("price_standard",1495,changedAt,end,true)]);
    f.payments.set("in_change",1);
    await expect(f.deliver("in_change")).rejects.toMatchObject({status:400});
    expect(f.sqlite.prepare("SELECT count(*) n FROM subscription_change_invoices").get()).toEqual({n:0});
  });
  it("accepts a fully rounded zero-difference invoice without granting a free allowance",async()=>{
    const f=fixture();
    f.addInvoice("in_initial",1490,"subscription_create",[f.line("price_lite",1490)]);await f.deliver("in_initial");
    await subscriptions.createSubscriptionChange(f.env,"u","local","standard","month");
    f.sub.items.data[0].price=price("price_standard",2990);
    const credit:any=f.line("price_lite",0,end-1,end,true);
    credit.parent.subscription_item_details.proration_details={credited_items:{invoice:"in_initial",invoice_line_items:["il_price_lite"]}};
    f.addInvoice("in_zero",0,"subscription_update",[credit,f.line("price_standard",0,end-1,end,true)]);
    await f.deliver("in_zero");
    expect(f.sqlite.prepare("SELECT granted,remaining FROM subscription_credit_periods").get()).toEqual({granted:550,remaining:550});
    expect(f.sqlite.prepare("SELECT count(*) n FROM subscription_change_invoices").get()).toEqual({n:1});
  });
  it("accepts Stripe's verified small-charge deferral and the subsequent cash renewal that settles it",async()=>{
    const f=fixture();f.addInvoice("in_initial",1490,"subscription_create",[f.line("price_lite",1490)]);await f.deliver("in_initial");
    await subscriptions.createSubscriptionChange(f.env,"u","local","standard","month");f.sub.items.data[0].price=price("price_standard",2990);
    f.addInvoice("in_small",12,"subscription_update",[f.line("price_lite",-12,end-21600,end,true),f.line("price_standard",24,end-21600,end,true)]);
    Object.assign(f.invoices.get("in_small"),{amount_due:0,amount_paid:0,starting_balance:0,ending_balance:12});f.payments.set("in_small",0);
    f.balances.push({id:"cbtxn_small",customer:"cus_test",invoice:"in_small",livemode:false,currency:"usd",amount:12,type:"invoice_too_small",ending_balance:12});
    await f.deliver("in_small");
    expect(f.sqlite.prepare("SELECT remaining FROM subscription_credit_periods").get()).toEqual({remaining:555});
    f.addInvoice("in_renewal",2990,"subscription_cycle",[f.line("price_standard",2990,end,end+30*86400)]);
    Object.assign(f.invoices.get("in_renewal"),{amount_due:3002,amount_paid:3002,starting_balance:12,ending_balance:0});f.payments.set("in_renewal",3002);
    f.balances.push({id:"cbtxn_applied",customer:"cus_test",invoice:"in_renewal",livemode:false,currency:"usd",amount:-12,type:"applied_to_invoice",ending_balance:0});
    await f.deliver("in_renewal");
    expect(f.sqlite.prepare("SELECT monthly_credits FROM subscription_invoices WHERE invoice_id='in_renewal'").get()).toEqual({monthly_credits:1150});
  });
  it("does not accept unpaid amounts disguised as a balance deferral without Stripe's matching transaction",async()=>{
    const f=fixture();await subscriptions.createSubscriptionChange(f.env,"u","local","standard","month");f.sub.items.data[0].price=price("price_standard",2990);
    f.addInvoice("in_small",12,"subscription_update",[f.line("price_lite",-12,end-21600,end,true),f.line("price_standard",24,end-21600,end,true)]);
    Object.assign(f.invoices.get("in_small"),{amount_due:0,amount_paid:0,starting_balance:0,ending_balance:12});f.payments.set("in_small",0);
    await expect(f.deliver("in_small")).rejects.toMatchObject({status:400});
  });
});
