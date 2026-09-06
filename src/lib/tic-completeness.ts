import { TIC_SUPPLEMENTAL_FIELDS } from './tic-supplemental-fields.ts';
export type TicCompletenessFinding = { field: string; code: string; message: string };
const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';
const money = (v: unknown) => !blank(v) && /^(?:\$\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(String(v).trim());

/** Completion is distinct from verification. Never borrow a value from another document. */
export function ticCompletenessFindings(values: Record<string, unknown>): TicCompletenessFinding[] {
 const findings: TicCompletenessFinding[] = [];
 const need = (field: string, message: string) => { if (!money(values[field])) findings.push({field,code:'TIC_MISSING_AMOUNT',message}); };
 for(let i=1;i<=27;i++) {
  const prefix=`asset_${i}_`;
  if(['type','household_member_number','current_disposed'].some(k=>!blank(values[prefix+k]))) {
   need(prefix+'cash_value',`Asset ${i}: enter the cash value. A blank or incomplete amount is not $0.`);
   need(prefix+'annual_income',`Asset ${i}: enter annual income from this asset, including an explicit $0 when supported.`);
  }
 }
 for(let i=1;i<=11;i++) {
  const prefix=`application_asset_${i}_`;
  const institution=values[prefix+'institution'];
  const active=!blank(institution)&&!/^0(?:\.0+)?$/.test(String(institution).trim()) || !blank(values[prefix+'account']);
  if(active) {
   need(prefix+'value',`Rental application asset ${i}: a bank/account is listed but Value or Amount is missing or incomplete.`);
   need(prefix+'interest',`Rental application asset ${i}: complete Interest Earned; use $0 only when supported.`);
  }
 }
 // Only started related groups create missing-field findings. Unused rows stay blank.
 const groups = new Map<string, { key: string; label: string }[]>();
 for (const field of TIC_SUPPLEMENTAL_FIELDS) {
   const group = /^(application_(?:member|reference|residence|automobile)_\d+|application_employment_(?:current|previous)|worksheet_(?:member|income|asset)_\d+)_/.exec(field.key)?.[1];
   if (group) groups.set(group, [...(groups.get(group) ?? []), field]);
 }
 const missing = (field: string, message: string) => {
   if (blank(values[field]) && !findings.some(f=>f.field===field)) findings.push({field,code:'TIC_PARTIAL_INFORMATION',message});
 };
 for (const [group, fields] of groups) {
   if (!fields.some(f=>!blank(values[f.key]))) continue;
   for (const f of fields) missing(f.key, `${group.replace(/_/g,' ')}: ${f.label} is missing from this partially completed row.`);
 }
 for(let i=1;i<=11;i++) {
   const prefix=`application_asset_${i}_`;
   if(['institution','account','value','interest'].some(k=>!blank(values[prefix+k])) && !(/^0(?:\.0+)?$/.test(String(values[prefix+'institution']??'').trim()) && ['account','value','interest'].every(k=>blank(values[prefix+k])))) {
     for(const [key,label] of [['institution','Bank/Where Held and Phone Number'],['account','Account #'],['value','Value or Amount'],['interest','Interest Earned']]) missing(prefix+key,`Rental application asset ${i}: ${label} is missing from this partially completed row.`);
   }
 }
 for(let i=1;i<=10;i++) {
   const prefix=`household_member_${i}_`;
   if(['last_name','first_name_middle_initial','date_of_birth','relationship'].some(k=>!blank(values[prefix+k])))
     for(const [key,label] of [['last_name','Last name'],['first_name_middle_initial','First name and middle initial'],['relationship','Relationship'],['date_of_birth','Date of birth'],['full_time_student','Full-time student status'],['ssn_or_alien_registration','SSN / alien registration number']]) missing(prefix+key,`Household member ${i}: ${label} is missing from this partially completed row.`);
 }
 for(let i=1;i<=19;i++) {
   const key=`application_question_${i}`;
   if(String(values[key]??'').toLowerCase()==='yes' && TIC_SUPPLEMENTAL_FIELDS.some(f=>f.key===key+'_explanation')) missing(key+'_explanation',`Question ${i}: complete the corresponding explanation for the Yes answer.`);
 }
 if(String(values.application_evicted??'').toLowerCase()==='yes') missing('application_evicted_explanation','Eviction question: complete the explanation for the Yes answer.');
 for(const who of ['head','adult']) if(String(values[`application_signature_${who}_present`]??'').toLowerCase()==='yes') missing(`application_signature_${who}_date`,`${who} signature is present but its date is missing.`);
 return findings;
}
