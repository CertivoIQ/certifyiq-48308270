import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const modules = new Map();
function moduleUrl(name) {
  if (modules.has(name)) return modules.get(name);
  let code = ts.transpileModule(readFileSync(new URL('../src/lib/'+name+'.ts', import.meta.url),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  code = code.replace(/from ["']@\/lib\/([^"']+)["']/g, (_, dependency) => `from ${JSON.stringify(moduleUrl(dependency))}`);
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  modules.set(name,url); return url;
}
const { hasFounderTrainingAccess } = await import(moduleUrl('founder-training-access'));
const { loadState } = await import(moduleUrl('entitlements.server'));
const access = {plan_id:'founder_internal',status:'active',access_until:null};
const db = account => ({from(table) { const q = {select(){return q},eq(){return q},maybeSingle:async()=>({data:table==='account_access'?account:null}),order:async()=>({data:[]})}; return q; }});
test('only an active, unexpired managed founder grant qualifies',()=>{
  assert.equal(hasFounderTrainingAccess(access),true);
  for (const row of [null,{}, {...access,plan_id:'free'}, {...access,status:'canceled'}, {...access,access_until:'2000-01-01'}, {...access,access_until:'invalid'}]) assert.equal(hasFounderTrainingAccess(row),false);
});
test('founder training has full portfolio and review capacity in both environments, independent of role',async()=>{
  for (const environment of ['live','sandbox']) {
    const result = await loadState(db(access),'founder',environment);
    assert.equal(result.planId,'founder_internal'); assert.equal(result.planName,'Founder training access');
    assert.equal(result.isTrial,false); assert.equal(result.priceId,null);
    assert.deepEqual(result.limits,{units:null,properties:null,aiDocs:null});
  }
});
test('ordinary free access and revoked founder grants do not gain capacity',async()=>{
  const free=await loadState(db({status:'trialing'}),'ordinary','live');
  assert.equal(free.isTrial,true);assert.deepEqual(free.limits,{units:0,properties:0,aiDocs:3});
  for(const row of [{...access,status:'canceled'},{...access,access_until:'2000-01-01'}]) {
    const result=await loadState(db(row),'founder','live');
    assert.equal(result.planId,null);assert.deepEqual(result.limits,{units:0,properties:0,aiDocs:0});
  }
});
