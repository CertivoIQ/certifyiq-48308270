import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const load = async name => import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64'));
const {readOnboardingCsv:read,suggestOnboardingMapping:suggest,previewOnboarding:preview}=await load('portfolio-onboarding-csv');
const {persistPortfolioOnboarding:persist}=await load('portfolio-onboarding-storage');
const base=['property_external_id','property_name','state','unit_external_id','unit_number','occupancy_status'];
const run=(headers,rows)=>{const table=read([headers,...rows].map(r=>r.join(',')).join('\n'));return preview(table,suggest(headers).mapping);};
test('vacant-only files need no tenant columns and produce zero profiles',()=>{
 const p=run(base,[['P','Example','FL','U1','001','vacant'],['P','Example','FL','U2','002','vacant_ready']]);
 assert.equal(p.canImport,true);assert.deepEqual(p.counts,{properties:1,units:2,tenants:0});assert.ok(p.rows.every(r=>r.isVacant));
});
test('missing tenants without explicit vacancy, partial tenants and contradictory vacancy fail',()=>{
 for(const status of ['occupied','','unknown']) assert.equal(run(base,[['P','Example','FL','U1','001',status]]).canImport,false);
 assert.equal(run([...base,'tenant_external_id'],[['P','Example','FL','U1','001','vacant','T']]).canImport,false);
 assert.equal(run([...base,'tenant_first_name'],[['P','Example','FL','U1','001','vacant','Mira']]).canImport,false);
 assert.equal(run([...base,'certification_type'],[['P','Example','FL','U1','001','vacant','ANNUAL']]).canImport,false);
});
test('same unit cannot be both vacant and occupied in one import',()=>{
 const p=run([...base,'tenant_external_id','household_name'],[['P','Example','FL','U1','001','vacant','',''],['P','Example','FL','U1','001','occupied','T','Name']]);
 assert.equal(p.canImport,false);assert.match(p.issues.join(' '),/conflicting isVacant/);
});
test('exact occupancy header wins over unit-status alias; property postal and program aliases match',()=>{
 const m=suggest(['unit_status','occupancy_status','property_postal_code','program_name']).mapping;
 assert.equal(m.occupancy_status,1);assert.equal(m.postal_code,2);assert.equal(m.program_codes,3);
 assert.equal(suggest(['unit_status','resident_status']).mapping.occupancy_status,null);
});
class Db {
 constructor(){this.tables=new Map();this.id=0;}
 from(name){const db=this;const table=db.tables.get(name)??[];db.tables.set(name,table);return {
  insert(value){const row={...value,id:String(++db.id)};table.push(row);return {select:()=>({single:async()=>({data:row,error:null})})};},
  upsert(rows,{onConflict}){const saved=rows.map(row=>{let existing=table.find(t=>onConflict.split(',').every(k=>t[k]===row[k]));if(existing)Object.assign(existing,row);else{existing={...row,id:String(++db.id)};table.push(existing);}return existing;});return{select:async()=>({data:saved,error:null})};},
  update(){const q={eq:()=>q,then:resolve=>Promise.resolve({error:null}).then(resolve)};return q;}
 };}
}
test('vacant-only persistence creates units and never attempts tenant upsert',async()=>{
 const p=run(base,[['P','Example','FL','U1','001','vacant']]);const db=new Db();
 const result=await persist(db,'owner',p.rows,'vacant.csv');assert.equal(result.unitCount,1);assert.equal(result.tenantCount,0);assert.equal(db.tables.has('portfolio_tenant_profiles'),false);
});
test('vacant re-import preserves tenant assigned since the source snapshot',async()=>{
 const occupied=run([...base,'tenant_external_id','household_name'],[['P','Example','FL','U1','001','occupied','T','Name']]);const vacant=run(base,[['P','Example','FL','U1','001','vacant']]);const db=new Db();
 await persist(db,'owner',occupied.rows,'occupied.csv');await persist(db,'owner',vacant.rows,'older-vacant.csv');
 assert.equal(db.tables.get('portfolio_tenant_profiles').length,1);assert.equal(db.tables.get('portfolio_tenant_profiles')[0].external_id,'T');
});
test('204-unit Maldives Vista CSV saves 192 tenants with Miami ZIP',async()=>{
 const fixture=[
  [...base,'tenant_external_id','household_name','postal_code','city'],
  ...Array.from({length:204},(_,offset)=>{const i=offset+1;return ['P-MV','Maldives Vista','FL',`U-${i}`,String(i),i<=192?'occupied':'vacant',i<=192?`T-${i}`:'',i<=192?`Fictional Household ${i}`:'','33130','Miami'];}),
 ].map(row=>row.join(',')).join('\n');
 const table=read(process.env.MALDIVES_CSV?readFileSync(process.env.MALDIVES_CSV,'utf8'):fixture);const p=preview(table,suggest(table.headers).mapping);
 assert.equal(p.canImport,true,JSON.stringify(p.issues));assert.deepEqual(p.counts,{properties:1,units:204,tenants:192});assert.equal(p.rows.filter(r=>r.isVacant).length,12);
 assert.ok(p.rows.every(r=>r.postalCode==='33130'&&r.city==='Miami'));const db=new Db();const saved=await persist(db,'owner',p.rows,'maldives.csv');
 assert.deepEqual([saved.propertyCount,saved.unitCount,saved.tenantCount],[1,204,192]);
 await persist(db,'owner',p.rows,'maldives.csv');assert.equal(db.tables.get('portfolio_units').length,204);assert.equal(db.tables.get('portfolio_tenant_profiles').length,192);
});
