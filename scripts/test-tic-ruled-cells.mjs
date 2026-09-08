import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import ts from 'typescript';
import {planTicCells, finishTicCells, mergeCellProposals, rasterMask} from '../src/lib/tic-ruled-cell-extraction.mjs';
const box={x0:10,y0:10,x1:120,y1:35};
const word=(text,confidence=95,x0=150)=>({text,confidence,bbox:{x0,x1:x0+60,y0:25,y1:48}});
const blocks=words=>[{paragraphs:[{lines:[{words,bbox:box,text:words.map(w=>w.text).join(' ')}]}]}];
function fixture(key='unit_number',type='text',sourceWords=[]){const cell={key,type,bbox:box,ink:true,sourceWords};return{plan:{version:1,width:600,height:800,cells:[cell],groups:[],blocked:[],checkboxes:null},sheet:{width:940,height:90,tiles:[{...cell,x:148,y:24,width:120,height:30,scale:1}]}};}
const asModule=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
function compile(file,bindings={}){let code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;for(const[k,v]of Object.entries(bindings))code=code.split(k).join(v);return asModule(code);}
import {load} from './helpers/load-typescript.mjs';
const {extractTicFieldsFromText}=await import(load('src/lib/tic-field-extraction.ts'));
test('a blank raster never invents TIC cells or certification choices',()=>{const image={width:600,height:800,data:new Uint8ClampedArray(600*800*4).fill(255)};const plan=planTicCells(image,[]);assert.equal(plan.cells.length,0);assert.equal(plan.checkboxes,null);});
test('malformed and unbounded pixel buffers are rejected',()=>{assert.throws(()=>rasterMask({width:600,height:800,data:new Uint8Array(4)}));assert.throws(()=>rasterMask({width:9000,height:9000,data:new Uint8Array(4)}));});
test('neutral synthetic Value label is excluded from source values',()=>{const {plan,sheet}=fixture();const got=finishTicCells(plan,sheet,blocks([word('Value:',95,24),word('407')]));assert.equal(got.values.unit_number,'407');assert.equal(got.evidence.unit_number.method,'isolated-cell');});
test('a missing single glyph can use an explicit original word from the same cell',()=>{const {plan,sheet}=fixture('unit_bedrooms','number',[word('3',93)]);const got=finishTicCells(plan,sheet,blocks([word('Value:',95,24)]));assert.equal(got.values.unit_bedrooms,'3');assert.equal(got.evidence.unit_bedrooms.method,'bounded-page-word');});
test('unreadable member glyphs are not repaired into a member number',()=>{const {plan,sheet}=fixture('income_member_1_household_member_number','number',[word('|',95)]);const got=finishTicCells(plan,sheet,blocks([word(']',95)]));assert.equal(got.values.income_member_1_household_member_number,undefined);assert.ok(got.unresolved.includes('income_member_1_household_member_number'));});
test('ambiguous currency is not silently rounded or corrected',()=>{const {plan,sheet}=fixture('total_income_e','currency');const got=finishTicCells(plan,sheet,blocks([word('4,123.456')]));assert.equal(got.values.total_income_e,undefined);});
test('strict bounded mode excludes loose spatial guesses instead of preserving contamination',()=>{const lines=mergeCellProposals(['__CERTIVOIQ_TIC_FIELD__ household_size_at_move_in: 140'],['__CERTIVOIQ_TIC_CELL_MODE__: strict','__CERTIVOIQ_TIC_FIELD__ unit_number: 407']);assert.equal(lines.length,2);assert.ok(!lines.join('\n').includes('140'));});
test('strict selected page cannot acquire a value from a following label or boilerplate',()=>{const got=extractTicFieldsFromText('page 3\n__CERTIVOIQ_TIC_CELL_MODE__: strict\nHousehold Size at Move-in:\nHousehold Income exceeds 140%\nSIGNATURE OF OWNER/REPRESENTATIVE\nBased on the representations herein\n__CERTIVOIQ_TIC_FIELD__ unit_number: 407','synthetic.pdf');assert.deepEqual(got.facts.map(f=>f.field),['unit_number']);});
test('redaction overrides direct and generic values, not just spatial guesses',()=>{const got=extractTicFieldsFromText('page 3\nProperty Name: unwanted\n__CERTIVOIQ_TIC_FIELD__ property_name: unwanted\n__CERTIVOIQ_TIC_UNRESOLVED__ property_name: redacted','synthetic.pdf');assert.equal(got.facts.find(f=>f.field==='property_name'),undefined);});
test('cell bounding box and confidence survive while source remains unverified',()=>{const got=extractTicFieldsFromText('page 3\n__CERTIVOIQ_TIC_FIELD__ unit_number: 407\n__CERTIVOIQ_TIC_CELL__ unit_number: '+JSON.stringify({bbox:box,confidence:.74,method:'isolated-cell'}),'synthetic.pdf');assert.equal(got.facts[0].confidence,.74);assert.equal(got.facts[0].humanVerified,false);assert.match(got.facts[0].snippet,/10,10,120,35/);});
test('conflicting checkbox marks do not default to initial certification',()=>{const {plan,sheet}=fixture();plan.checkboxes={selected:null,candidates:[]};const got=finishTicCells(plan,sheet,[]);assert.equal(got.values.certification_type,undefined);assert.ok(got.unresolved.includes('certification_type'));});
