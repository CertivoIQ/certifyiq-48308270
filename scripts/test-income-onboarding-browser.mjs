/** Authorized isolated-account acceptance test. Never signs or edits a real household. */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const base = process.env.TEST_BASE_URL || 'https://certivoiq.com';
assert.equal(base, 'https://certivoiq.com', 'Only the approved public deployment is allowed.');
const url = 'https://emnkzxkcpnyvglwxraxm.supabase.co';
const key = 'sb_publishable_eyrM0tciEkj-rjiADNiRPA_MnNcZv-5';
assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, 'An existing protected server credential is required.');
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const pw = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE || '/tmp/certivoiq-browser/node_modules/playwright/index.mjs')).href);
const out = 'income-onboarding-acceptance'; mkdirSync(out,{recursive:true});
const temp = mkdtempSync(join(process.cwd(),'.acceptance-engine-'));
writeFileSync(join(temp,'engine.mjs'),ts.transpileModule(readFileSync('supabase/functions/_shared/income-calculator-engine.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const e = await import(pathToFileURL(join(temp,'engine.mjs')).href);
const sourceCommit=process.env.RELEASE_COMMIT || process.env.GITHUB_SHA;assert.match(sourceCommit||'',/^[a-f0-9]{40}$/);
const checks=[], accounts=[]; let browser, page, failed=false;
const pass=(name,details={})=>{checks.push({name,passed:true,...details});console.log(`PASS ${name}`);};
const mask=(s)=>{if(process.env.GITHUB_ACTIONS && s)console.log(`::add-mask::${s}`);};
async function poll(fn,label){for(let i=0;i<50;i++){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,300));}throw new Error(`Timed out: ${label}`);}
async function account(){const tag=randomUUID();const email=`certivoiq-acceptance-${tag}@example.com`;const password=`Aa!9${randomBytes(24).toString('base64url')}`;mask(password);
 const r=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{acceptance_test:true},user_metadata:{full_name:'AUTOMATED ACCEPTANCE TEST — NO REAL HOUSEHOLD'}});if(r.error)throw r.error;
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const a={id:r.data.user.id,email,password,client,retained:false};accounts.push(a);
 const auth=await client.auth.signInWithPassword({email,password});if(auth.error)throw auth.error;mask(auth.data.session.access_token);mask(auth.data.session.refresh_token);a.accessToken=auth.data.session.access_token;return a;
}
async function api(a,body,expected=200){const r=await fetch(`${url}/functions/v1/income-calculator`,{method:'POST',headers:{apikey:key,'content-type':'application/json',...(a?{authorization:`Bearer ${a.accessToken}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const j=await r.json();assert.equal(r.status,expected,`Calculator ${body.action}: ${j.error||r.status}`);return j;}
async function ownedSelect(a,table){const {data,error}=await a.client.from(table).select('*').eq('user_id',a.id);if(error)throw error;return data;}
async function openCalculator(a,property,unit,tenant){await page.goto(`${base}/income-calculator`);await page.getByLabel('Property',{exact:true}).selectOption(property.id);await page.getByLabel('Unit',{exact:true}).selectOption(unit.id);await page.getByLabel('Household',{exact:true}).selectOption(tenant.id);await page.getByRole('button',{name:'Save calculation',exact:true}).waitFor();await poll(()=>page.getByRole('button',{name:'Save calculation',exact:true}).isEnabled(),'calculator configuration');}
try {
 const marker=`/assets/income-calculator-release-${sourceCommit}.json`;
 // The checked-out release must be the one actually served, before any test records are created.
 const live=await fetch(base+marker,{signal:AbortSignal.timeout(30000)});
 assert.equal(live.status,200);assert.equal((await live.json()).sourceCommit,sourceCommit);pass('Public deployment identity matches checked-out commit');
 await api(null,{action:'metadata'},401);pass('Anonymous calculator access rejected');
 const owner=await account();const stranger=await account();
 browser=await pw.chromium.launch({headless:true});const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30000);page.on('dialog',d=>d.accept());
 await page.goto(`${base}/launchpad`);await page.getByLabel('Work email',{exact:true}).fill(owner.email);await page.getByLabel('Password',{exact:true}).fill(owner.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByText('Step 1 of 6',{exact:true}).waitFor();pass('Real browser sign-in reaches the six-step checklist');
 await page.getByRole('button',{name:'Start setup',exact:true}).click();await page.getByText('Step 2 of 6',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Verify saved profile & continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'Save a valid organization'}).waitFor();pass('Unsaved organization cannot skip step two');
 await page.getByRole('link',{name:'Open setup workspace',exact:true}).click();await page.getByRole('button',{name:'LIHTC',exact:true}).click();
 // A failed request must keep edits and re-enable retry rather than freezing progress.
 await page.route('**/rest/v1/customer_workspace_profiles*',async route=>{if(['POST','PATCH'].includes(route.request().method())){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic test outage'})});}else await route.continue();});
 await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'could not be saved'}).waitFor();assert.equal(await page.getByRole('button',{name:'Save profile & continue',exact:true}).isEnabled(),true);assert.equal(await page.getByRole('button',{name:'LIHTC',exact:true}).getAttribute('aria-pressed'),'true');
 await page.unroute('**/rest/v1/customer_workspace_profiles*');pass('Failed profile save preserves selection and releases the retry button');
 await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();await page.getByText('Step 3 of 6',{exact:true}).waitFor();await page.reload();await page.getByText('Step 3 of 6',{exact:true}).waitFor();
 const progress=await ownedSelect(owner,'customer_onboarding_progress');assert.deepEqual(progress[0].completed_steps,[1,2]);assert.equal(progress[0].current_step,3);pass('Profile save advances step 2 to step 3 and survives a browser reload');
 await page.getByRole('button',{name:'Verify portfolio onboarding',exact:true}).click();await page.getByRole('alert').filter({hasText:'At least one property, unit, and tenant profile'}).waitFor();pass('Empty portfolio still cannot skip its onboarding requirement');
 await page.getByRole('link',{name:'Open setup workspace',exact:true}).click();
 const csv='property_external_id,property_name,state,unit_external_id,unit_number,tenant_external_id,household_name,certification_type,certification_effective_date,program_codes\nTEST-P,TEST ONLY - Acceptance Property,TN,TEST-U,TEST-1,TEST-H,TEST ONLY - Synthetic Household,INITIAL,2026-09-05,LIHTC\n';
 await page.locator('input[type=file]').setInputFiles({name:'TEST-ONLY-acceptance-onboarding.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});const importButton=page.getByRole('button',{name:'Import onboarding records',exact:true}),confirmation=page.getByRole('checkbox',{name:/I have reviewed the field matches/});await poll(()=>confirmation.isEnabled(),'valid onboarding mapping preview');assert.equal(await importButton.isEnabled(),false);await confirmation.check();await poll(()=>importButton.isEnabled(),'confirmed onboarding import');await importButton.click();await page.getByRole('status').filter({hasText:'Created or updated 1 properties, 1 units, and 1 tenant profiles'}).waitFor();
 const [property]=await ownedSelect(owner,'portfolio_properties'),[unit]=await ownedSelect(owner,'portfolio_units'),[tenant]=await ownedSelect(owner,'portfolio_tenant_profiles');assert.ok(property&&unit&&tenant);pass('Authenticated CSV onboarding creates the test property, unit, and tenant');
 await page.goto(`${base}/launchpad`);await page.getByRole('button',{name:'Verify portfolio onboarding',exact:true}).click();await page.getByText('Step 4 of 6',{exact:true}).waitFor();await page.getByRole('button',{name:'Verify certification upload',exact:true}).click();await page.getByRole('alert').filter({hasText:'Upload at least one certification'}).waitFor();pass('Portfolio completion advances to step 4; missing certification remains blocked');
 const profile={...e.newProfile('LIHTC'),agency:'TEST ONLY - synthetic agency',implementation:'HOTMA',effectiveFrom:'2026-01-01',effectiveTo:'2027-12-31',policyVersion:'TEST ONLY - NOT A PROPERTY POLICY',policySource:'Synthetic acceptance fixture only',evidencePolicy:'Synthetic fixture, not resident evidence',minEvidenceMonths:'2',designation:'TEST ONLY',geography:'Synthetic geography',limitSource:'FICTITIOUS TEST LIMIT - NOT FOR ELIGIBILITY',limitFrom:'2026-01-01',limitTo:'2027-12-31',limits:{'2':'50000'}};
 const approval={name:'AUTOMATED TEST ONLY',position:'Isolated acceptance test runner',signature:'TEST SIGNATURE - NO REAL HOUSEHOLD',consent:true};
 const calculatorAccess=await owner.client.rpc('income_calculator_access');if(calculatorAccess.error)throw calculatorAccess.error;
 const accessMode=calculatorAccess.data?.mode;
 if(accessMode==='trial'){
  const trialPersistence=await api(owner,{action:'save_profile',propertyId:property.id,unitId:unit.id,profile,approval},403);
  assert.match(trialPersistence.error||'',/platform subscription is required/i);pass('Trial calculator remains usable but portfolio persistence stays subscription-gated');
 } else if(accessMode!=='paid'){
  throw new Error(`Unexpected calculator access mode for acceptance fixture: ${accessMode||'missing'}`);
 }
 if(accessMode==='paid'){
  await api(owner,{action:'save_profile',propertyId:property.id,unitId:unit.id,profile,approval});owner.retained=true;
 const layer={...e.newLayer('LIHTC'),evidenceMonths:'3',evidenceSource:'Synthetic reviewed fixture only',evidenceReviewed:true,treatmentReviewed:true,assetsReviewed:true,reconciliationReviewed:true};
 const input={...e.newInput(),tenantId:tenant.id,propertyId:property.id,unitId:unit.id,effectiveDate:'2026-09-05',certificationType:'INITIAL',householdSize:'2',subsidy:'NONE',householdReviewed:true,changesReviewed:true,jobs:[{...e.newJob('test-job'),member:'Synthetic member',employer:'Synthetic employer',rate:'20',hours:'40',source:'Synthetic hourly verification',reviewed:true}],layers:[layer]};
 const draft=await api(owner,{action:'save_snapshot',input,calculation:{annualIncome:'1'}});assert.equal(draft.calculation.results[0].annualIncome,'41600.00');assert.equal(draft.calculation.reviewable,true);pass('Authenticated backend recalculates $20 × 40 × 52 = $41,600 and ignores submitted totals');
 await openCalculator(owner,property,unit,tenant);await page.getByRole('button',{name:'6. Results & Review',exact:true}).click();await page.getByRole('button',{name:'Open version',exact:true}).first().click();await page.getByText(draft.content_hash,{exact:true}).waitFor();
 await page.getByRole('button',{name:'Save calculation',exact:true}).click();const second=await poll(async()=>{const r=await ownedSelect(owner,'income_calculator_snapshots');return r.find(s=>s.id!==draft.id);},'UI-created snapshot');assert.equal(second.calculation.results[0].annualIncome,'41600.00');pass('Browser opens a stored draft and saves a new server-calculated immutable version');
 await page.getByLabel('Responsible party name',{exact:true}).fill(approval.name);await page.getByLabel('Position',{exact:true}).fill(approval.position);await page.getByLabel('Typed signature',{exact:true}).fill(approval.signature);await page.getByRole('checkbox',{name:/I am the responsible party/}).check();await page.getByRole('button',{name:'Record final review',exact:true}).click();await page.getByText('Final review recorded',{exact:true}).waitFor();
 const signed=await api(owner,{action:'load_snapshot',snapshotId:second.id});assert.equal(signed.review.snapshot_hash,second.content_hash);assert.equal(signed.review.signature,approval.signature);assert.ok(signed.review.reviewed_at);pass('Browser final review persists test name, position, signature, timestamp, and matching snapshot hash');
 await page.reload();await openCalculator(owner,property,unit,tenant);await page.getByRole('button',{name:'6. Results & Review',exact:true}).click();await page.getByRole('button',{name:'Open version',exact:true}).first().click();await page.getByText('Final review recorded',{exact:true}).waitFor();pass('Signed snapshot reloads after a full browser refresh');
 await page.getByRole('button',{name:'2. Jobs & Pay',exact:true}).click();await page.getByLabel('Regular hourly rate ($)',{exact:true}).fill('21');await page.getByRole('button',{name:'Save calculation',exact:true}).click();await page.getByText('Pending Final Review',{exact:true}).first().waitFor();assert.equal(await page.getByRole('button',{name:'Record final review',exact:true}).isEnabled(),false);
 const preserved=await api(owner,{action:'load_snapshot',snapshotId:second.id});assert.equal(preserved.snapshot.inputs.jobs[0].rate,'20');assert.equal(preserved.review.snapshot_hash,second.content_hash);pass('Editing clears approval and requires new review while the signed original remains unchanged');
 for(const action of ['load_snapshot','sign_snapshot'])await api(stranger,{action,snapshotId:second.id,approval},422);
 await api(stranger,{action:'load',tenantId:tenant.id,effectiveDate:'2026-09-05'},422);pass('A different authenticated account cannot read or sign the owner test records');
 const tamper=await owner.client.from('income_calculator_snapshots').update({engine_version:'tampered-test'}).eq('id',second.id);assert.ok(tamper.error);const privileged=await admin.from('income_calculator_snapshots').update({engine_version:'tampered-test'}).eq('id',second.id);assert.ok(privileged.error);pass('Snapshot mutation is blocked for the authenticated owner and server role');
 await page.screenshot({path:join(out,'synthetic-pending-review.png'),fullPage:true});
 } else {
  pass('Paid portfolio persistence browser path not exercised by the isolated trial fixture',{skipped:true});
 }
} catch(error) {
 failed=true;checks.push({name:'Acceptance failure',passed:false,error:error.message});console.error(`FAIL ${error.message}`);
 if(page) {await page.screenshot({path:join(out,'synthetic-failure.png'),fullPage:true}).catch(()=>{});writeFileSync(join(out,'page-text.txt'),await page.locator('body').innerText().catch(()=>''));}
} finally {
 if(browser)await browser.close();
 for(const a of accounts){try{
  if(a.accessToken){const signedOut=await admin.auth.admin.signOut(a.accessToken,'global');if(signedOut.error)throw signedOut.error;}
  const ban=await admin.auth.admin.updateUserById(a.id,{ban_duration:'876000h'});if(ban.error)throw ban.error;
  if(!a.retained){const removed=await admin.auth.admin.deleteUser(a.id);if(removed.error)throw removed.error;}
  checks.push({name:'Test account cleanup',passed:true,userId:a.id,retainedDisabledForImmutableAudit:a.retained,sessionsRevoked:true});
 }catch(error){failed=true;checks.push({name:'Test account cleanup',passed:false,userId:a.id,error:error.message});}}
 rmSync(temp,{recursive:true,force:true});
 writeFileSync(join(out,'acceptance.json'),JSON.stringify({sourceCommit,baseUrl:base,syntheticAccountsOnly:true,realHouseholdSigned:false,checks,passed:!failed,verifiedAt:new Date().toISOString()},null,2));
}
process.exitCode=failed?1:0;
