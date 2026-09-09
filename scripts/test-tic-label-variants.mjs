import test from 'node:test';
import assert from 'node:assert/strict';
import {planTicCells} from '../src/lib/tic-ruled-cell-extraction.mjs';
import {load} from './helpers/load-typescript.mjs';
const {extractTicFieldsFromText}=await import(load('src/lib/tic-field-extraction.ts'));
import {findTicLabels,normalizeTicLabel} from '../src/lib/tic-label-matching.mjs';

const labelRegistry=await import(load('src/lib/tic-field-registry.ts'));
const labelDefinitions=labelRegistry.TIC_FIELD_DEFINITIONS.filter(d=>!d.key.startsWith('worksheet_')&&!d.key.startsWith('application_')&&!d.key.startsWith('source_present_'));
test('every canonical TIC field label resolves to its own field despite punctuation and case',()=>{
 for(const definition of labelDefinitions){
  const label=definition.label.toUpperCase().replace(/ /g,'  ').replace(/-/g,'—');
  const hits=findTicLabels(label+': VALUE',labelDefinitions);
  assert.ok(hits.some(h=>h.key===definition.key&&!h.ambiguous),definition.key+': '+label);
 }
});
test('common wording and abbreviations preserve values and distinguish adjacent field labels',()=>{
 const text='page 4\nResident Rent: 675.00\nMonthly Utility Allowance: 147.00\nRental Subsidy Amount: 0.00\nMandatory Fees: 0.00\nTotal Gross Rent: 822.00\nIncome Limit for Household Size: 28,950.00\nApartment #: 204\nHH Member 1 DOB: 01/02/1990';
 const facts=extractTicFieldsFromText(text,'synthetic-labels.pdf').facts;
 for(const [key,value] of Object.entries({tenant_paid_rent:675,utility_allowance:147,rent_assistance:0,other_non_optional_charges:0,gross_rent:822,applicable_lihtc_income_limit:28950,unit_number:'204',household_member_1_date_of_birth:'01/02/1990'}))assert.equal(facts.find(f=>f.field===key)?.value,value,key);
 const protectedFacts=extractTicFieldsFromText('Utility Allowance Source: Agency 2026\nRental Assistance Type: Section 8\nProperty Name: County Gardens','synthetic-labels.pdf').facts;
 assert.ok(!protectedFacts.some(f=>['utility_allowance','rent_assistance','county'].includes(f.field)));
 assert.equal(protectedFacts.find(f=>f.field==='property_name')?.value,'County Gardens');
 assert.equal(normalizeTicLabel('HH Mbr # 1 — DOB'),'household member number 1 date of birth');
});
test('a label shared by two distinct destinations is ambiguous rather than copied twice',()=>{
 const hits=findTicLabels('Net Family Assets: 520.90',labelDefinitions);
 assert.ok(hits.filter(h=>h.ambiguous).length>=2);
 const facts=extractTicFieldsFromText('Net Family Assets: 520.90','synthetic-labels.pdf').facts;
 assert.ok(!facts.some(f=>['total_nnpp','household_net_assets'].includes(f.field)));
});
test('worksheet wording normalization keeps source totals separate from the certified TIC',()=>{
 const facts=extractTicFieldsFromText('page 5\nAnnual Income Calculation Worksheet\nRelationship Description\nTotal Cash Value of Assets: 520.90\nTotal Actual Asset Income: 0.00\nPassbook Rate %: 0.06%\nAnnual Income Total: 25,364.40','synthetic-labels.pdf').facts;
 for(const [key,value] of Object.entries({worksheet_total_asset_cash_value:520.9,worksheet_total_actual_income:0,worksheet_passbook_rate_percent:.06,worksheet_total_annual_income:25364.4}))assert.equal(facts.find(f=>f.field===key)?.value,value,key);
 assert.ok(facts.every(f=>f.field.startsWith('worksheet_')&&f.page===5&&!f.humanVerified));
});
test('bounded cell planning also recognizes rent wording variants',()=>{
 const width=1200,height=1600,data=new Uint8ClampedArray(width*height*4).fill(255);
 const word=(text,x0,x1)=>({text,confidence:95,bbox:{x0,x1,y0:400,y1:420}});
 const line=words=>({text:words.map(w=>w.text).join(' '),words,bbox:{x0:words[0].bbox.x0,x1:words.at(-1).bbox.x1,y0:400,y1:420}});
 for(const label of ['Resident Rent:','Tenant—Paid Rent:','Rent Paid by Tenant:']){
  const blocks=[{paragraphs:[{lines:[line([word(label,80,350)]),line([word('675.00',550,630)])]}]}];
  assert.equal(planTicCells({width,height,data},blocks).cells.find(c=>c.key==='tenant_paid_rent')?.sourceWords[0]?.text,'675.00',label);
 }
});
