import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers/load-typescript.mjs';
const { buildIncomePreparation, calculateIncomePreparation, validateIncomePreparation, savedIncomePreparation } = await import(load('src/lib/certification-income-evidence.ts'));
const { SUPPORTING_DOCUMENT_DEFINITIONS } = await import(load('src/lib/tic-supporting-document-registry.ts'));
const { ticCompletenessFindings } = await import(load('src/lib/tic-completeness.ts'));
const sha='a'.repeat(64), digest='b'.repeat(64);
const pay=(gross='1000.00',period='2026-08-01 to 2026-08-14')=>`Earnings Statement\nEmployee: Sample Person\nEmployer: Sample Company\nGross Pay: $${gross}\nNet Pay: $700.00\nYTD Gross Pay: $24000.00\nPay Frequency: Biweekly\nPay Period: ${period}`;
function prepare(texts=[pay()], types=['check_stub']) { return buildIncomePreparation(texts.map((text,i)=>({page:i+1,text})),types.map((role,i)=>({page:i+1,role,reason:''})),sha,digest,'2026-09-01'); }
const confirmed=p=>({...p.draft,confirmed:true});
test('Other Income is a document role with benefit and self-employment recognition',()=>{
 const definition=SUPPORTING_DOCUMENT_DEFINITIONS.find(d=>d.type==='other_income');assert.equal(definition.label,'Other Income');
 assert.ok(definition.strongSignals.some(r=>r.test('Social Security Benefits')));
});
test('gross income is recovered independently from net and YTD; annualization uses the existing engine',()=>{
 const p=prepare();const r=validateIncomePreparation(confirmed(p),p);assert.equal(p.draft.rows[0].amount,'1000.00');assert.equal(r.calculation.annualIncome,'26000.00');
 assert.match(r.calculation.rows[0].basis,/Average gross/);assert.equal(r.calculation.status,'Pending full certification review');
});
test('two comparable stubs from one job are averaged rather than added as two annual jobs',()=>{
 const p=prepare([pay(),pay('1200.00','2026-08-15 to 2026-08-28')],['check_stub','check_stub']);assert.equal(validateIncomePreparation(confirmed(p),p).calculation.annualIncome,'28600.00');
});
test('twice monthly uses 24 periods, not biweekly 26',()=>{
 const p=prepare([pay('1000.00','2026-08-01 to 2026-08-15').replace('Biweekly','Twice monthly')]);assert.equal(validateIncomePreparation(confirmed(p),p).calculation.annualIncome,'24000.00');
});
test('duplicate or overlapping payroll periods block calculation',()=>{
 const p=prepare([pay(),pay()],['check_stub','check_stub']);assert.throws(()=>validateIncomePreparation(confirmed(p),p),/overlapping/);
});
test('partial pay period cannot be promoted to a complete weekly or biweekly period',()=>{
 const p=prepare([pay('1000.00','2026-08-01 to 2026-08-07')]);assert.throws(()=>validateIncomePreparation(confirmed(p),p),/complete biweekly/);
});
test('missing frequency is not guessed from dates and blank gross is not zero',()=>{
 for(const value of [pay().replace('Pay Frequency: Biweekly',''),pay().replace('Gross Pay: $1000.00','Gross Pay:')]) {const p=prepare([value]);assert.equal(calculateIncomePreparation(p.draft,p.pages).annualIncome,null);}
});
test('net pay, YTD and a bank balance alone never become income',()=>{
 const p=prepare(['Net Pay: $700.00\nYTD Gross Pay: $24000.00','Bank Statement\nEnding Balance: $8000.00\nDeposits: $2000.00'],['check_stub','bank_statement']);assert.ok(p.draft.rows.every(r=>r.amount===''));
});
test('unlabeled current/YTD columns and a number on the next line remain unresolved',()=>{
 for(const text of ['Gross Pay: $1000.00 $24000.00','Gross Pay:\n24000.00'])assert.equal(prepare([text]).draft.rows[0].amount,'');
});
test('bank interest and other recurring income are annualized while principal is ignored',()=>{
 const p=prepare(['Bank Statement\nAccount Holder: Sample Person\nBank Name: Sample Bank\nInterest earned: $2.50\nEnding Balance: $8000.00\nFrequency: Monthly\nStatement Period: 2026-08-01 to 2026-08-31','Benefit Award Letter\nRecipient Name: Sample Person\nBenefit Provider: Benefit Provider\nMonthly Benefit Amount: $1200.00\nFrequency: Monthly\nStatement Period: 2026-08-01 to 2026-08-31'],['bank_statement','other_income']);
 assert.equal(validateIncomePreparation(confirmed(p),p).calculation.annualIncome,'14430.00');
});
test('a corroborating payroll deposit requires explanation and is not a second wage source',()=>{
 const p=prepare([pay(),'Bank Statement\nEnding Balance: $8000.00\nDeposits: $700.00'],['check_stub','bank_statement']);let d=confirmed(p);d.rows[1]={...d.rows[1],kind:'exclude',note:'Payroll deposit corroborates the gross paystub on page 1.'};assert.equal(validateIncomePreparation(d,p).calculation.annualIncome,'26000.00');
 d.rows[1].note='';assert.throws(()=>validateIncomePreparation(d,p),/explain why/);
});
test('zero income requires actual selected zero-income evidence and explicit confirmation',()=>{
 const p=prepare(['Certification of Zero Income'],['zero_income_certification']);const d=confirmed(p);d.zeroIncome=true;d.rows[0]={...d.rows[0],kind:'exclude',note:'Zero income is supported by this household certification.'};assert.equal(validateIncomePreparation(d,p).calculation.annualIncome,'0.00');
 d.zeroIncome=false;assert.throws(()=>validateIncomePreparation(d,p),/No income sources/);
});
test('evidence corrections remain reviewable, but foreign pages, stale selection and unconfirmed inputs cannot save',()=>{
 const p=prepare();assert.throws(()=>validateIncomePreparation(p.draft,p),/Confirm the income/);
 assert.throws(()=>validateIncomePreparation({...confirmed(p),selectionDigest:'c'.repeat(64)},p),/changed/);
 const d=confirmed(p);d.rows[0]={...d.rows[0],page:9};assert.throws(()=>validateIncomePreparation(d,p),/not selected/);
});
test('seasonal paid weeks and a supported net annual change use the shared wage formula once',()=>{
 const p=prepare();const d=confirmed(p);d.rows[0]={...d.rows[0],weeks:'26',annualAdjustment:'500',note:'Documented one-time $500 bonus beyond the representative pay periods.'};assert.equal(validateIncomePreparation(d,p).calculation.annualIncome,'13500.00');
 d.rows[0].note='';assert.throws(()=>validateIncomePreparation(d,p),/adjustment requires/);
});
test('saved income is recomputed and cannot silently change before full review',()=>{
 const p=prepare();const checked=validateIncomePreparation(confirmed(p),p);const history=[{type:'tic_pre_save_confirmation',income_preparation_version:p.draft.version,income_preparation:checked}];const choices=[{page:1,role:'check_stub',reason:''}];
 assert.equal(savedIncomePreparation(history,sha,digest,choices).calculation.annualIncome,'26000.00');
  history[0].income_preparation.calculation.annualIncome='99999.00';assert.throws(()=>savedIncomePreparation(history,sha,digest,choices),/saved income calculation changed/);
});
test('Postgres JSONB key ordering does not invalidate an unchanged saved calculation',()=>{
 const p=prepare();const checked=validateIncomePreparation(confirmed(p),p);
 const reorder=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(reorder):Object.fromEntries(Object.keys(v).sort().map(k=>[k,reorder(v[k])])):v;
 const history=reorder([{type:'tic_pre_save_confirmation',income_preparation_version:p.draft.version,income_preparation:checked}]);
 assert.equal(savedIncomePreparation(history,sha,digest,[{page:1,role:'check_stub',reason:''}]).calculation.annualIncome,'26000.00');
});
test('Rental Application entries no longer create mandatory TIC findings; actual TIC gaps still do',()=>{
 assert.deepEqual(ticCompletenessFindings({application_asset_1_institution:'Sample Bank',application_question_1:'Yes',source_present_application_member_1:'Yes'}),[]);
 assert.ok(ticCompletenessFindings({asset_1_type:'Checking'}).some(f=>f.field==='asset_1_cash_value'));
});
