export type TicWorksheetSettings = { passbookRatePercent: string; assetMethod: 'SOURCE'|'ACTUAL'|'LEGACY_GREATER'|'HOTMA_PER_ASSET'; imputationThreshold: string; rateSource: string };
export type TicWorksheet = { values: Record<string,string>; calculated: Record<string,string>; formulas: Record<string,string>; issues: string[]; differences: {field:string;reported:string;calculated:string}[]; incomeRows:{member:string;source:string;annual:string}[]; assetRows:{member:string;description:string;cash:string;annual:string;method:string}[] };
export const newTicWorksheetSettings = ():TicWorksheetSettings => ({passbookRatePercent:'',assetMethod:'SOURCE',imputationThreshold:'',rateSource:''});
const blank=(v:unknown)=>v==null||String(v).trim()==='';
export function ticMoney(v:unknown):bigint|null {
 if(blank(v))return null;
 if(!/^\$?\s*-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(String(v).trim()))return null;
 const s=String(v).trim().replace(/^\$\s*/,'').replace(/,/g,'');
 if(!/^-?\d{1,12}(?:\.\d{1,2})?$/.test(s))return null;
 const negative=s.startsWith('-'),[whole,frac='']=s.replace(/^-/,'').split('.');
 return (BigInt(whole!)*100n+BigInt(frac.padEnd(2,'0')))*(negative?-1n:1n);
}
const cash=(n:bigint)=>{const a=n<0n?-n:n;return (n<0n?'-':'')+String(a/100n)+'.'+String(a%100n).padStart(2,'0');};
function rate(v:string):{n:bigint;d:bigint}|null {if(!/^\d{1,3}(?:\.\d{1,6})?$/.test(v)||Number(v)>100)return null;const [a,b='']=v.split('.');return {n:BigInt(a!+b),d:100n*10n**BigInt(b.length)};}
const round=(n:bigint,d:bigint)=>(n+d/2n)/d;
export function assertTicWorksheetSettings(s:unknown):asserts s is TicWorksheetSettings {
 if(!s||typeof s!=='object')throw Error('Worksheet settings are required.');
 const v=s as TicWorksheetSettings;
 if(!['SOURCE','ACTUAL','LEGACY_GREATER','HOTMA_PER_ASSET'].includes(v.assetMethod))throw Error('Select the asset-income method.');
 for(const k of ['passbookRatePercent','imputationThreshold','rateSource'] as const)if(typeof v[k]!=='string'||v[k].length>1000)throw Error('Invalid worksheet setting.');
 if(v.passbookRatePercent!==''&&!rate(v.passbookRatePercent))throw Error('Passbook rate must be a percentage from 0 to 100, such as 0.06.');
 if(v.imputationThreshold!==''&&(ticMoney(v.imputationThreshold)===null||ticMoney(v.imputationThreshold)!<0n))throw Error('Enter a nonnegative imputation threshold.');
}
export function calculateTicWorksheet(input:Record<string,string>,settings:TicWorksheetSettings=newTicWorksheetSettings()):TicWorksheet {
 assertTicWorksheetSettings(settings);
 const values={...input},calculated:Record<string,string>={},formulas:Record<string,string>={},issues:string[]=[],differences:TicWorksheet['differences']=[],incomeRows:TicWorksheet['incomeRows']=[],assetRows:TicWorksheet['assetRows']=[];
 const put=(key:string,n:bigint|null,formula:string)=>{if(n===null)return;const value=cash(n);calculated[key]=value;formulas[key]=formula;values[key]=value;if(ticMoney(input[key])!==null&&ticMoney(input[key])!==n)differences.push({field:key,reported:input[key]!,calculated:value});};
 const read=(key:string)=>ticMoney(input[key]);
 const cols=[['wages_business','Employment / business'],['social_security_pension','Social Security / pension'],['public_assistance','Public assistance'],['other_income','Other income']];
 let earned=0n,hasIncome=false,badIncome=false;
 for(let row=1;row<=10;row++){
  let rowCount=0;
  for(const [suffix,label] of cols){const key='income_member_'+row+'_'+suffix;if(blank(input[key]))continue;const n=read(key);if(n===null){issues.push('Income row '+row+': correct the incomplete amount.');badIncome=true;continue;}earned+=n;hasIncome=true;rowCount++;incomeRows.push({member:input['income_member_'+row+'_household_member_number']||String(row),source:label!,annual:cash(n)});}
  if(!rowCount&&!blank(input['income_member_'+row+'_household_member_number'])){issues.push('Income row '+row+': enter the annual income, including explicit zero when supported.');badIncome=true;}
 }
 const e=badIncome?null:hasIncome?earned:read('total_income_e');
 if(hasIncome&&!badIncome)put('total_income_e',e,'Sum of entered annual amounts in columns A–D');
 let assetCash=0n,actual=0n,assetCount=0,badCash=false,badActual=false,imputedRows=0n;
 const r=rate(settings.passbookRatePercent),threshold=ticMoney(settings.imputationThreshold);
 for(let row=1;row<=27;row++){
  const p='asset_'+row+'_';if(!['type','household_member_number','cash_value','annual_income'].some(k=>!blank(input[p+k])))continue;
  assetCount++;const c=read(p+'cash_value'),a=read(p+'annual_income'),method=(input[p+'income_method']||'').trim();
  if(c===null||c<0n){badCash=true;issues.push('Asset '+row+': enter the cash value.');}else assetCash+=c;
  const imputed=/^imputed$/i.test(method);
  if(!imputed){if(a===null||a<0n){badActual=true;issues.push('Asset '+row+': enter actual annual income, including explicit zero when supported.');}else actual+=a;}
  assetRows.push({member:input[p+'household_member_number']||String(row),description:input[p+'type']||'Asset '+row,cash:c===null?'':cash(c),annual:a===null?'':cash(a),method});
 }
 const net=assetCount?(badCash?null:assetCash):read('total_asset_cash_value');
 const actualIncome=assetCount?(badActual?null:actual):read('asset_actual_income_below_iit');
 if(assetCount&&!badCash)put('total_asset_cash_value',net,'Sum of asset cash values');
 const rawImputed=net!==null&&r?round(net*r.n,r.d):null;
 const imputed=net!==null&&threshold!==null&&r?(net>threshold?rawImputed:0n):null;
 let selected:bigint|null=null;
 if(settings.assetMethod==='SOURCE'){
  selected=read('total_income_assets_m')??read('total_asset_annual_income')??read('worksheet_total_asset_income')??(!assetCount?read('asset_actual_income_below_iit'):null);
  if(selected===null&&blank(input['imputed_asset_income'])&&assetCount&&!badActual&&!assetRows.some(a=>/^imputed$/i.test(a.method)))selected=actualIncome;
  if(selected!==null)put('total_income_assets_m',selected,assetCount&&blank(input['total_income_assets_m'])&&blank(input['total_asset_annual_income'])&&blank(input['worksheet_total_asset_income'])?'Sum of entered annual asset-income amounts':'Asset-income total reported on the selected source TIC');
 }else if(settings.assetMethod==='ACTUAL'){selected=actualIncome;if(assetRows.some(a=>/^imputed$/i.test(a.method))){selected=null;issues.push('Imputed asset rows require the applicable imputation method.');}put('total_income_assets_m',selected,'Actual annual income from the entered assets');}
 else if(settings.assetMethod==='LEGACY_GREATER'){if(actualIncome!==null&&imputed!==null)selected=actualIncome>imputed?actualIncome:imputed;put('total_income_assets_m',selected,'Greater of actual asset income and imputed income above the entered threshold');}
 else if(settings.assetMethod==='HOTMA_PER_ASSET'){
  if(net!==null&&threshold!==null&&r&&!badActual){
   let valid=true;for(const a of assetRows)if(/^imputed$/i.test(a.method)){const c=ticMoney(a.cash);if(c===null||net<=threshold){valid=false;issues.push('Confirm actual income for assets below the imputation threshold.');}else imputedRows+=round(c*r.n,r.d);}
   if(valid)selected=actual+imputedRows;
  }
  put('total_income_assets_m',selected,'Actual income plus imputed income only for assets marked Imputed');
 }
 if(settings.assetMethod!=='SOURCE'&&settings.assetMethod!=='ACTUAL'&&(!r||threshold===null))issues.push('Enter the applicable passbook rate and imputation threshold.');
 if(selected===null)issues.push('Confirm the asset-income total or choose its calculation method.');
 if(e===null)issues.push('Complete the annual income amounts in Part III.');
 if(e!==null&&selected!==null)put('household_annual_income',e+selected,'Total Income (E) + selected asset income (F or M)');
 const total=ticMoney(values['household_annual_income']);
 const rentParts=['tenant_paid_rent','utility_allowance','other_non_optional_charges'].map(read);
 if(rentParts.every(x=>x!==null))put('gross_rent',rentParts.reduce<bigint>((a,b)=>a+b!,0n),'Tenant-paid rent + utility allowance + mandatory charges; subsidy excluded');
 const limit=read('applicable_lihtc_income_limit');
 if(limit!==null)put('current_income_limit_140_percent',round(limit*140n,100n),'Entered income limit × 140%; over-income rule applicability is reviewed separately');
 const worksheet:Record<string,bigint|null>={worksheet_total_of_all_income_sources:e,worksheet_total_income:e,worksheet_total_asset_cash_value:net,worksheet_total_actual_income:actualIncome,worksheet_total_imputed_income:settings.assetMethod==='HOTMA_PER_ASSET'?imputedRows:imputed,worksheet_greatest_asset_income:settings.assetMethod==='LEGACY_GREATER'?selected:null,worksheet_total_asset_income:selected,worksheet_total_annual_income:total,worksheet_total_reported_income:read('household_annual_income'),worksheet_qualifying_income_limit:limit,worksheet_variance:total!==null&&limit!==null?total-limit:null};
 for(const [key,n] of Object.entries(worksheet))put(key,n,'Calculated from the entered TIC income and asset components');
 if(settings.passbookRatePercent)values['worksheet_passbook_rate_percent']=settings.passbookRatePercent;
 for(const [to,from] of [['worksheet_property_name','property_name'],['worksheet_unit_code','unit_number'],['worksheet_unit_size','unit_bedrooms'],['worksheet_certification_date','certification_effective_date'],['worksheet_certification_type','certification_type'],['worksheet_qualifying_income_limit_percent','household_income_restriction_percent']])if(input[from!])values[to!]=input[from!]!;
 return {values,calculated,formulas,issues:[...new Set(issues)],differences,incomeRows,assetRows};
}
