import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('src/routes/auth.tsx','utf8');
const start=source.indexOf('function afterAuthTarget('),end=source.indexOf('\nfunction isFreeReviewReturn',start);
assert.ok(start>=0&&end>start);
function fixture(saved){
  let value=saved,removals=0;
  const sessionStorage={getItem:key=>{assert.equal(key,'certivoiq:after-auth');return value;},removeItem:key=>{assert.equal(key,'certivoiq:after-auth');value=null;removals++;}};
  const exports={};
  const code=ts.transpileModule(source.slice(start,end)+'\nexport { afterAuthTarget };',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{exports,sessionStorage});
  return {read:exports.afterAuthTarget,stored:()=>value,removals:()=>removals};
}
for(const target of ['/launchpad','/pricing','/trial'])test(`pre-authentication inspection preserves ${target}`,()=>{
  const f=fixture(target);assert.equal(f.read(),target);assert.equal(f.read(),target);assert.equal(f.stored(),target);assert.equal(f.removals(),0);
  assert.equal(f.read(true),target);assert.equal(f.stored(),null);assert.equal(f.removals(),1);assert.equal(f.read(),'/dashboard');
});
for(const target of [null,'https://example.com','//example.com','/unapproved'])test(`unapproved return destination is not followed: ${target}`,()=>{assert.equal(fixture(target).read(),'/dashboard');});
test('session and MFA checks precede successful return consumption',()=>{
  const effect=source.slice(source.indexOf('  useEffect(() => {'),source.indexOf('  async function proceedAfterMfa'));
  assert.ok(effect.indexOf('!sessionData.session')<effect.indexOf('afterAuthTarget(true)'));
  assert.ok(effect.indexOf('aalData?.currentLevel !== "aal2"')<effect.indexOf('afterAuthTarget(true)'));
  assert.match(effect,/const target = isFreeReviewReturn\(\) \? "\/trial" : afterAuthTarget\(\)/);
});
