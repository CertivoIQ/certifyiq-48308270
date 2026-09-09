import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pdfImageDecodeOptions,assertRenderedPdfImages,pdfOcrViewport} from '../src/lib/pdf-render-integrity.mjs';
import {findTicLabelForKey,findTicLabels} from '../src/lib/tic-label-matching.mjs';
import {worksheetFieldType} from '../src/lib/tic-worksheet-types.mjs';
import {planTicCells,finishTicCells,confirmWorksheetNumbers} from '../src/lib/tic-ruled-cell-extraction.mjs';
import {load} from './helpers/load-typescript.mjs';
const {extractTicFieldsFromText}=await import(load('src/lib/tic-field-extraction.ts'));
const {TIC_FIELD_BY_KEY}=await import(load('src/lib/tic-field-registry.ts'));
const ops={paintImageXObject:85,paintImageXObjectRepeat:88};
function page(value,op=85,resource='img_1'){const objects=new Map([[resource,value]]);return{pageNumber:4,objs:objects,commonObjs:objects,getOperatorList:async()=>({fnArray:[op],argsArray:[[resource]]})};}
test('scan decoders are version matched and decode failures reject instead of becoming blank pages',async()=>{
 assert.deepEqual(pdfImageDecodeOptions('6.2.108','https://example.com'),{wasmUrl:'https://example.com/pdfjs/6.2.108/wasm/',stopAtErrors:true});
 assert.throws(()=>pdfImageDecodeOptions('../bad','https://example.com'));
 await assert.rejects(assertRenderedPdfImages(page(null),ops),/page 4/);
 await assert.rejects(assertRenderedPdfImages(page(null,88,'g_shared'),ops),/not been treated as blank/);
 await assertRenderedPdfImages(page({width:1700,height:2200}),ops);
 await assertRenderedPdfImages(page(null,1),ops);
 const source=readFileSync('src/lib/pdf-ocr.ts','utf8');
 assert.ok(source.indexOf('await assertRenderedPdfImages(page, pdfjs.OPS)')<source.indexOf('if (looksVisuallyBlank(canvas))'));
});
test('one damaged long label word is recognized without changing digits or confusing nearby destinations',()=>{
 assert.equal(findTicLabelForKey('Curent Income Limit per Family Size: 29,100.00','applicable_lihtc_income_limit')?.key,'applicable_lihtc_income_limit');
 assert.equal(findTicLabelForKey('Currant Income Limit per Family Size:','applicable_lihtc_income_limit')?.key,'applicable_lihtc_income_limit');
 assert.equal(findTicLabels('Household Member 2 Birth Date: 01/02/2000',[{key:'one',aliases:['Household Member 1 Birth Date']}]).length,0);
});
test('a misread money separator proposes a bounded crop, never a repaired value',()=>{
 const width=1200,height=1600,data=new Uint8ClampedArray(width*height*4).fill(255);
 const words=[{text:'Curent Income Limit per Family Size:',confidence:85,bbox:{x0:80,x1:410,y0:410,y1:430}},{text:'29.100.00',confidence:82,bbox:{x0:480,x1:570,y0:392,y1:412}}];
 const blocks=[{paragraphs:[{lines:words.map(w=>({text:w.text,words:[w],bbox:w.bbox}))}]}];
 const plan=planTicCells({width,height,data},blocks),cell=plan.cells.find(c=>c.key==='applicable_lihtc_income_limit');
 assert.ok(cell);assert.equal(cell.sourceWords[0].text,'29.100.00');
 assert.equal(finishTicCells(plan,{width:940,height:90,tiles:[]},[]).values.applicable_lihtc_income_limit,undefined);
});
test('worksheet numeric cells keep their types and reject corrupted numeric strings',()=>{
 for(const key of ['worksheet_total_asset_cash_value','worksheet_asset_1_market_value','worksheet_asset_1_divest_cost']){
  assert.equal(worksheetFieldType(key),'currency');assert.equal(TIC_FIELD_BY_KEY.get(key).type,'currency');
  const facts=extractTicFieldsFromText(`page 5\n__CERTIVOIQ_TIC_FIELD__ ${key}: $520.9)`,'synthetic.pdf').facts;
  assert.equal(facts.length,0);
 }
 const result=extractTicFieldsFromText('page 5\n__CERTIVOIQ_TIC_FIELD__ worksheet_total_actual_income: 0.00\n__CERTIVOIQ_TIC_FIELD__ worksheet_passbook_rate_percent: 0.06%','synthetic.pdf');
 assert.deepEqual(result.facts.map(f=>f.value),[0,.06]);assert.ok(result.facts.every(f=>f.page===5&&!f.humanVerified));
});
test('worksheet amount confirmation preserves zero and removes missing or disagreeing second reads',()=>{
 const key='worksheet_total_actual_income',result={values:{[key]:'0.00'},lines:[`__CERTIVOIQ_TIC_FIELD__ ${key}: 0.00`,`__CERTIVOIQ_TIC_CELL__ ${key}: {}`]},plan={cells:[{key,type:'currency'}]};
 assert.deepEqual(confirmWorksheetNumbers(result,plan,new Map([[key,'0.00']])),result.lines);
 for(const confirmed of [new Map(),new Map([[key,'9.00']])]){
  const lines=confirmWorksheetNumbers(result,plan,confirmed);assert.equal(lines.length,1);assert.match(lines[0],/__CERTIVOIQ_TIC_UNRESOLVED__/);
 }
});
test('plausible financial OCR conflicts cannot replace a different value read in the same source cell',()=>{
 const word=(text,x0=150)=>({text,confidence:95,bbox:{x0,x1:x0+90,y0:25,y1:50}});
 const cell={key:'worksheet_asset_1_market_value',type:'currency',bbox:{x0:1,y0:1,x1:120,y1:35},ink:true,sourceWords:[word('$520.90')]};
 const got=finishTicCells({width:600,height:800,cells:[cell],groups:[],blocked:[],checkboxes:null},{width:940,height:90,tiles:[{...cell,x:148,y:24,width:120,height:32}]},[{paragraphs:[{lines:[{words:[word('4520.90')],bbox:cell.bbox}]}]}]);
 assert.equal(got.values[cell.key],undefined);assert.ok(got.unresolved.includes(cell.key));
});

import {ocrTimeBudgetMs} from '../src/lib/ocr-time-budget.mjs';
test('supported large packets get bounded time proportional to available readers',()=>{
 assert.equal(ocrTimeBudgetMs(3,1),240_000);
 assert.equal(ocrTimeBudgetMs(43,2),660_000);
 assert.equal(ocrTimeBudgetMs(50,1),900_000);
 for(const args of [[0,1],[51,1],[43,0],[43,4],[2.5,1]])assert.throws(()=>ocrTimeBudgetMs(...args));
});

test('strict cell pages cannot acquire form instructions or unconfirmed worksheet values through text fallback',()=>{
 const text='page 4\n__CERTIVOIQ_TIC_CELL_MODE__: strict\nStudent Explanation: *\nMinimum Set Aside: properties use\n__CERTIVOIQ_TIC_FIELD__ tenant_paid_rent: 700.00\npage 5\nAnnual Income Calculation Worksheet\nRelationship Description\n__CERTIVOIQ_TIC_CELL_MODE__: strict\nVariance: ($5,100.00)';
 const result=extractTicFieldsFromText(text,'synthetic.pdf');
 assert.deepEqual(result.facts.map(f=>f.field),['tenant_paid_rent']);
});

test('operator-list image delivery may finish after the operator list resolves',async()=>{
 const objects={has:()=>false,get:(_id,callback)=>setTimeout(()=>callback({width:2500,height:3200}),5)};
 await assertRenderedPdfImages({...page(null),objs:objects},ops,100);
 const failed={has:()=>false,get:(_id,callback)=>setTimeout(()=>callback(null),5)};
 await assert.rejects(assertRenderedPdfImages({...page(null),objs:failed},ops,100),/page 4/);
 const missing={has:()=>false,get:()=>{}};
 await assert.rejects(assertRenderedPdfImages({...page(null),objs:missing},ops,5),/not been treated as blank/);
});
test('mixed and repeated image operators never hide a failed image',async()=>{
 const objects=new Map([['good',{width:100,height:100}],['bad',null]]);
 const mixed={pageNumber:2,objs:objects,commonObjs:objects,getOperatorList:async()=>({fnArray:[85,88,85],argsArray:[['good'],['bad'],['good']]})};
 await assert.rejects(assertRenderedPdfImages(mixed,ops),/page 2/);
});
test('scanner pixel-sized PDF pages use bounded OCR canvases without shrinking normal TIC resolution',()=>{
 const scanner={getViewport:({scale})=>({width:2524*scale,height:3191*scale,scale})};
 const bounded=pdfOcrViewport(scanner,3.5);
 assert.ok(bounded.width*bounded.height<=12_000_001);assert.ok(bounded.height<=4096);
 const letter={getViewport:({scale})=>({width:612*scale,height:792*scale,scale})};
 assert.equal(pdfOcrViewport(letter,3.5).scale,3.5);
 assert.ok(pdfOcrViewport(scanner,2,1700).height<=1700);
});

import {VISION_ENGINE,composeSidecarText,provenanceIndex} from '../src/lib/ocr-sidecar.mjs';
import {validateTranscription} from '../supabase/functions/tic-handwriting/core.mjs';
test('handwritten field proposals keep source page, coordinates and unverified provenance',()=>{
 const result=validateTranscription({fields:[{key:'tenant_paid_rent',value:'675.00',box:[100,100,300,200],uncertain:false},{key:'rent_assistance',value:'0.00',box:[100,250,300,350],uncertain:false}],unreadable:[]},1000,1500);
 const sidecar={schemaVersion:'2.0',sourceFileName:'synthetic.pdf',sourceSha256:'a'.repeat(64),sourceByteSize:100,createdAt:new Date().toISOString(),pageCount:4,preparedPageNumbers:[4],truncated:false,pages:[{page:4,source:'ocr',engine:VISION_ENGINE,ocrConfidence:1,text:result.text}]};
 const composed=composeSidecarText(sidecar);
 assert.equal(composed.provider,'ocr-groq-vision');assert.equal(composed.pages[0].ocrConfidence,.7);
 const extracted=extractTicFieldsFromText(composed.text,'synthetic.pdf',provenanceIndex(composed.pages));
 assert.equal(extracted.provider,'ocr-groq-vision');assert.equal(extracted.facts.length,2);
 assert.ok(extracted.facts.every(f=>f.page===4&&f.confidence<=.7&&!f.humanVerified&&f.provider==='ocr-groq-vision'&&f.snippet.includes('vision-cell-proposal')));
 assert.equal(extracted.facts.find(f=>f.field==='rent_assistance').value,0);
});
