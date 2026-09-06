import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'certivoiq-income-test-'));
const tsc = process.env.TSC || (process.env.CI ? resolve('node_modules/.bin/tsc') : 'tsc');
execFileSync(tsc, ['supabase/functions/_shared/income-calculator-engine.ts','--target','ES2022','--module','ES2022','--outDir',dir,'--strict','--noUncheckedIndexedAccess','--noPropertyAccessFromIndexSignature','--exactOptionalPropertyTypes','--noImplicitReturns','--skipLibCheck'], {stdio:'inherit'});
const e = await import(pathToFileURL(join(dir, 'income-calculator-engine.js')).href);
process.on('exit', () => rmSync(dir,{recursive:true,force:true}));
const profile = (program='LIHTC', patch={}) => ({id:`profile-${program}`,createdAt:'2026-09-01T00:00:00Z',profile:{...e.newProfile(program),agency:'Synthetic test agency',implementation:'HOTMA',effectiveFrom:'2026-01-01',effectiveTo:'2027-12-31',policyVersion:'TEST-NOT-A-LIVE-POLICY',policySource:'Synthetic policy fixture',evidencePolicy:'Synthetic evidence fixture',minEvidenceMonths:'2',designation:'Synthetic designation',geography:'Synthetic geography',limitSource:'Synthetic limit fixture',limitFrom:'2026-01-01',limitTo:'2027-12-31',limits:{'2':'50000'},...patch}});
const line = (id,amount) => ({...e.newLine(id),member:'Synthetic member',label:id,amount,source:'Synthetic evidence',reviewed:true});
const layer = (program) => ({...e.newLayer(program),evidenceMonths:'3',evidenceSource:'Synthetic reviewed documents',evidenceReviewed:true,treatmentReviewed:true,assetsReviewed:true,reconciliationReviewed:true});
const input = (programs=['LIHTC']) => ({...e.newInput(),tenantId:'synthetic-tenant',propertyId:'synthetic-property',unitId:'synthetic-unit',effectiveDate:'2026-09-05',householdSize:'2',subsidy:'NONE',householdReviewed:true,changesReviewed:true,jobs:[{...e.newJob('job-1'),member:'Synthetic member',employer:'Synthetic employer',rate:'20',hours:'40',source:'Synthetic employment verification',reviewed:true}],history:e.historyPeriods('2026-09-05').map((h)=>({...h,amount:'3000',source:'Synthetic historical source',reviewed:true})),layers:programs.map(layer)});
const first = (i,ps=[profile()]) => e.evaluate(i,ps).results[0];
const stub = (id,start,end,gross='800') => ({...e.newStub(id),start,end,gross,source:'Synthetic pay statement',reviewed:true,completePeriod:true});
const routing = [
 ['LIHTC','INITIAL','HOTMA','PART5','AUTO','NONE','PROJECTED'],
 ['LIHTC','ANNUAL','LEGACY','PART5','AUTO','NONE','PROJECTED'],
 ['HUD_MF','INITIAL','HOTMA','PART5','AUTO','NONE','PROJECTED'],
 ['HUD_MF','INTERIM','HOTMA','PART5','AUTO','NONE','PROJECTED'],
 ['HUD_MF','ANNUAL','HOTMA','PART5','AUTO','NONE','HISTORICAL'],
 ['HUD_MF','ANNUAL','LEGACY','PART5','AUTO','NONE','PROJECTED'],
 ['HCV','ANNUAL','HOTMA','PART5','AUTO','NONE','HISTORICAL'],
 ['HCV','INITIAL','HOTMA','PART5','AUTO','NONE','PROJECTED'],
 ['PBV','ANNUAL','HOTMA','PART5','AUTO','NONE','HISTORICAL'],
 ['PBV','INTERIM','HOTMA','PART5','AUTO','NONE','PROJECTED'],
 ['PUBLIC_HOUSING','ANNUAL','HOTMA','PART5','AUTO','NONE','HISTORICAL'],
 ['PUBLIC_HOUSING','INITIAL','HOTMA','PART5','AUTO','NONE','PROJECTED'],
 ['HOME','INITIAL','LEGACY','PART5','AUTO','NONE','PROJECTED'],
 ['HOME','ANNUAL','HOTMA','IRS_AGI','AUTO','NONE','IRS_AGI'],
 ['HOME','ANNUAL','HOTMA','PART5','ACCEPTED','NONE','ACCEPTED'],
 ['HTF','INITIAL','HOTMA','PART5','AUTO','NONE','PROJECTED'],
 ['HTF','INITIAL','HOTMA','IRS_AGI','AUTO','NONE','IRS_AGI'],
 ['HTF','INITIAL','HOTMA','PART5','AUTO','PUBLIC_HOUSING','ACCEPTED'],
 ['HTF','INITIAL','HOTMA','PART5','AUTO','FEDERAL_TENANT_BASED','ACCEPTED'],
 ['HTF','INITIAL','HOTMA','PART5','AUTO','FEDERAL_STATE_PROJECT_BASED','ACCEPTED'],
 ['HTF','INITIAL','HOTMA','PART5','AUTO','UNKNOWN','NOT_DETERMINED'],
 ['RD','INITIAL','LEGACY','RD_ADJUSTED','AUTO','NONE','RD_ADJUSTED'],
 ['BOND','INITIAL','LEGACY','MANUAL','MANUAL','NONE','MANUAL'],
 ['STATE_LOCAL','INITIAL','LEGACY','MANUAL','MANUAL','NONE','MANUAL'],
 ['UNKNOWN_PROGRAM','ANNUAL','LEGACY','MANUAL','AUTO','NONE','MANUAL'],
 ['HCV','ANNUAL','UNRESOLVED','PART5','AUTO','NONE','NOT_DETERMINED'],
 ['HCV','ANNUAL','SPECIAL','PART5','AUTO','NONE','MANUAL'],
 ['HUD_MF','ANNUAL','HOTMA','PART5','STREAMLINED','NONE','MANUAL'],
 ['LIHTC','OTHER','HOTMA','PART5','AUTO','NONE','MANUAL'],
];
for (const [program,certificationType,implementation,definition,method,subsidy,expected] of routing) test(`routing: ${program} ${certificationType} ${implementation} ${definition} ${method} ${subsidy}`,()=>assert.equal(e.selectRoute(profile(program,{implementation,definition,method}).profile,{certificationType,subsidy}),expected));
test('blank live record does not report a determination',()=>{const r=e.evaluate(e.newInput(),[]);assert.equal(r.reviewable,false);assert.deepEqual(r.results,[]);assert.equal(r.status,'Pending Final Review');});
test('hourly weekly projection',()=>{const r=first(input());assert.equal(r.annualIncome,'41600.00');assert.equal(r.difference,'-8400.00');assert.equal(r.comparison,'AT_OR_BELOW_LIMIT');});
test('exact six-decimal rates retained until final result',()=>{const i=input();i.jobs[0].rate='23.457891';i.jobs[0].hours='37.5';assert.equal(first(i).annualIncome,'45742.89');});
test('overtime uses its actual entered rate',()=>{const i=input();Object.assign(i.jobs[0],{overtimeRate:'31.75',overtimeHours:'5'});assert.equal(first(i).annualIncome,'49855.00');});
test('multiple jobs are distinct income sources',()=>{const i=input();i.jobs.push({...i.jobs[0],id:'job-2',employer:'Second synthetic employer',rate:'10',hours:'5'});assert.equal(first(i).annualIncome,'44200.00');});
for(const [frequency,multiplier] of Object.entries(e.FREQUENCIES)) test(`pay-period annualization: ${frequency}`,()=>{const i=input();Object.assign(i.jobs[0],{mode:'PAY_PERIOD',gross:'1000',frequency});assert.equal(first(i).annualIncome,`${1000*multiplier}.00`);});
test('hourly and gross fields do not double count',()=>{const i=input();i.jobs[0].gross='800';i.jobs[0].stubs=[{...stub('s1','2026-08-01','2026-08-07'),rate:'20',hours:'40',overtimeRate:'0',overtimeHours:'0',extras:'0'}];assert.equal(first(i).annualIncome,'41600.00');});
test('stub-average chooses one annualization basis',()=>{const i=input();Object.assign(i.jobs[0],{mode:'STUB_AVERAGE',stubs:[stub('s1','2026-08-01','2026-08-07','700'),stub('s2','2026-08-08','2026-08-14','900')]});assert.equal(first(i).annualIncome,'41600.00');});
test('partial-year schedule and net expected change',()=>{const i=input();Object.assign(i.jobs[0],{weeks:'26',adjustment:'500',changeSource:'Synthetic documented increase'});assert.equal(first(i).annualIncome,'21300.00');});
test('duplicate job IDs fail closed',()=>{const i=input();i.jobs.push({...i.jobs[0]});assert.equal(first(i).comparison,'NOT_DETERMINED');});
test('duplicate/overlapping pay statements fail closed',()=>{const i=input();i.jobs[0].stubs=[stub('s1','2026-08-01','2026-08-07'),stub('s2','2026-08-07','2026-08-14')];assert.match(first(i).issues.join(' '),/overlapping/);assert.equal(first(i).annualIncome,null);});
test('incomplete average period fails closed',()=>{const i=input();Object.assign(i.jobs[0],{mode:'STUB_AVERAGE',stubs:[{...stub('s','2026-08-01','2026-08-07'),completePeriod:false}]});assert.equal(first(i).comparison,'NOT_DETERMINED');});
test('unexplained gross/hour discrepancy fails closed',()=>{const i=input();i.jobs[0].stubs=[{...stub('s','2026-08-01','2026-08-07','950'),rate:'20',hours:'40',overtimeRate:'0',overtimeHours:'0',extras:'0'}];assert.match(first(i).issues.join(' '),/reconcile/);i.jobs[0].stubs[0].discrepancyReason='Synthetic verified bonus not included in schedule';assert.equal(first(i).comparison,'AT_OR_BELOW_LIMIT');});
for(const value of ['', 'NaN','Infinity','20,00','-20','1e3','20.1234567']) test(`invalid wage amount is not silently zero: ${JSON.stringify(value)}`,()=>{const i=input();i.jobs[0].rate=value;assert.equal(first(i).annualIncome,null);assert.equal(first(i).comparison,'NOT_DETERMINED');});
test('zero income is explicit, reviewed, and legitimate',()=>{const i=input();i.jobs[0].rate='0';assert.equal(first(i).annualIncome,'0.00');});
test('impossible weekly hours blocked',()=>{const i=input();i.jobs[0].hours='169';assert.equal(first(i).comparison,'NOT_DETERMINED');});
test('historical route ignores unrelated prospective wages and uses 12 months',()=>{const i=input(['HUD_MF']);i.certificationType='ANNUAL';i.jobs[0].rate='';assert.equal(first(i,[profile('HUD_MF')]).annualIncome,'36000.00');assert.equal(first(i,[profile('HUD_MF')]).comparison,'AT_OR_BELOW_LIMIT');});
test('historical reconciliation plus anticipated asset income',()=>{const i=input(['HUD_MF']);i.certificationType='ANNUAL';i.historyAdjustments=[line('net-reconciliation','-1000')];i.assets=[line('annual-asset-income','200')];assert.equal(first(i,[profile('HUD_MF')]).annualIncome,'35200.00');});
test('three months cannot substitute for annual historical route',()=>{const i=input(['HCV']);i.certificationType='ANNUAL';i.history=i.history.slice(0,3);assert.equal(first(i,[profile('HCV')]).annualIncome,null);});
test('historical dates are contiguous across leap and month-end dates',()=>{for(const date of ['2024-02-29','2025-03-31','2026-09-05']) {const h=e.historyPeriods(date);assert.equal(h.length,12);for(let n=1;n<h.length;n++)assert.equal((Date.parse(h[n].start)-Date.parse(h[n-1].end))/86400000,1);assert.equal((Date.parse(date)-Date.parse(h[11].end))/86400000,1);}});
test('program-specific exclusions do not leak into other layers',()=>{const i=input(['LIHTC','HOME','RD','HUD_MF']);i.layers[1].adjustments=[line('HOME-exclusion','-1000')];i.layers[2].deductions=[line('RD-deduction','2500')];const r=e.evaluate(i,i.layers.map((l)=>profile(l.program)));assert.deepEqual(r.results.map((x)=>x.annualIncome),['41600.00','40600.00','39100.00','41600.00']);assert.ok(r.reviewable);});
test('RD adjusted income has zero floor',()=>{const i=input(['RD']);i.layers[0].deductions=[line('verified-deduction','50000')];assert.equal(first(i,[profile('RD')]).annualIncome,'0.00');});
test('RD deductions cannot be applied to LIHTC',()=>{const i=input();i.layers[0].deductions=[line('wrong-deduction','500')];assert.equal(first(i).comparison,'NOT_DETERMINED');});
test('AGI uses distinct documented annual components',()=>{const i=input(['HOME']);i.layers[0].agi=[line('annual-AGI-income','40000'),line('AGI-adjustment','-5000')];assert.equal(first(i,[profile('HOME',{definition:'IRS_AGI'})]).annualIncome,'35000.00');});
test('HTF accepted determination is not recomputed or adjusted',()=>{const i=input(['HTF']);i.subsidy='PUBLIC_HOUSING';Object.assign(i.layers[0],{finalAmount:'31500',authority:'Synthetic determining provider / rule',determinationDate:'2026-08-01',validThrough:'2027-08-01',determinationSource:'Synthetic provider determination',determinationReviewed:true});let r=first(i,[profile('HTF')]);assert.equal(r.annualIncome,'31500.00');assert.equal(r.route,'ACCEPTED');i.layers[0].adjustments=[line('invalid-independent-adjustment','-1000')];assert.equal(first(i,[profile('HTF')]).comparison,'NOT_DETERMINED');});
test('missing approval/evidence/limit does not produce a determination',()=>{const i=input();assert.equal(first(i,[]).comparison,'NOT_DETERMINED');i.layers[0].evidenceReviewed=false;assert.equal(first(i).comparison,'NOT_DETERMINED');i.layers[0].evidenceReviewed=true;assert.equal(first(i,[profile('LIHTC',{limits:{'1':'40000'}})]).comparison,'NOT_DETERMINED');});
test('out-of-date policy and limits block determination',()=>{const i=input();assert.equal(first(i,[profile('LIHTC',{effectiveTo:'2026-08-31'})]).comparison,'NOT_DETERMINED');assert.equal(first(i,[profile('LIHTC',{limitTo:'2026-08-31'})]).comparison,'NOT_DETERMINED');});
test('threshold equality differs from above limit without an eviction determination',()=>{const i=input();assert.equal(first(i,[profile('LIHTC',{limits:{'2':'41600'}})]).comparison,'AT_OR_BELOW_LIMIT');const r=first(i,[profile('LIHTC',{limits:{'2':'41599.99'}})]);assert.equal(r.comparison,'ABOVE_LIMIT');assert.equal(r.difference,'0.01');});
for(const [rounding,amount] of [['CENTS','41600.26'],['WHOLE_NEAREST','41600.00'],['WHOLE_UP','41601.00'],['WHOLE_DOWN','41600.00']]) test(`profile final rounding: ${rounding}`,()=>{const i=input();i.jobs[0].adjustment='0.26';i.jobs[0].changeSource='Synthetic adjustment';assert.equal(first(i,[profile('LIHTC',{rounding})]).annualIncome,amount);});
test('ambiguous HUD program must not silently become Multifamily',()=>assert.equal(e.normalizeProgram('HUD'),'HUD_UNSPECIFIED'));
test('unknown JSON structure and frequencies are rejected',()=>{assert.throws(()=>e.evaluate({foo:1},[]));const i=input();i.jobs[0].frequency='DAILY';assert.throws(()=>e.evaluate(i,[profile()]));});
test('signed report displays its stored calculation rather than current draft recomputation',()=>{const ui=readFileSync('src/components/income-calculator.tsx','utf8');assert.match(ui,/saved\?\.calculation \?\? evaluate/);assert.match(ui,/setSaved\(null\)/);assert.doesNotMatch(ui,/localStorage\.setItem|sessionStorage\.setItem/);});
test('server recalculates rather than trusting a submitted result',()=>{const api=readFileSync('supabase/functions/income-calculator/index.ts','utf8');assert.match(api,/evaluate\(input, config\.profiles\)/);assert.match(api,/auth\.getUser/);assert.match(api,/\.eq\("user_id", userId\)/);assert.match(api,/canonical\(recalculated\) !== canonical\(snapshot\.calculation\)/);});

test('sourced limits retain precise decimal values',()=>assert.deepEqual(e.parseSourcedLimits('1=40000\n2=45000.123456'),{'1':'40000','2':'45000.123456'}));
for(const invalid of ['', '2=45000\n2=46000','31=50000','2=45,000','2=1e3','2=-100','2=0.1234567','2=10000000000']) test('invalid limits fail closed: '+JSON.stringify(invalid),()=>assert.throws(()=>e.parseSourcedLimits(invalid)));
test('saved version is not overwritten by current configuration fetch',()=>{const ui=readFileSync('src/components/income-calculator.tsx','utf8');assert.ok(ui.includes('if (saved?.id) { setConfigurationLoading(false); return; }'));assert.ok(ui.includes('reload, saved?.id]'));});
test('both pending metadata and configuration requests block saves',()=>{const ui=readFileSync('src/components/income-calculator.tsx','utf8');assert.ok(ui.includes('const loading = metadataLoading || configurationLoading;'));assert.ok(ui.includes('!!visibleError'));});
