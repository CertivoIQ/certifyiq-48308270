/**
 * Label matching only: original value text and source coordinates are never rewritten.
 * Explicit vocabulary plus token boundaries avoids fuzzy guesses between financial fields.
 */
export const TIC_LABEL_VARIANTS = {
 certification_effective_date: ['effective date of certification', 'cert effective date'],
 move_in_date: ['date of move in', 'occupancy start date'],
 certification_ending_date: ['certification end date', 'certification expiration date'],
 property_name: ['property name', 'development name', 'project name', 'community name'],
 property_address: ['property address', 'development address', 'project address'],
 building_identification_number: ['building identification number', 'BIN number', 'BIN'],
 unit_number: ['unit number', 'apartment number', 'apt number', 'unit no.'],
 unit_bedrooms: ['# bedrooms', 'number of bedrooms', 'bedroom count', 'bedrooms'],
 tax_credit_number: ['tax credit number', 'TC number'],
 household_size: ['household size', 'total household members', 'number of household members', 'total number of persons in household'],
 full_time_student_count: ['number of full time students in household', 'full time student count'],
 total_employment_income: ['total employment income', 'total employment wages', 'total wages and business income'],
 total_social_security_pensions: ['total social security pensions', 'total social security and pensions'],
 total_public_assistance: ['total public assistance income'],
 total_other_income: ['total other income'],
 household_annual_income: ['total annual household income', 'annual household income', 'total household annual income', 'total annual household income from all sources'],
 total_income_e: ['total income E', 'total income (E)'],
 total_asset_cash_value: ['total cash value of assets', 'total asset cash value', 'total asset cash balance'],
 total_asset_annual_income: ['total annual income from assets', 'total annual asset income'],
 household_net_assets: ['net household assets', 'net family assets'],
 asset_actual_income_below_iit: ['actual income earned from all assets', 'actual income from all assets'],
 imputed_asset_income: ['imputed income from assets', 'imputed asset income'],
 applicable_lihtc_income_limit: ['current income limit per family size', 'current income limit per household size', 'applicable income limit', 'income limit for household size'],
 current_income_limit_140_percent: ['current income limit x 140 percent', '140 percent income limit'],
 household_income_at_move_in: ['household income at move in', 'move in household income'],
 household_size_at_move_in: ['household size at move in', 'move in household size'],
 household_income_restriction_percent: ['household meets income restriction at', 'designated income restriction'],
 tenant_paid_rent: ['tenant paid rent', 'tenant rent', 'resident rent', 'rent paid by tenant', 'rent paid by resident', 'tenant portion of rent', 'tenant rent portion'],
 utility_allowance: ['utility allowance', 'monthly utility allowance'],
 utility_allowance_source: ['utility allowance source', 'UA source'],
 rent_assistance: ['rent assistance', 'rental assistance', 'rental assistance amount', 'rental subsidy amount', 'rent subsidy amount'],
 rental_assistance_type: ['rental assistance type', 'rent assistance type', 'type of rental assistance', 'rental subsidy type'],
 other_non_optional_charges: ['other non optional charges', 'other non optional charges and mandatory fees', 'mandatory fees', 'mandatory non optional charges'],
 gross_rent: ['gross rent for unit', 'gross rent', 'total gross rent', 'unit gross rent'],
 state_max_gross_rent: ['maximum rent limit for this unit', 'maximum rent limit', 'maximum allowable gross rent', 'gross rent limit', 'maximum gross rent'],
 unit_rent_restriction_percent: ['unit meets rent restriction at', 'unit rent restriction', 'rent restriction percent'],
 all_occupants_full_time_students: ['are all occupants full time students', 'all occupants full time students', 'are all household members full time students', 'all household members full time students'],
 student_exception_code: ['student explanation', 'student exception', 'student exemption'],
 tenant_signature_date: ['tenant signature date', 'resident signature date'],
 owner_representative_name: ['owner representative name', 'owner or agent name'],
 owner_representative_signature_date: ['owner representative signature date', 'owner or agent signature date'],
 worksheet_total_of_all_income_sources: ['total of all income sources', 'total income sources'],
 worksheet_total_asset_cash_value: ['total asset cash value', 'total cash value of assets'],
 worksheet_total_actual_income: ['total actual income', 'total actual asset income'],
 worksheet_passbook_rate_percent: ['passbook rate percent', 'passbook rate'],
 worksheet_total_imputed_income: ['total imputed income', 'total imputed asset income'],
 worksheet_greatest_asset_income: ['greatest asset income', 'greater asset income'],
 worksheet_total_annual_income: ['total annual income', 'annual income total'],
 worksheet_total_reported_income: ['total reported income', 'reported income total'],
};
const EXPANSIONS = {
 '#':'number', '%':'percent', '&':'and', '×':'x',
 hh:'household', mbr:'member', nbr:'number', num:'number',
 dob:'date of birth', ssn:'social security number',
 apt:'apartment', cert:'certification',
 fulltime:'full time', movein:'move in', nonoptional:'non optional',
};
function tokens(text) {
 const result=[];
 for(const match of String(text??'').matchAll(/[\p{L}\p{N}]+|[#%&×]/gu)){
  const word=match[0].toLowerCase();
  const normalized=EXPANSIONS[word]??word;
  for(const token of normalized.split(' '))result.push({token,start:match.index,end:match.index+match[0].length});
 }
 return result;
}
export function normalizeTicLabel(text) { return tokens(text).map(t=>t.token).join(' '); }
const compiledLabels = new WeakMap();
function compileLabels(definitions) {
 let result=compiledLabels.get(definitions);if(result)return result;
 result=definitions.flatMap(definition=>(definition.aliases??[]).map(alias=>({key:definition.key,target:tokens(alias).map(t=>t.token)}))).filter(d=>d.target.length);
 compiledLabels.set(definitions,result);return result;
}
// One OCR insertion, deletion, or substitution in one long label word only.
// Digits and source values are never corrected; competing destinations stay ambiguous.
function oneLetterApart(a,b) {
 if(a===b||Math.min(a.length,b.length)<5||Math.abs(a.length-b.length)>1||!/^\p{L}+$/u.test(a+b))return false;
 let i=0,j=0,edits=0;
 while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}
 return edits+(i<a.length||j<b.length?1:0)===1;
}
/** Keep the longest overlapping label; equal spans assigned to different keys are ambiguous. */
export function findTicLabels(text, definitions) {
 const source=tokens(text),hits=[];
 for(const {key,target} of compileLabels(definitions)){
   for(let i=0;i+target.length<=source.length;i++){
    const mismatches=target.flatMap((t,j)=>source[i+j].token===t?[]:[j]);
    const exact=mismatches.length===0;
    const ocrVariant=target.length>=3&&mismatches.length===1&&oneLetterApart(target[mismatches[0]],source[i+mismatches[0]].token);
    if(exact||ocrVariant){
     const start=source[i].start,tokenEnd=source[i+target.length-1].end;
     // A one-word alias inside a value is not a second printed field label.
     if(target.length===1 && start>0 && String(text).slice(0,start).trim() && !/^\s*[:=]/.test(String(text).slice(tokenEnd)))continue;
     let end=tokenEnd;while(end<String(text).length && /[)\]?:.\s]/.test(String(text)[end]))end++;
     hits.push({key,start,end});
    }
   }
 }
 const unique=[...new Map(hits.map(h=>[h.key+':'+h.start+':'+h.end,h])).values()];
 const longest=unique.filter(h=>!unique.some(other=>other.start<=h.start&&other.end>=h.end&&(other.start<h.start||other.end>h.end)));
 return longest.map(h=>({...h,ambiguous:longest.some(other=>other.key!==h.key&&other.start<h.end&&other.end>h.start)})).sort((a,b)=>a.start-b.start||b.end-a.end);
}
const sharedDefinitions=Object.entries(TIC_LABEL_VARIANTS).filter(([key])=>!key.startsWith('worksheet_')).map(([key,aliases])=>({key,aliases}));
export function findTicLabelForKey(text,key,fallbackPattern) {
 const labels=findTicLabels(text,sharedDefinitions);
 const own=labels.find(h=>h.key===key&&!h.ambiguous);
 if(own)return own;
 const fallback=fallbackPattern?.exec(text);
 if(!fallback)return null;
 const start=fallback.index,end=start+fallback[0].length;
 if(labels.some(h=>h.key!==key && h.start<end && h.end>start))return null;
 return {key,start,end,ambiguous:false};
}
