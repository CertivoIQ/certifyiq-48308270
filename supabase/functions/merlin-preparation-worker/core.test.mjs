import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedSourceUrl,downloadPdf,validateExtraction} from './core.mjs';
test('domain and protocol boundary',()=>{
 assert.equal(allowedSourceUrl('https://www.agency.gov/a.pdf','agency.gov').hostname,'www.agency.gov');
 for(const url of ['http://agency.gov/a','https://agency.gov.evil.org/a','https://127.0.0.1/a','https://u:p@agency.gov/a','https://agency.gov:8443/a'])
  assert.throws(()=>allowedSourceUrl(url,'agency.gov'));
});
test('reject cross-domain redirect without fetching target',async()=>{
 let calls=0;
 await assert.rejects(downloadPdf('https://agency.gov/a','agency.gov',async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://evil.org/a'}});}),/SOURCE_HOST_NOT_ALLOWED/);
 assert.equal(calls,1);
});
test('reject HTML masquerading as PDF',async()=>{
 await assert.rejects(downloadPdf('https://agency.gov/a.pdf','agency.gov',async()=>new Response('<html>blocked</html>',{headers:{'content-type':'application/pdf'}})),/SOURCE_NOT_PDF/);
});
test('accept exact PDF bytes',async()=>{
 const result=await downloadPdf('https://agency.gov/a','agency.gov',async()=>new Response('%PDF-1.7\nfixture'));
 assert.equal(new TextDecoder().decode(result.bytes),'%PDF-1.7\nfixture');
});
test('reject oversize advertised and streamed responses',async()=>{
 await assert.rejects(downloadPdf('https://agency.gov/a','agency.gov',async()=>new Response('',{headers:{'content-length':String(6*1024*1024)}})),/SOURCE_TOO_LARGE/);
 await assert.rejects(downloadPdf('https://agency.gov/a','agency.gov',async()=>new Response(new Uint8Array(6*1024*1024))),/SOURCE_TOO_LARGE/);
});
const procedure=()=>({procedure_key:'verify',category:'review',title:'Verify',summary:'Verify evidence',steps:[],responsible_roles:[],triggering_events:[],required_inputs:[],required_evidence:[],deadlines:[],exceptions:[],ambiguity_flags:[],extraction_confidence:0.9,citations:[{page_or_locator:'1',section:'Review',excerpt:'Verify evidence'}]});
test('validate citations, confidence, duplicates and empty output',()=>{
 const wrap=p=>({procedures:p,document_ambiguity_flags:[]});
 assert.equal(validateExtraction(wrap([procedure()])).procedures.length,1);
 assert.throws(()=>validateExtraction(wrap([])),/EMPTY/);
 assert.throws(()=>validateExtraction(wrap([procedure(),procedure()])),/DUPLICATE/);
 assert.throws(()=>validateExtraction(wrap([{...procedure(),citations:[]}])),/CITATION/);
 assert.throws(()=>validateExtraction(wrap([{...procedure(),extraction_confidence:NaN}])),/CONFIDENCE/);
});
