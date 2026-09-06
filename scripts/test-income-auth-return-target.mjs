import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('src/routes/auth.tsx','utf8');
const pure=source.slice(source.indexOf('function afterAuthTarget'),source.indexOf('function isFreeReviewReturn'));
const js=ts.transpileModule(pure,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function target(initial){let value=initial;let removed=0;const context={sessionStorage:{getItem:()=>value,removeItem:()=>{value=null;removed++}}};vm.createContext(context);return {take:()=>vm.runInContext(js+'\nafterAuthTarget()',context),read:()=>value,removed:()=>removed};}
for(const path of ['/launchpad','/pricing','/trial'])test(`Stored safe destination survives until authenticated continuation: ${path}`,()=>{const s=target(path);assert.equal(s.read(),path);assert.equal(s.take(),path);assert.equal(s.read(),null);assert.equal(s.removed(),1);assert.equal(s.take(),'/dashboard');});
test('Unsupported and external destinations are never trusted',()=>{for(const path of ['https://example.com','//example.com','javascript:alert(1)','/admin',null])assert.equal(target(path).take(),'/dashboard');});
test('Initial session check preserves return intent until session and MFA checks pass',()=>{const mount=source.slice(source.indexOf('  useEffect(() => {'),source.indexOf('  async function proceedAfterMfa'));const take=mount.indexOf('afterAuthTarget()');assert.ok(take>mount.indexOf('if (cancelled || !sessionData.session) return;'));assert.ok(take>mount.indexOf('aalData?.currentLevel'));assert.ok(take>mount.indexOf('setMfaMode(true)'));assert.equal((mount.match(/afterAuthTarget\(\)/g)||[]).length,1);});
test('Password and MFA continuation still enforce their normal authentication checks',()=>{assert.match(source,/signInWithPassword/);assert.match(source,/if \(!data\.user\) throw/);assert.match(source,/if \(verified\) \{ setMfaFactorId/);assert.match(source,/if \(data\.session\) navigate/);assert.match(source,/challengeAndVerify/);});
