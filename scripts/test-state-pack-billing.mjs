import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,require=()=>{throw new Error('Unexpected dependency');}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,process:{env:{SUPABASE_URL:'fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture'}},Date,Set});
  return exports;
}
const pricing=load('src/lib/state-pack-proration.ts');
test('proration uses actual annual seconds and preserves cents',()=>{
  const start=Date.parse('2026-01-01')/1000,end=Date.parse('2027-01-01')/1000;
  assert.equal(pricing.statePackProration(start,end,start).amountCents,6500000);
  assert.equal(pricing.statePackProration(start,end,(start+end)/2).amountCents,3250000);
  const leapStart=Date.parse('2024-01-01')/1000,leapEnd=Date.parse('2025-01-01')/1000;
  assert.equal(pricing.statePackProration(leapStart,leapEnd,(leapStart+leapEnd)/2).amountCents,3250000);
  assert.throws(()=>pricing.statePackProration(start,start+30*86400,start),/annual/);
  assert.throws(()=>pricing.statePackProration(start,end,end),/active/);
  assert.throws(()=>pricing.statePackProration(start,end,start-1),/active/);
});
function fixture(results,stripe) {
  let clientCalls=0,rpcCalls=0;
  const db={from:()=>{
    const query={};for(const key of ['select','eq','in','lte','order','update','is'])query[key]=()=>query;
    query.single=query.maybeSingle=async()=>results.shift();
    query.then=(ok,bad)=>Promise.resolve(results.shift()).then(ok,bad);
    return query;
  },rpc:async()=>{rpcCalls++;return {error:null};}};
  const service=load('src/lib/state-pack-billing.server.ts',name=>{
    if(name==='@supabase/supabase-js')return {createClient:()=>db};
    if(name==='./stripe.server')return {createStripeClient:()=>{clientCalls++;return stripe;}};
    if(name==='./state-pack-proration')return pricing;
    throw new Error(name);
  });
  return {service,clientCalls:()=>clientCalls,rpcCalls:()=>rpcCalls};
}
test('non-admin membership fails before any Stripe call',async()=>{
  const f=fixture([{data:null,error:null}],{});
  await assert.rejects(()=>f.service.stateBillingAccount('customer','license','live'),/administrator/);
  assert.equal(f.clientCalls(),0);
});
test('wrong Stripe customer cannot purchase against another contract',async()=>{
  const f=fixture([{data:{license_id:'license'},error:null},{data:{license_kind:'multifamily_enterprise',status:'active',paid_through:new Date(Date.now()+86400000).toISOString(),stripe_schedule_id:'schedule',stripe_customer_id:'cus_correct'},error:null}],{subscriptionSchedules:{retrieve:async()=>({customer:'cus_wrong',livemode:true,status:'active'})}});
  await assert.rejects(()=>f.service.stateBillingAccount('admin','license','live'),/verified/);
});
test('unsettled bank payment cannot activate a pack',async()=>{
  const f=fixture([],{checkout:{sessions:{retrieve:async()=>({metadata:{purchase_type:'enterprise_state_pack'},mode:'payment',payment_status:'unpaid'})}}});
  assert.equal(await f.service.fulfillStateCheckout('cs_fixture','live'),false);
  assert.equal(f.rpcCalls(),0);
});
test('paid checkout must match environment before fulfillment',async()=>{
  const f=fixture([],{checkout:{sessions:{retrieve:async()=>({metadata:{purchase_type:'enterprise_state_pack'},mode:'payment',payment_status:'paid',livemode:false,currency:'usd'})}}});
  await assert.rejects(()=>f.service.fulfillStateCheckout('cs_fixture','live'),/environment/);
  assert.equal(f.rpcCalls(),0);
});
test('a newer suspended release overrides an older validated release',async()=>{
  const f=fixture([{data:[{state_code:'CA',status:'suspended'},{state_code:'CA',status:'validated',approved_at:'date',failed_fixture_count:0,unresolved_conflict_count:0,validated_rule_count:3},{state_code:'FL',status:'validated',approved_at:'date',failed_fixture_count:0,unresolved_conflict_count:0,validated_rule_count:3}],error:null}],{});
  assert.deepEqual(Array.from(await f.service.availableStatePacks()),['FL']);
});
