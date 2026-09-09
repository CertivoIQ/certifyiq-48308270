import test from 'node:test';import assert from 'node:assert/strict';import {load} from './helpers/load-typescript.mjs';
const {calculateTicWorksheet,newTicWorksheetSettings,ticMoney}=await import(load('src/lib/tic-calculations.ts'));
const {buildIncomePreparation,validateIncomePreparation,savedIncomePreparation}=await import(load('src/lib/certification-income-evidence.ts'));
const input={income_member_1_wages_business:'48412.00',income_member_2_wages_business:'4500.00',asset_1_type:'Checking',asset_1_cash_value:'902.20',asset_1_annual_income:'0.90',asset_2_type:'Savings',asset_2_cash_value:'3426.24',asset_2_annual_income:'0.00',asset_3_type:'Savings',asset_3_cash_value:'4879.82',asset_3_annual_income:'2.28',tenant_paid_rent:'1355',utility_allowance:'190',other_non_optional_charges:'0',applicable_lihtc_income_limit:'61260'};
const settings={...newTicWorksheetSettings(),assetMethod:'LEGACY_GREATER',passbookRatePercent:'0.06',imputationThreshold:'5000',rateSource:'Synthetic documented policy'};
test('TIC amounts calculate E, asset cash, imputed income, M, Part V and gross rent using exact cents',()=>{
 const r=calculateTicWorksheet(input,settings);assert.deepEqual(r.issues,[]);
 for(const [field,value] of Object.entries({total_income_e:'52912.00',total_asset_cash_value:'9208.26',worksheet_total_actual_income:'3.18',worksheet_total_imputed_income:'5.52',total_income_assets_m:'5.52',household_annual_income:'52917.52',gross_rent:'1545.00',current_income_limit_140_percent:'85764.00'}))assert.equal(r.values[field],value,field);
});
test('a per-review rate change updates dependent totals and preserves original source differences',()=>{
 const source={...input,household_annual_income:'52948.83',total_income_assets_m:'36.83'};
 const before=calculateTicWorksheet(source,{...settings,passbookRatePercent:'0.40'}),after=calculateTicWorksheet(source,settings);
 assert.equal(before.values.household_annual_income,'52948.83');assert.equal(after.values.household_annual_income,'52917.52');
 assert.ok(after.differences.some(d=>d.field==='household_annual_income'&&d.reported==='52948.83'));assert.equal(source.household_annual_income,'52948.83');
});
test('blank, malformed and incomplete amounts never become fabricated zero or complete totals',()=>{
 assert.equal(ticMoney(''),null);assert.equal(ticMoney('1,35'),null);assert.equal(ticMoney('0'),0n);
 const r=calculateTicWorksheet({...input,asset_2_annual_income:''},settings);assert.ok(r.issues.length);assert.equal(r.calculated.household_annual_income,undefined);
 assert.throws(()=>calculateTicWorksheet(input,{...settings,passbookRatePercent:'100.1'}));
});
test('HOTMA imputes only designated eligible asset rows, and thresholds use greater-than',()=>{
 const v={...input,asset_3_income_method:'Imputed'};
 const hotma=calculateTicWorksheet(v,{...settings,assetMethod:'HOTMA_PER_ASSET'});assert.equal(hotma.values.total_income_assets_m,'3.83');
 const at=calculateTicWorksheet(input,{...settings,imputationThreshold:'9208.26'});assert.equal(at.values.total_income_assets_m,'3.18');
});
test('TIC-only preparation works without payroll dates, a tenant file or a property CSV and survives replay',()=>{
 const sha='a'.repeat(64),digest='b'.repeat(64),choices=[{page:1,role:'tic_page',reason:''}],p=buildIncomePreparation([],choices,sha,digest,'2026-09-01');
 const draft={...p.draft,basis:'TIC',ticWorksheet:{values:input,settings},confirmed:true};
 const checked=validateIncomePreparation(draft,p);assert.equal(checked.calculation.annualIncome,'52917.52');
 const history=[{type:'tic_pre_save_confirmation',income_preparation_version:draft.version,income_preparation:checked}];assert.equal(savedIncomePreparation(history,sha,digest,choices).calculation.annualIncome,'52917.52');
 assert.throws(()=>validateIncomePreparation({...draft,confirmed:false},p),/Confirm/);
 history[0].income_preparation.calculation.annualIncome='1.00';assert.throws(()=>savedIncomePreparation(history,sha,digest,choices),/changed/);
});

test('per-asset imputation cannot fabricate zero when only aggregate assets are provided',()=>{
 const r=calculateTicWorksheet({total_income_e:'10000',total_asset_cash_value:'60000',asset_actual_income_below_iit:'200'}, {...settings,assetMethod:'HOTMA_PER_ASSET'});
 assert.ok(r.issues.some(i=>i.includes('individual asset rows')));assert.equal(r.calculated.total_income_assets_m,undefined);assert.equal(r.calculated.household_annual_income,undefined);
});
test('each new review starts with independent rate settings',()=>{
 const first=newTicWorksheetSettings();first.passbookRatePercent='0.06';
 assert.equal(newTicWorksheetSettings().passbookRatePercent,'');
 assert.equal(calculateTicWorksheet(input,{...settings,passbookRatePercent:'0'}).values.total_income_assets_m,'3.18');
});
