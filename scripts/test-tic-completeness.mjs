import test from 'node:test';
import assert from 'node:assert/strict';
import { ticCompletenessFindings } from '../src/lib/tic-completeness.ts';
import { TIC_SUPPLEMENTAL_FIELDS, supplementalPageKind } from '../src/lib/tic-supplemental-fields.ts';
test('listed bank with absent amount blocks; a different source total cannot cure it',()=>{
 const values={application_asset_1_institution:'Example Bank',application_asset_1_account:'1234',asset_1_cash_value:520.90,application_asset_1_interest:0};
 assert.deepEqual(ticCompletenessFindings(values).map(f=>f.field),['application_asset_1_value']);
});
test('explicit zero is complete, whitespace and malformed values are not',()=>{
 for(const v of ['', ' ', null, undefined, 'N/A', '12x']) assert(ticCompletenessFindings({application_asset_1_institution:'Example Bank',application_asset_1_account:'1234',application_asset_1_value:v,application_asset_1_interest:0}).some(f=>f.field==='application_asset_1_value'));
 assert.equal(ticCompletenessFindings({application_asset_1_institution:'Example Bank',application_asset_1_account:'1234',application_asset_1_value:0,application_asset_1_interest:'0.00'}).length,0);
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
