import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {planTicCells} from '../src/lib/tic-ruled-cell-extraction.mjs';
const cache=new Map();
function load(file){
 file=resolve(file);if(cache.has(file))return cache.get(file);
 if(file.endsWith('.mjs'))return pathToFileURL(file).href;
 let code=file.endsWith('.json')?'export default '+readFileSync(file,'utf8'):ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 code=code.replace(/from ["']([^"']+)["']/g,(match,ref)=>{if(!ref.startsWith('.')&&!ref.startsWith('@/'))return match;let p=ref.startsWith('@/')?resolve('src',ref.slice(2)):resolve(dirname(file),ref);if(!extname(p))p+='.ts';return `from ${JSON.stringify(load(p))}`;});
 const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(file,url);return url;
}
const selection=await import(load('src/lib/tic-packet-selection.ts'));
const {extractTicFieldsFromText}=await import(load('src/lib/tic-field-extraction.ts'));
const library=await import(load('src/lib/certification-document-library.ts'));
const registry=await import(load('src/lib/tic-supporting-document-registry.ts'));
test('worksheet percent, dollar limit and accounting variance stay separate',()=>{
 const {facts}=extractTicFieldsFromText('Annual Income Calculation Worksheet\nRelationship Description\nPassbook Rate %: 0.06%\nQualifying Income Limit at 50.00% = $28,950.00 Variance: (3,585.60)','fixture.pdf');
 for(const [key,value] of Object.entries({worksheet_passbook_rate_percent:.06,worksheet_qualifying_income_limit_percent:50,worksheet_qualifying_income_limit:28950,worksheet_variance:-3585.6}))assert.equal(facts.find(f=>f.field===key)?.value,value,key);
});
test('printed percentage options alone cannot establish the checked restriction',()=>{
 const {facts}=extractTicFieldsFromText('TENANT INCOME CERTIFICATION\nUnit Meets Rent Restriction at: 80% 70% 60% 50% 40%','fixture.pdf');
 assert.ok(!facts.some(f=>f.field==='unit_rent_restriction_percent'));
});
test('every state has a separate library and all programs have sourced checklists',()=>{
 assert.equal(library.STATE_DOCUMENT_LIBRARIES.length,51);
 assert.equal(new Set(library.STATE_DOCUMENT_LIBRARIES.map(s=>s.code)).size,51);
 for(const state of library.STATE_DOCUMENT_LIBRARIES){assert.ok(state.agencies.length,state.code);assert.ok(state.agencies.every(a=>a.sources.length));}
 for(const p of Object.keys(library.DOCUMENT_PROGRAMS))assert.ok(library.documentChecklist([p]).length>=10,p);
 for(const d of library.DOCUMENT_REQUIREMENTS)assert.match(d.source,/^https:\/\//);
 assert.equal(library.DOCUMENT_REQUIREMENTS.find(d=>d.id==='vawa-case').category,'Conditional');
});
test('VAWA forms and worksheet are valid choices, without making completed VAWA universal',()=>{
 for(const type of ['vawa_notice','vawa_certification','vawa_emergency_transfer_plan','vawa_emergency_transfer_request','income_calculation_worksheet'])assert.ok(registry.SUPPORTING_DOCUMENT_TYPE_SET.has(type));
 const inventory=selection.packetInventory([{page:1,text:'HUD-5380 Notice of Occupancy Rights under the Violence Against Women Act'},{page:2,text:'Annual Income Calculation Worksheet Relationship Description'}]);
 assert.equal(inventory[0].suggestedRole,'vawa_notice');assert.equal(inventory[1].suggestedRole,'income_calculation_worksheet');
});
test('selected worksheet contributes its own source fields while TIC text excludes it and omitted pages',()=>{
 const pages=[{page:1,text:'TENANT INCOME CERTIFICATION\nTenant Paid Rent: 675.00'},
 {page:2,text:'Annual Income Calculation Worksheet\nRelationship Description\nTotal Asset Cash Value: 520.90\nTotal Actual Income: 0.00\nTotal Annual Income: 25364.40\n__CERTIVOIQ_TIC_FIELD__ household_annual_income: 99999'},
 {page:3,text:'Annual Income Calculation Worksheet\nRelationship Description\nTotal Annual Income: 99999'}];
 const manifest=selection.buildPacketSelection(pages,[{page:1,role:'tic_page',reason:''},{page:2,role:'income_calculation_worksheet',reason:''},{page:3,role:'omit',reason:'Unrelated worksheet'}],'a'.repeat(64));
 assert.ok(!selection.selectedTicText(pages,manifest).includes('99999'));
 const text=selection.selectedWorksheetText(pages,manifest);assert.ok(!text.includes('page 3'));
 const facts=extractTicFieldsFromText(text,'fixture.pdf').facts.filter(f=>f.field.startsWith('worksheet_'));
 assert.equal(facts.find(f=>f.field==='worksheet_total_asset_cash_value').value,520.9);
 assert.equal(facts.find(f=>f.field==='worksheet_total_actual_income').value,0);
 assert.equal(facts.find(f=>f.field==='worksheet_total_annual_income').value,25364.4);
 assert.ok(facts.every(f=>f.page===2&&!f.humanVerified));
});
test('right-aligned rent values in a separate OCR block are matched to their label',()=>{
 const image={width:1200,height:1600,data:new Uint8ClampedArray(1200*1600*4).fill(255)};
 const w=(text,x0,x1,y=400)=>({text,confidence:95,bbox:{x0,x1,y0:y,y1:y+20}});
 const line=words=>({text:words.map(w=>w.text).join(' '),words,bbox:{x0:words[0].bbox.x0,x1:words.at(-1).bbox.x1,y0:words[0].bbox.y0,y1:words[0].bbox.y1}});
 const label=line([w('Tenant',80,140),w('Paid',145,185),w('Rent:',190,240)]);
 const amount=line([w('675.00',550,630)]);
 const blocks=[{paragraphs:[{lines:[label]}]},{paragraphs:[{lines:[amount]}]}];
 const plan=planTicCells(image,blocks);const rent=plan.cells.find(c=>c.key==='tenant_paid_rent');
 assert.ok(rent);assert.equal(rent.sourceWords[0].text,'675.00');
 const ambiguous=planTicCells(image,[...blocks,{paragraphs:[{lines:[line([w('822.00',800,880)])]}]}]);
 assert.ok(!ambiguous.cells.some(c=>c.key==='tenant_paid_rent'));
});
test('student choice requires one marked box; conflicting marks remain unresolved',()=>{
 const width=1200,height=1600,data=new Uint8ClampedArray(width*height*4).fill(255);
 const ink=(x,y)=>{const n=(y*width+x)*4;data[n]=data[n+1]=data[n+2]=0;};
 const square=(x,marked)=>{for(let y=460;y<476;y++)for(let xx=x;xx<x+16;xx++)if(y===460||y===475||xx===x||xx===x+15||(marked&&xx>=x+5&&xx<x+11&&y>=465&&y<471))ink(xx,y);};
 square(180,false);square(280,true);
 const word=(text,x0,x1,y)=>({text,confidence:95,bbox:{x0,x1,y0:y,y1:y+16}});
 const line=words=>({text:words.map(w=>w.text).join(' '),words,bbox:{x0:words[0].bbox.x0,x1:words.at(-1).bbox.x1,y0:words[0].bbox.y0,y1:words[0].bbox.y1}});
 const blocks=[{paragraphs:[{lines:[line([word('Are all occupants full-time students?',80,500,420)]),line([word('Yes',202,240,460),word('No',302,335,460)])]}]}];
 const plan=planTicCells({width,height,data},blocks);
 assert.equal(plan.supplementalValues.all_occupants_full_time_students?.value,'No');
 square(180,true);
 assert.equal(planTicCells({width,height,data},blocks).supplementalValues.all_occupants_full_time_students,undefined);
});
