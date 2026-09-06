import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const compile = (name) => ts.transpileModule(readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compile('portfolio-onboarding-csv')).toString('base64')}`);
const { readOnboardingCsv: read, suggestOnboardingMapping: suggest, previewOnboarding: preview } = api;
const headers = ['property_id','property_name','unit_id','unit_number','building','bedroom_count','tenant_profile_id','tenant_first_name','tenant_last_name','occupancy_status','move_in_date'];
const values = ['P-001','Example Apartments','U-001','001','Building 1','0','T-001','Ada','Example','occupied','2024-02-29'];
const csv = (h = headers, rows = [values], delimiter = ',') => [h,...rows].map(r => r.map(v => /["\r\n]/.test(v) || v.includes(delimiter) ? `"${v.replaceAll('"','""')}"` : v).join(delimiter)).join('\n');
const run = (text = csv(), options = { stateByPropertyId: { 'P-001':'TN' } }, mapping) => { const table = read(text); return preview(table, mapping ?? suggest(table.headers).mapping, options); };

test('uploaded schema maps IDs, split names, bedroom count and source details', () => {
 const result = run(); assert.equal(result.canImport,true); assert.deepEqual(result.issues,[]);
 const r = result.rows[0]; assert.equal(r.propertyExternalId,'P-001'); assert.equal(r.unitExternalId,'U-001'); assert.equal(r.tenantExternalId,'T-001');
 assert.equal(r.householdName,'Ada Example'); assert.equal(r.bedrooms,0); assert.equal(r.unitNumber,'001');
 assert.equal(r.sourceData.columns.find(c=>c.heading==='building').value,'Building 1');
 assert.equal(r.sourceData.columns.find(c=>c.heading==='occupancy_status').value,'occupied');
});
test('onboarding never invents certification type or program',()=>{ const r=run().rows[0]; assert.equal(r.certificationType,undefined); assert.deepEqual(r.programCodes,[]); });
test('missing state produces one property question, not 833 errors or guessed TN',()=>{
 const rows=Array.from({length:833},(_,i)=>values.map((v,k)=>k===2?`U-${i}`:k===3?`${i}`:k===6?`T-${i}`:v));
 const p=run(csv(headers,rows),{}); assert.equal(p.canImport,false); assert.deepEqual(p.issues,[]); assert.equal(p.stateNeeded.length,1); assert.equal(p.rows[0].state,'');
 const confirmed=run(csv(headers,rows)); assert.equal(confirmed.canImport,true); assert.deepEqual(confirmed.counts,{properties:1,units:833,tenants:833});
});
test('friendly, camelCase, dotted and hyphenated headings are recognized',()=>{
 const h=['Property.Code','Community Name','Unit ID','Unit #','Building Name','Bedroom Count','Resident Profile ID','First Name','Last Name','Occupancy','moveInDate'];
 assert.equal(run(csv(h)).canImport,true);
});
test('unknown headings can be mapped without changing the source file',()=>{
 const h=headers.map((_,i)=>`Vendor Column ${i+1}`), table=read(csv(h));
 const mapping=suggest(headers).mapping; assert.equal(preview(table,suggest(h).mapping).canImport,false);
 assert.equal(preview(table,mapping,{stateByPropertyId:{'P-001':'TN'}}).canImport,true);
});
test('ambiguous equivalent ID headings require a selection rather than silently taking the first',()=>{
 const h=[...headers,'Property Code'], table=read(csv(h,[[...values,'WRONG']])); const p=suggest(h);
 assert.equal(p.mapping.property_external_id,null); assert.deepEqual(p.candidates.property_external_id,[0,11]);
 assert.equal(preview(table,p.mapping).canImport,false); p.mapping.property_external_id=0;
 assert.equal(preview(table,p.mapping,{stateByPropertyId:{'P-001':'TN'}}).canImport,true);
});
test('a source column cannot accidentally supply two different destination fields',()=>{
 const table=read(csv()), m=suggest(headers).mapping; m.tenant_external_id=m.property_external_id;
 assert.match(preview(table,m).issues.join(' '),/duplicate mapping/);
});
test('generic ID and Name are not guessed; known field aliases have no collisions',()=>{
 assert.equal(suggest(['ID','Name','Number']).mapping.property_external_id,null);
 for(const [field,{aliases}] of Object.entries(api.ONBOARDING_FIELDS)) for(const alias of [field,...aliases]) assert.equal(suggest([alias]).mapping[field],0,`${alias}: ${field}`);
});
for(const delimiter of [',',';','\t']) test(`quoted cells, embedded newlines and delimiter ${JSON.stringify(delimiter)}`,()=>{
 const v=[...values];v[1]='Example, "East"\nApartments';
 const p=run('\uFEFFsep='+delimiter+'\r\n'+csv(headers,[v],delimiter)); assert.equal(p.canImport,true);assert.equal(p.rows[0].propertyName,v[1]);
});
test('CR and CRLF line endings parse without dropping rows',()=>{for(const eol of ['\r','\r\n']) assert.equal(run(csv().replaceAll('\n',eol)).canImport,true);});
test('leading blank lines, BOM and invisible header characters are tolerated',()=>{const h=[...headers];h[0]='\u200BProperty ID';assert.equal(run('\uFEFF\n\n'+csv(h)).canImport,true);});
test('short or long rows, unclosed quotes, invalid quotes, UTF-16 are rejected',()=>{
 for(const text of [csv(headers,[values.slice(1)]),csv(headers,[[...values,'extra']]),headers.join(',')+'\n"unclosed',headers.join(',')+'\n"a"b',csv()+'\0']) assert.throws(()=>read(text));
});
test('missing IDs are never fabricated from a property name or row position',()=>{const v=[...values];v[0]=''; assert.equal(run(csv(headers,[v])).canImport,false);});
test('separate first/middle/last name is combined without losing original components',()=>{
 const p=run(csv([...headers,'Tenant Middle Initial'],[[...values,'Q.']])); assert.equal(p.rows[0].householdName,'Ada Q. Example');
});
test('supplied full household name takes precedence over name components',()=>{
 const p=run(csv([...headers,'Resident Name'],[[...values,'Example Household']])); assert.equal(p.rows[0].householdName,'Example Household');
});
test('each property with missing state needs its own state; valid supplied file states are not overwritten',()=>{
 const other=[...values];other[0]='P-002';other[1]='Other Apartments';other[6]='T-002';
 assert.equal(run(csv(headers,[values,other])).stateNeeded[0].id,'P-002');
 const p=run(csv([...headers,'state'],[[...values,'CA']]),{stateByPropertyId:{'P-001':'TN'}}); assert.equal(p.rows[0].state,'CA');assert.equal(p.rows[0].sourceData.suppliedState,null);
 assert.equal(run(csv([...headers,'state'],[[...values,'XX']])).canImport,false);
});
test('ISO invalid calendar dates and ambiguous dates fail until explicit date order is selected',()=>{
 const v=[...values];v[10]='2025-02-29';assert.equal(run(csv(headers,[v])).canImport,false);
 v[10]='03/04/2025';assert.equal(run(csv(headers,[v])).canImport,false);
 const options={stateByPropertyId:{'P-001':'TN'}};
 assert.equal(run(csv(headers,[v]),{...options,dateOrder:'MDY'}).rows[0].moveInDate,'2025-03-04');
 assert.equal(run(csv(headers,[v]),{...options,dateOrder:'DMY'}).rows[0].moveInDate,'2025-04-03');
});
test('conflicting property, unit, and tenant identities are blocked before database writes',()=>{
 for(const [index,value] of [[1,'Other Property'],[3,'Different Unit'],[7,'Different Tenant']]){
  const v=[...values];v[index]=value; const p=run(csv(headers,[values,v]));assert.equal(p.canImport,false);assert.match(p.issues.join(' '),/conflicting/);
 }
});
test('optional certification synonyms are deterministic and unknown categories are not relabeled',()=>{
 let p=run(csv([...headers,'Cert Type','Programs'],[[...values,'Recertification','LIHTC|HOME']]));assert.equal(p.rows[0].certificationType,'ANNUAL');assert.deepEqual(p.rows[0].programCodes,['LIHTC','HOME']);
 p=run(csv([...headers,'Cert Type'],[[...values,'OTHER']]));assert.equal(p.canImport,false);
});
test('unknown source details and duplicate headings are preserved by column position',()=>{
 const p=run(csv([...headers,'custom','custom'],[[...values,'a','b']]));assert.equal(p.canImport,true);assert.deepEqual(p.rows[0].sourceData.columns.slice(-2).map(c=>c.value),['a','b']);
});
test('too-large files, too-many columns and too-many rows fail safely',()=>{
 assert.throws(()=>read('x'.repeat(api.ONBOARDING_MAX_BYTES+1)),/10 MB/);
 assert.throws(()=>read(csv(Array.from({length:201},(_,i)=>`c${i}`),[Array(201).fill('x')])),/200 columns/);
 assert.throws(()=>read(csv(headers,Array.from({length:5001},()=>values))),/5,000/);
});
if(process.env.PORTFOLIO_CSV_ACCEPTANCE_FILE) test('actual supplied 833-record file parses unchanged with an explicit test-only state',()=>{
 const text=readFileSync(process.env.PORTFOLIO_CSV_ACCEPTANCE_FILE,'utf8'),table=read(text),mapping=suggest(table.headers).mapping;
 const missing=preview(table,mapping);assert.equal(missing.issues.length,0);assert.equal(missing.stateNeeded.length,1);
 const options={stateByPropertyId:Object.fromEntries(missing.stateNeeded.map(p=>[p.id,'TN']))};
 const result=preview(table,mapping,options);assert.equal(result.canImport,true);assert.deepEqual(result.counts,{properties:1,units:833,tenants:833});
 assert.equal(result.rows.length,833);assert.equal(result.rows[0].householdName,'TestFirst0001 TestLast0001');assert.equal(result.rows[832].tenantExternalId,'TENANT-000833');
 assert.ok(result.rows.every(r=>r.certificationType===undefined&&r.programCodes.length===0));
});

const storage = await import(`data:text/javascript;base64,${Buffer.from(compile('portfolio-onboarding-storage')).toString('base64')}`);
class FakeDb {
 constructor(){this.tables=new Map();this.calls=[];this.sequence=0;this.failTable=null;this.truncateTable=null;}
 from(table){
  const db=this;if(!db.tables.has(table))db.tables.set(table,[]);const all=db.tables.get(table);
  return {
   insert(row){db.calls.push({table,action:'insert',row});const saved={...row,id:`id-${++db.sequence}`};all.push(saved);return {select(){return {async single(){return {data:saved,error:null};}};}};},
   upsert(batch,options){
    db.calls.push({table,action:'upsert',batch,options});
    return {async select(){
     if(db.failTable===table)return {data:null,error:new Error('simulated database failure')};
     const fields=options.onConflict.split(',');
     const saved=batch.map(row=>{const old=all.find(candidate=>fields.every(k=>candidate[k]===row[k]));if(old){Object.assign(old,row);return {...old};}const added={id:`id-${++db.sequence}`,...row};all.push(added);return {...added};});
     return {data:db.truncateTable===table?saved.slice(1):saved,error:null};
    }};
   },
   update(patch){const filters=[];const chain={eq(key,value){filters.push([key,value]);return chain;},then(resolve,reject){try {for(const row of all)if(filters.every(([k,v])=>row[k]===v))Object.assign(row,patch);db.calls.push({table,action:'update',patch,filters});return Promise.resolve({error:null}).then(resolve,reject);}catch(e){return Promise.reject(e).then(resolve,reject);}}};return chain;}
  };
 }
}
test('storage writes all 833 linked profiles in bounded, owner-scoped batches; no certifications are created',async()=>{
 const rows=Array.from({length:833},(_,i)=>values.map((v,k)=>k===2?`U-${i}`:k===3?`${i}`:k===6?`T-${i}`:v));const result=run(csv(headers,rows));const db=new FakeDb();
 const saved=await storage.persistPortfolioOnboarding(db,'user-a',result.rows,'example.csv');assert.deepEqual([saved.propertyCount,saved.unitCount,saved.tenantCount],[1,833,833]);
 assert.deepEqual([...db.tables.keys()].sort(),['certification_import_jobs','portfolio_properties','portfolio_tenant_profiles','portfolio_units'].sort());
 assert.ok(db.calls.filter(c=>c.action==='upsert').every(c=>c.batch.length<=200&&c.batch.every(r=>r.user_id==='user-a')));
 for(const t of db.tables.get('portfolio_tenant_profiles'))assert.ok(db.tables.get('portfolio_units').some(u=>u.id===t.unit_id&&u.property_id===t.property_id));
 assert.equal(db.tables.get('certification_import_jobs')[0].status,'completed');
 await storage.persistPortfolioOnboarding(db,'user-a',result.rows,'example.csv');assert.equal(db.tables.get('portfolio_tenant_profiles').length,833);assert.equal(db.tables.get('portfolio_units').length,833);
});
test('sparse onboarding re-import preserves existing certification, programs, address and bedroom values',async()=>{
 const rich=run(csv([...headers,'Cert Type','Programs','Property Address'],[[...values,'ANNUAL','HOME','12 Example St']])).rows;
 const db=new FakeDb();await storage.persistPortfolioOnboarding(db,'user-a',rich,'rich.csv');
 const sparse=run().rows;sparse[0].bedrooms=undefined;sparse[0].moveInDate=undefined;
 await storage.persistPortfolioOnboarding(db,'user-a',sparse,'sparse.csv');
 const tenant=db.tables.get('portfolio_tenant_profiles')[0];assert.equal(tenant.certification_type,'ANNUAL');assert.deepEqual(tenant.program_codes,['HOME']);assert.equal(tenant.move_in_date,'2024-02-29');
 assert.equal(db.tables.get('portfolio_properties')[0].address_line1,'12 Example St');assert.equal(db.tables.get('portfolio_units')[0].bedrooms,0);
});
test('mixed sparse data never puts different column-key sets in the same upsert batch',async()=>{
 const v=[...values];v[2]='U-2';v[3]='002';v[5]='';v[6]='T-2';v[10]='';const p=run(csv(headers,[values,v])),db=new FakeDb();
 await storage.persistPortfolioOnboarding(db,'user-a',p.rows,'example.csv');
 for(const call of db.calls.filter(c=>c.action==='upsert')){assert.equal(new Set(call.batch.map(r=>Object.keys(r).sort().join('|'))).size,1);assert.equal(call.options.defaultToNull,false);}
});
test('database failure is marked partial and safe retry retains stable identities',async()=>{
 const db=new FakeDb(),rows=run().rows;db.failTable='portfolio_units';
 await assert.rejects(storage.persistPortfolioOnboarding(db,'user-a',rows,'example.csv'),/Some records may have been saved/);
 assert.equal(db.tables.get('certification_import_jobs')[0].status,'partial');assert.equal(db.tables.get('portfolio_properties').length,1);
 db.failTable=null;await storage.persistPortfolioOnboarding(db,'user-a',rows,'example.csv');assert.equal(db.tables.get('portfolio_properties').length,1);assert.equal(db.tables.get('portfolio_tenant_profiles').length,1);
});
test('incomplete returned row counts cannot be reported as import success',async()=>{
 const db=new FakeDb();db.truncateTable='portfolio_units';await assert.rejects(storage.persistPortfolioOnboarding(db,'user-a',run().rows,'example.csv'),/row count could not be verified/);assert.equal(db.tables.get('certification_import_jobs')[0].status,'partial');
});
test('server revalidates CSV and keeps authentication and mass-subscription checks before persistence',()=>{
 const s=readFileSync(new URL('../src/lib/portfolio-onboarding.functions.ts',import.meta.url),'utf8');
 assert.match(s,/middleware\(\[requireSupabaseAuth\]\)/);assert.match(s,/readOnboardingCsv\(data\.text\)/);assert.match(s,/if \(!result\.canImport\)/);assert.match(s,/has_active_subscription/);
 assert.ok(s.indexOf('if (!result.canImport)')<s.indexOf('return persistPortfolioOnboarding'));assert.match(s,/context\.supabase, context\.userId, result\.rows/);
});
