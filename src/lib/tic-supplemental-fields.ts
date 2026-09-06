import type { TicFieldDefinition } from './tic-field-registry';

// Source worksheet and rental application are separate from certified TIC totals.
// No resident values or signatures are embedded in this template.
export type SupplementalSection = { id: string; title: string; fields: TicFieldDefinition[]; note?: string };
const sections: SupplementalSection[] = [];
function section(id: string, title: string, note?: string) { const s = { id, title, fields: [] as TicFieldDefinition[], ...(note ? { note } : {}) }; sections.push(s); return s; }
function add(s: SupplementalSection, key: string, label: string, type: TicFieldDefinition['type'] = 'text') {
  s.fields.push({ key, label, type, section: s.title, aliases: [] });
}
function row(s: SupplementalSection, prefix: string, labels: string[], types: Record<string, TicFieldDefinition['type']> = {}) {
  for (const label of labels) { const suffix = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_$/,''); add(s, `${prefix}_${suffix}`, label, types[label] ?? 'text'); }
}
let s = section('worksheet', 'Annual Income Calculation Worksheet', 'Source worksheet figures are transcribed independently. Printed rates and limits are not verified program authority.');
row(s, 'worksheet', ['Property Code','Property Name','Unit Code','Household Name','Tenant Code','Unit Size','Certification Date','Certification Type','Certification Code']);
row(s, 'worksheet_member_1', ['Member','Relationship','Gender','DOB','Age','Citizenship','Disabled','Elderly','Student','Eligible Student','Joint Custody']);
row(s, 'worksheet_income_1', ['Member','Source','Frequency','Pay Type','Dollars Per Hour','Hours Per Period','Periods Per Year','Income Per Year']);
row(s, 'worksheet_asset_1', ['Member','Description','Status','Divested','Asset Type','Income Type','Market Value','Divest Cost','Cash Value','Interest Percent','Income Per Year']);
row(s, 'worksheet', ['Total of All Income Sources','Total Asset Cash Value','Total Actual Income','Passbook Rate Percent','Total Imputed Income','Greatest Asset Income','Total Income','Total Asset Income','Total Annual Income','Qualifying Income Limit Percent','Qualifying Income Limit','Variance','Total Reported Income']);
s = section('application_1', 'Rental Application — Page 1', 'A separate application form must be completed by each applicant 18 years of age and older. Residence history covers the last three years.');
row(s,'application',['Office Date','Office Time','Apartment Community','Today Date','Telephone Number','Bedrooms Needed','Email Address','How did you hear about the community']);
for(let i=1;i<=6;i++) row(s,`application_member_${i}`,['Name (First, Middle, Last)','Relationship to Head of Household','Sex','Social Security Number','Birthdate (Month, day, year)','Marital Status']);
for(let i=1;i<=3;i++) row(s,`application_residence_${i}`,['Address','City','State','ZIP','Landlord','Landlord Phone','Landlord Address','Landlord City','Landlord State','Landlord ZIP','Rent','How Long','Leaving For']);
add(s,'application_evicted','Have you ever been evicted from an apartment community?','yes_no'); add(s,'application_evicted_explanation','If yes, please explain');
s = section('application_2', 'Rental Application — Page 2', 'Personal references: Do not list family members. Other income: complete every applicable amount; the source instructs applicants to put zero when no income is received.');
for(let i=1;i<=3;i++) row(s,`application_reference_${i}`,['Name','Address','Phone','Occupation','How Long Known']);
for(const employment of ['current','previous']) row(s,`application_employment_${employment}`,['Company','Address','Position','Salary','Per Hour','Per Month','Phone','How Long']);
export const APPLICATION_INCOME_SOURCES = ['Armed forces pay','Unemployment benefits','Workers’ Compensation','Public Assistance, AFDC','Tips','Child Support/Alimony','Social Security or SSI','Veteran’s Benefits','Pensions or Retirement Benefits','Severance payments','Settlements','Disability','Death Benefits','Whole Life Insurance Dividends','Regular gifts or payments','Educational Grants, scholarships','Lottery winnings or inheritances','Rental property payments, or other real estate payments','Other Income'];
APPLICATION_INCOME_SOURCES.forEach((label,i)=>{add(s,`application_other_income_${i+1}_head`,`${label} — Amount received for head of household`);add(s,`application_other_income_${i+1}_other`,`${label} — Amount received for spouse, friend, child`);});
s = section('application_3', 'Rental Application — Page 3', 'List assets other than necessary personal possessions, including assets sold in the last two years. A blank is not zero.');
export const APPLICATION_ASSET_TYPES = ['Checking Account(s)','Savings Account(s)',"CD’s","T-Bills or Keogh’s","IRA’s",'Money Market Accounts','Stock, Bonds','Mutual Funds','Real Estate (Fair Market Value)','Trust Funds','Other'];
APPLICATION_ASSET_TYPES.forEach((label,i)=>{
  add(s,`application_asset_${i+1}_institution`,`${label} — Bank/Where Held and Phone Number`);
  add(s,`application_asset_${i+1}_account`,`${label} — Account #`);
  add(s,`application_asset_${i+1}_value`,`${label} — Value or Amount`,'currency');
  add(s,`application_asset_${i+1}_interest`,`${label} — Interest Earned`,'currency');
});
add(s,'application_childcare','List any child care expenses for children 12 years of age and under. List the amount paid and institution that you pay.');
add(s,'application_elderly_deduction','Are you applying for status as an elderly household where any tenant or co-tenant will be claiming a $400 deduction?','yes_no');
for(const label of ['Disability','Handicapped','Elderly']) add(s,`application_deduction_${label.toLowerCase()}`,label,'yes_no');
add(s,'application_medical_expenses','If you are 62 years of age or older, disabled or handicapped, list expected out-of-pocket medical expenses for the next 12 months, not covered by insurance.');
export const APPLICATION_QUESTIONS = [
 'Do you have the right to legally enter into a lease?',
 'Do you have personal property that you hold as an investment? (Such as stamp collection, antique cars, etc.)',
 'Do you have cash on hand more than $500? (Cash on hand means cash not held in the bank.)',
 'Have you or any member in your household disposed of any assets for less than fair market value in the past two years?',
 'Are you or anyone in your household a full-time student or planning to be within the next twelve months?',
 'Please list all household members who are currently unemployed and 18 years of age or older (including applicant).',
 'Do you expect any additions to your household income within the next 12 months?',
 'Do you have full custody of your children?',
 'Have you or anyone in your household ever committed a felony?',
 'Have you or anyone in your household ever filed for bankruptcy?',
 'Do you have anyone living with you now that will not be living with you in the apartment?',
 'Are any members of your household temporarily absent?',
 'Are you separated, but not divorced from your spouse?',
 'Are you receiving assistance with your rent through any government agency?',
 'Do you own a boat, recreational vehicle, motorcycle or scooter?',
 'Do you own a pet?',
 'Will you need a handicapped accessible unit?',
 'Are you using illegal drugs?',
 'Are there any household members NOT already listed on this application who will live in your apartment on a part-time basis?',
];
APPLICATION_QUESTIONS.forEach((question,i)=>{
 if(i===6) s=section('application_4','Rental Application — Page 4');
 add(s,`application_question_${i+1}`,`${i+1}. ${question}`,i===5||i===7?'text':'yes_no');
 if([1,3,6,7,8,9,10,11,12,13,18].includes(i)) add(s,`application_question_${i+1}_explanation`,`${i+1}. If yes, please explain / describe${i===7?' (Yes / No / N/A and custody documentation)':''}`);
 if(i===8) add(s,'application_previous_convictions','Please list all previous convictions below');
});
for(let i=1;i<=2;i++) row(s,`application_automobile_${i}`,['Year','Make','Model','Tag Number']);
s=section('application_5','Rental Application — Page 5', 'Review the original authorization and declarations alongside these fields. Signature presence records existing source evidence; typing a name does not execute a signature. Race, ethnicity and sex disclosure is voluntary and does not control review eligibility.');
for(const who of ['head','adult']){add(s,`application_signature_${who}_present`, `Signature (${who==='head'?'Head of Household':'Adult Household Member'}) present`,'yes_no');add(s,`application_signature_${who}_date`,'Date','date');}
for(const [key,label] of [['hispanic','Hispanic or Latino'],['not_hispanic','Not Hispanic or Latino'],['american_indian','American Indian/Alaska Native'],['asian','Asian'],['black','Black or African American'],['pacific_islander','Native Hawaiian or Other Pacific Islander'],['white','White'],['male','Male'],['female','Female']] as const) add(s,`application_demographic_${key}`,label,'yes_no');
export const TIC_SUPPLEMENTAL_SECTIONS = sections;
export const TIC_SUPPLEMENTAL_FIELDS = sections.flatMap(s=>s.fields);

export function supplementalPageKind(text: string): string | null {
 const t=text.replace(/\s+/g,' ');
 if(/annual income calculation worksheet/i.test(t)&&/relationship/i.test(t)&&/description/i.test(t))return 'worksheet';
 if(/rental application/i.test(t)&&/household information/i.test(t)&&/housing information/i.test(t))return 'application_1';
 if(/personal references/i.test(t)&&/household income/i.test(t)&&/other income/i.test(t))return 'application_2';
 if(/asset information/i.test(t)&&/adjustments to income/i.test(t)&&/other information/i.test(t))return 'application_3';
 if(/full custody/i.test(t)&&/automobiles/i.test(t)&&/bankruptcy/i.test(t))return 'application_4';
 if(/head of household/i.test(t)&&/adult household member/i.test(t)&&/ethnicity/i.test(t))return 'application_5';
 return null;
}

export const TIC_SOURCE_PRESENCE_FIELDS: TicFieldDefinition[] = [...new Set(TIC_SUPPLEMENTAL_FIELDS.map(f => /^(application_(?:member|reference|residence|automobile|other_income|asset)_\d+|application_employment_(?:current|previous)|worksheet_(?:member|income|asset)_\d+)_/.exec(f.key)?.[1]).filter((v): v is string => Boolean(v)))].map(group=>({key:`source_present_${group}`,label:'Source row contains information',type:'yes_no',section:'Source activity',aliases:[]}));
