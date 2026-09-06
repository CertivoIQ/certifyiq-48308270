/** Versioned source regions for the inspected worksheet/application layout.
 * Three printed anchors must agree with the layout before any crop is proposed.
 * No source values are part of the layout. Other templates remain editable.
 */
const key = label => label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/_$/,'');
export function supplementalRegions(lines,width,height) {
 const regions=[],choices=[]; const add=(name,x0,y0,x1,y1,type='text')=>regions.push({key:name,bbox:{x0:x0*width/1237,y0:y0*height/1600,x1:x1*width/1237,y1:y1*height/1600},type});
 const near=(re,y)=>lines.some(l=>re.test(l.text)&&Math.abs(l.bbox.y0/height-y/1600)<.025);
 const table=(prefix,labels,xs,ys)=>{for(let r=0;r<ys.length-1;r++) labels.forEach((label,c)=>add(`${prefix}_${r+1}_${key(label)}`,xs[c]+4,ys[r]+4,xs[c+1]-4,ys[r+1]-4));};
 const choice=(name,boxes)=>choices.push({key:name,options:boxes.map(([value,x0,y0,x1,y1])=>({value,bbox:{x0:x0*width/1237,y0:y0*height/1600,x1:x1*width/1237,y1:y1*height/1600}}))});
 let template=null;
 if(near(/annual income calculation worksheet/i,160)&&near(/relationship/i,264)&&near(/description/i,510)) {
  template='worksheet';
  for(const [name,x0,y0,x1,y1] of [
   ['property_code',267,176,426,195],['property_name',267,197,431,211],['unit_code',267,212,432,229],
   ['household_name',599,177,736,197],['tenant_code',599,198,736,212],['unit_size',599,213,736,230],
   ['certification_date',879,177,1080,199],['certification_type',879,200,1080,216],['certification_code',900,217,952,233],
   ['total_of_all_income_sources',996,392,1072,409],['total_asset_cash_value',301,740,391,761],
   ['total_actual_income',902,745,997,767],['passbook_rate_percent',579,810,678,833],['total_imputed_income',900,811,1002,834],
   ['greatest_asset_income',903,884,1003,911],['total_income',273,950,375,981],['total_asset_income',579,955,680,983],
   ['total_annual_income',910,959,1017,985],['qualifying_income_limit_percent',787,1080,829,1103],['qualifying_income_limit',838,1080,892,1103],['variance',949,1080,1020,1103],['total_reported_income',469,1136,551,1157],
  ]) add(`worksheet_${name}`,x0,y0,x1,y1);
  table('worksheet_member',['Member','Relationship','Gender','DOB','Age','Citizenship','Disabled','Elderly','Student','Eligible Student','Joint Custody'],[131,267,358,408,491,547,635,698,752,808,944,1075],[284,319]);
  table('worksheet_income',['Member','Source','Frequency','Pay Type','Dollars Per Hour','Hours Per Period','Periods Per Year','Income Per Year'],[131,267,418,492,584,698,887,990,1075],[371,391]);
  table('worksheet_asset',['Member','Description','Status','Divested','Asset Type','Income Type','Market Value','Divest Cost','Cash Value','Interest Percent','Income Per Year'],[131,306,419,472,542,594,642,735,823,922,991,1075],[530,551]);
 }
 if(near(/rental application/i,140)&&near(/household information/i,492)&&near(/housing information/i,900)) {
  template='application_1';
  for(const [name,x0,y0,x1,y1] of [['office_date',990,103,1150,136],['office_time',997,138,1162,192],['apartment_community',329,310,682,362],['today_date',901,314,1134,358],['telephone_number',346,363,649,400],['bedrooms_needed',982,363,1123,403],['email_address',309,404,766,446],['how_did_you_hear_about_the_community',476,440,1135,480]]) add(`application_${name}`,x0,y0,x1,y1);
  table('application_member',['Name (First, Middle, Last)','Relationship to Head of Household','Sex','Social Security Number','Birthdate (Month, day, year)','Marital Status'],[97,387,551,661,851,1011,1120],[640,683,726,768,811,854,897]);
  for(let r=1;r<=3;r++) {
   const offset=(r-1)*153;
   for(const [name,x0,y0,x1,y1] of [['address',248,926,721,961],['city',767,928,865,963],['state',920,929,997,962],['zip',1031,929,1131,963],['landlord',272,963,722,996],['landlord_phone',909,965,1129,996],['landlord_address',274,998,720,1024],['landlord_city',762,998,865,1024],['landlord_state',920,998,997,1024],['landlord_zip',1031,998,1131,1024],['rent',184,1026,240,1058],['how_long',387,1026,551,1058],['leaving_for',676,1026,1131,1058]]) add(`application_residence_${r}_${name}`,x0,y0+offset,x1,y1+offset);
  }
  add('application_evicted',615,1362,721,1389,'yes_no');add('application_evicted_explanation',109,1392,1133,1453);
 }
 if(near(/personal references/i,83)&&near(/household income/i,358)&&near(/other income/i,695)) {
  template='application_2';
  for(let r=1;r<=3;r++) {
   const d=(r-1)*69;
   for(const [name,x0,y0,x1,y1] of [['name',175,134,518,170],['address',603,133,1145,172],['phone',173,174,430,200],['occupation',566,172,856,201],['how_long_known',986,172,1140,201]]) add(`application_reference_${r}_${name}`,x0,y0+d,x1,y1+d);
  }
  for(const [prefix,d] of [['current',0],['previous',135]]) for(const [name,x0,y0,x1,y1] of [['company',195,459,519,491],['address',604,445,1135,491],['position',193,491,519,526],['salary',666,492,791,526],['per_hour',885,492,1002,526],['per_month',1103,492,1144,526],['phone',170,529,520,557],['how_long',671,529,1140,557]]) add(`application_employment_${prefix}_${name}`,x0,y0+d,x1,y1+d);
  const ys=[805,838,871,903,937,970,1003,1036,1069,1101,1135,1168,1200,1233,1265,1299,1331,1364,1419,1453];
  table('application_other_income',['Head','Other'],[441,783,1124],ys);
 }
 if(near(/asset information/i,143)&&near(/adjustments to income/i,731)&&near(/other information/i,934)) {
  template='application_3';
  const ys=[311,345,379,411,444,479,513,546,579,629,663,696];
  table('application_asset',['Institution','Account','Value','Interest'],[327,592,787,977,1122],ys);
  add('application_childcare',338,788,1134,808);add('application_elderly_deduction',843,837,1134,863);
  add('application_medical_expenses',634,892,1135,918);
  add('application_question_2_explanation',653,1032,1136,1061);add('application_question_4_explanation',644,1191,1134,1219);
  add('application_question_6',108,1373,1136,1410);
  for(const [n,yes,no,y] of [[1,659,862,954],[2,193,382,1033],[3,189,378,1112],[4,190,383,1193],[5,191,382,1271]]) choice(`application_question_${n}`,[['Yes',yes,y,yes+32,y+30],['No',no,y,no+32,y+30]]);
  for(const [name,x] of [['disability',250],['handicapped',408],['elderly',633]]) choice(`application_deduction_${name}`,[['Yes',x,841,x+28,865]]);

 }
 if(near(/full custody/i,181)&&near(/bankruptcy/i,421)&&near(/automobiles/i,1135)) {
  template='application_4';
  for(const [n,x0,y0,x1,y1] of [[7,288,141,1134,167],[8,486,200,1135,237],[9,110,277,1134,306],[10,177,443,1133,465],[11,582,517,1136,543],[12,107,579,1137,613],[13,105,648,1136,680],[14,174,723,1134,747],[19,791,953,1135,980]])add(`application_question_${n}_explanation`,x0,y0,x1,y1);
  add('application_previous_convictions',107,342,1135,399);
  for(const [n,yes,no,y] of [[7,907,1066,104],[8,575,729,177],[9,742,871,244],[10,780,414+520,414],[11,172,383,506],[12,692,811,549],[13,650,744,622],[14,847,944,695],[15,757,846,759],[16,362,461,799],[17,578,673,837],[18,437,538,878],[19,281,396,947]]) {
    const options=[['Yes',yes,y,yes+32,y+29],['No',no,y,no+32,y+29]];
    if(n===8)options.push(['N/A',870,177,902,205]);
    choice(`application_question_${n}`,options);
  }

  table('application_automobile',['Year','Make','Model','Tag Number'],[96,351,608,865,1122],[1233,1275,1317]);
 }
 if(near(/head of household/i,676)&&near(/adult household member/i,786)&&near(/ethnicity/i,1019)) {
  template='application_5';add('application_signature_head_date',779,625,1063,679,'date');add('application_signature_adult_date',779,740,1063,788,'date');
  for(const [name,x,y] of [['hispanic',447,1008],['not_hispanic',834,999],['american_indian',468,1074],['asian',254,1101],['black',444,1118],['pacific_islander',989,1069],['white',674,1096],['male',458,1159],['female',677,1158]]) choice(`application_demographic_${name}`,[['Yes',x,y,x+29,y+27]]);

 }
 return {template,regions,choices};
}
