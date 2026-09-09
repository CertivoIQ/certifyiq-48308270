import test from 'node:test';
import assert from 'node:assert/strict';
import { ticCompletenessFindings } from '../src/lib/tic-completeness.ts';
import { TIC_SUPPLEMENTAL_FIELDS, supplementalPageKind } from '../src/lib/tic-supplemental-fields.ts';
test('listed TIC asset with absent amount blocks; another source total cannot cure it',()=>{
 const values={asset_1_type:'Checking',household_net_assets:520.90,asset_1_annual_income:0};
 assert.deepEqual(ticCompletenessFindings(values).map(f=>f.field),['asset_1_cash_value']);
});
test('explicit zero is complete, whitespace and malformed values are not',()=>{
 for(const v of ['', ' ', null, undefined, 'N/A', '12x']) assert(ticCompletenessFindings({asset_1_type:'Checking',asset_1_cash_value:v,asset_1_annual_income:0}).some(f=>f.field==='asset_1_cash_value'));
 assert.equal(ticCompletenessFindings({asset_1_type:'Checking',asset_1_cash_value:0,asset_1_annual_income:'0.00'}).length,0);
});
test('unused asset rows do not create false findings',()=>assert.deepEqual(ticCompletenessFindings({}),[]));
test('every supplemental field has a unique independent key',()=>{
 assert.equal(new Set(TIC_SUPPLEMENTAL_FIELDS.map(f=>f.key)).size,TIC_SUPPLEMENTAL_FIELDS.length);
 assert(TIC_SUPPLEMENTAL_FIELDS.length>250);
 assert(TIC_SUPPLEMENTAL_FIELDS.some(f=>f.key==='application_question_19'));
 assert(TIC_SUPPLEMENTAL_FIELDS.some(f=>f.key==='application_asset_1_value'));
});
test('application pages are recognized by content, not page number',()=>{
 assert.equal(supplementalPageKind('ASSET INFORMATION Adjustments to Income OTHER INFORMATION'),'application_3');
 assert.equal(supplementalPageKind('bank statement checking balance'),null);
});

test('Rental Application automobile fields do not impose TIC requirements',()=>{
 const f=ticCompletenessFindings({application_automobile_1_year:'2020',application_automobile_1_make:'Example',application_automobile_1_model:'Sedan'});
 assert.equal(f.length,0);
 assert(!f.some(x=>x.field.startsWith('application_automobile_2')));
});
test('Rental Application question explanations are outside the TIC review',()=>{
 assert.deepEqual(ticCompletenessFindings({application_question_7:'Yes'}),[]);
 assert(!ticCompletenessFindings({application_question_7:'No'}).some(f=>f.field==='application_question_7_explanation'));
});
