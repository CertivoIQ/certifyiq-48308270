import test from "node:test";
import assert from "node:assert/strict";
import {segmentPages,groundResult} from "./segments.mjs";
test("segmentation preserves every word and correct pages with bounded payloads",()=>{
 const pages=[Array.from({length:1000},(_,i)=>"a"+i).join(" "),Array.from({length:1100},(_,i)=>"b"+i).join(" ")];
 const segments=segmentPages(pages,1000);assert.ok(segments.length>2);
 for(const s of segments)assert.ok(JSON.stringify(s).length<=1002);
 for(let p=1;p<=2;p++)assert.equal(segments.flat().filter(x=>x.page===p).map(x=>x.excerpt).join(" "),pages[p-1]);
});
test("citations are built only from known source IDs, not model quotations",()=>{
 const segment=segmentPages(["Owners must notify every tenant before changing the utility allowance."])[0];
 const result={procedures:[{title:"Notify tenants",summary:"Draft notification procedure",steps:["Notify tenants"],evidence_ids:[segment[0].id],uncertainties:[]}],notes:[]};
 const p=groundResult(result,segment,0)[0];assert.equal(p.citations[0].excerpt,segment[0].excerpt);assert.equal(p.extraction_confidence,0);
 result.procedures[0].evidence_ids=["p99w0"];assert.throws(()=>groundResult(result,segment,0),/CITATION_NOT_IN_SOURCE/);
 result.procedures[0].evidence_ids=[];assert.throws(()=>groundResult(result,segment,0),/CITATION_REQUIRED/);
});
test("blank/scanned pages cannot silently become completed coverage",()=>assert.throws(()=>segmentPages([""]),/PDF_REQUIRES_OCR/));
test("zero-procedure segments are valid without inventing procedures",()=>assert.deepEqual(groundResult({procedures:[],notes:["Table only"]},segmentPages(["This source contains only income limit table data."])[0],0),[]));
