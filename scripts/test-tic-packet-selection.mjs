import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';

const asModule = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const sourceModule = file => pathToFileURL(resolve(file)).href;
function compile(file, bindings = {}) {
  let code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [key, value] of Object.entries(bindings)) code = code.split(key).join(value);
  return asModule(code);
}
const registry = compile('src/lib/tic-field-registry.ts');
const documents = compile('src/lib/tic-supporting-document-registry.ts');
const layout = sourceModule('src/lib/tic-document-layout.mjs');
const classifier = compile('src/lib/tic-packet-classifier.ts', { '@/lib/tic-document-layout.mjs': layout, '@/lib/tic-supporting-document-registry': documents });
const selectionUrl = compile('src/lib/tic-packet-selection.ts', { '@/lib/tic-packet-classifier': classifier, '@/lib/tic-supporting-document-registry': documents });
const selection = await import(selectionUrl);
const extractionUrl = compile('src/lib/tic-field-extraction.ts', { '@/lib/tic-document-layout.mjs': layout, '@/lib/tic-field-registry': registry });
const { extractTicFieldsFromText } = await import(extractionUrl);
const { isTicContent } = await import(layout);
const { extractTicSpatialValueLines } = await import('../src/lib/tic-spatial-extraction.mjs');
const sha = 'a'.repeat(64);
const tic = 'TENANT INCOME CERTIFICATION\nPART I DEVELOPMENT DATA\nPART II HOUSEHOLD COMPOSITION\n__CERTIVOIQ_TIC_FIELD__ property_name: Correct property\n__CERTIVOIQ_TIC_FIELD__ household_member_1_last_name: TEST\n__CERTIVOIQ_TIC_FIELD__ household_member_1_first_name_middle_initial: PERSON A\n__CERTIVOIQ_TIC_FIELD__ certification_type: Recertification';
const pages = [
  { page: 1, text: 'Cover page\nTenant Income Certification enclosed\n__CERTIVOIQ_TIC_FIELD__ property_name: WRONG COVER VALUE' },
  { page: 2, text: 'Instructions for completing the Tenant Income Certification\nPART I DEVELOPMENT DATA\nPART II HOUSEHOLD COMPOSITION' },
  { page: 3, text: 'Review Summary\nSample Findings\nProperty Name: OLD PROPERTY' },
  { page: 4, text: tic },
  { page: 5, text: 'PART VI DETERMINATION OF INCOME ELIGIBILITY\nPART VII RENT\nTenant paid rent: 500' },
  { page: 6, text: 'Earnings Statement\nGross Pay: 1000 Net Pay: 800' },
  { page: 7, text: 'Bank Statement\nClosing balance: 250\nReference: Tenant Income Certification' },
  { page: 8, text: '' },
];
const inventory = selection.packetInventory(pages);
const choices = inventory.map(p => ({ page: p.page, role: p.kind === 'tic' ? 'tic_page' : p.page === 6 ? 'check_stub' : p.page === 7 ? 'bank_statement' : 'omit', reason: p.kind === 'tic' || [6,7].includes(p.page) ? '' : 'Cover, instructions, administrative or blank page' }));

test('TIC detected after cover, instructions and review notes', () => {
  assert.deepEqual(inventory.filter(p => p.kind === 'tic').map(p => p.page), [4,5]);
});
test('supporting and administrative pages are pending until explicitly chosen', () => {
  const defaults = selection.initialPageChoices(inventory);
  assert.deepEqual(defaults.filter(p => p.role === 'pending').map(p => p.page), [1,2,3,6,7,8]);
});
test('incidental TIC mentions do not make a cover or bank statement the TIC', () => {
  assert.equal(isTicContent(pages[0].text), false);
  assert.equal(isTicContent(pages[6].text), false);
  assert.equal(inventory[6].documentType, 'bank_statement');
});
test('only selected TIC pages populate fields; original physical page numbers survive', () => {
  const manifest = selection.buildPacketSelection(pages, choices, sha);
  const text = selection.selectedTicText(pages, manifest);
  const facts = extractTicFieldsFromText(text, 'synthetic.pdf').facts;
  assert.equal(facts.find(f => f.field === 'property_name').value, 'Correct property');
  assert.equal(facts.find(f => f.field === 'property_name').page, 4);
  assert.equal(facts.find(f => f.field === 'certification_type').value, 'Recertification');
  assert.equal(text.includes('WRONG COVER VALUE'), false);
  assert.equal(text.includes('Gross Pay:'), false);
});
test('selected supports alone create page records; omitted page gaps cannot be merged back', () => {
  const manifest = selection.buildPacketSelection(pages, choices, sha);
  assert.deepEqual(selection.selectedSupportingPages(manifest, inventory).map(d => d.pageNumbers), [[6],[7]]);
  assert.deepEqual(manifest.omittedPages, [1,2,3,8]);
  assert.equal(pages[0].text.includes('WRONG COVER VALUE'), true);
});
test('user can reclassify a missed page as TIC and rebuild extraction from that selection', () => {
  const missed = [{ page: 1, text: '__CERTIVOIQ_TIC_FIELD__ property_name: Manual page selection' }];
  assert.equal(selection.initialPageChoices(selection.packetInventory(missed))[0].role, 'pending');
  const manifest = selection.buildPacketSelection(missed, [{ page:1, role:'tic_page', reason:'' }], sha);
  assert.match(selection.selectedTicText(missed, manifest), /Manual page selection/);
});
for (const [name, modified] of [
  ['missing page', choices.slice(1)], ['duplicate page', [...choices.slice(0,-1), choices[0]]],
  ['out of range', [...choices.slice(0,-1), { page: 9, role:'omit', reason:'x' }]],
  ['unresolved page', choices.map(c => c.page === 6 ? { ...c, role:'pending' } : c)],
  ['no TIC', choices.map(c => c.role === 'tic_page' ? { ...c, role:'omit', reason:'x' } : c)],
  ['missing omission reason', choices.map(c => c.page === 1 ? { ...c, reason:'' } : c)],
  ['invented role', choices.map(c => c.page === 6 ? { ...c, role:'verified_income' } : c)],
]) test(`reject ${name}`, () => assert.throws(() => selection.buildPacketSelection(pages, modified, sha)));

test('selection history must match the source hash and recomputes derived page lists', () => {
  const manifest = selection.buildPacketSelection(pages, choices, sha);
  const restored = selection.selectionFromHistory([{ packet_selection: { ...manifest, ticPages:[1] } }], sha);
  assert.deepEqual(restored.ticPages, [4,5]);
  assert.throws(() => selection.selectionFromHistory([{ packet_selection: manifest }], 'b'.repeat(64)));
  assert.throws(() => selection.selectionFromHistory([{ packet_selection: null }], sha));
});

test('a blank redacted last column does not shift household names into neighboring cells', () => {
  const line = (text,y, tokens) => ({ text, bbox:{x0:20,y0:y,x1:980,y1:y+20}, words:tokens.map(([text,x,w=50]) => ({text,bbox:{x0:x,y0:y,x1:x+w,y1:y+20}})) });
  const lines = [line('TENANT INCOME CERTIFICATION',20,[['TENANT INCOME CERTIFICATION',200,500]]), line('PART II HOUSEHOLD COMPOSITION',150,[['PART II HOUSEHOLD COMPOSITION',250,500]]),
    line('Last Name First Name Relationship Date of Birth Student Social Security',190,[['Last Name',120,90],['First Name',315,100],['Relationship',480,100],['Date of Birth',660,95],['Student',805,60],['Social Security',900,80]]),
    line('1 TEST PERSON A H 01/01/1980 N',230,[['1',40,10],['TEST',125,50],['PERSON',330,60],['A',395,10],['H',520,10],['01/01/1980',675,85],['N',830,10]]),
    line('PART III GROSS ANNUAL INCOME',360,[['PART III GROSS ANNUAL INCOME',250,500]])];
  const result = extractTicSpatialValueLines([{paragraphs:[{lines}]}],1000,1000).join('\n');
  assert.match(result,/household_member_1_last_name: TEST/);
  assert.match(result,/household_member_1_first_name_middle_initial: PERSON A/);
  assert.doesNotMatch(result,/ssn_or_alien_registration:/);
});

// Invoke the actual intake handlers against an in-memory boundary. No external account,
// database, auth setting, storage object or production evidence is touched by these tests.
const api = asModule(`export function createServerFn(){let validate=x=>x; return {middleware(){return this},inputValidator(fn){validate=fn;return this},handler(fn){return async ({data,context})=>fn({data:validate(data),context})}}}`);
const auth = asModule('export const requireSupabaseAuth = {};');
const boundary = asModule('export const supabaseAdmin = globalThis.__packetTestDb;');
const rawExtraction = asModule('export const sidecarPathFor = p => p + ".ocr.json";');
const manifestUrl = compile('src/lib/complianceDecisionAndManifest.ts');
const { sha256Hex, hashJson } = await import(manifestUrl);
const original = new TextEncoder().encode('synthetic-original-bytes');
const realSha = await sha256Hex(original.buffer);
const owner='11111111-1111-4111-8111-111111111111';
const tenantId='22222222-2222-4222-8222-222222222222';
const source={jobId:'packet-job',storagePath:`${owner}/packet-job/synthetic.pdf`,originalFileName:'synthetic.pdf',mimeType:'application/pdf',sizeBytes:original.byteLength,sha256:realSha};
const saved = [];
const db={
  from(table) { let operation='select', payload;const q={select(){return q},eq(){return q},order(){return q},limit(){return q},update(value){operation='update';payload=value;return q},delete(){operation='delete';return q},insert(value){operation='insert';payload=value;return q},
    maybeSingle:async()=>({data:table==='certification_import_jobs'?{id:'packet-job',status:'processing'}:{id:tenantId,property_id:'property',unit_id:'unit',program_codes:['LIHTC'],portfolio_properties:{jurisdiction:'GA'}},error:null}),
    single:async()=>{saved.push({table,operation,payload});return {data:{id:'saved-item'},error:null}},
    then(resolve){if(operation!=='select') saved.push({table,operation,payload});return Promise.resolve({data:[],error:null}).then(resolve)}};return q;},
  storage:{from(){return {download:async path=>({data:path.endsWith('.ocr.json') ? new Blob([JSON.stringify({schemaVersion:'2.0',sourceFileName:source.originalFileName,sourceSha256:realSha,sourceByteSize:original.byteLength,createdAt:'2026-09-06T00:00:00Z',pageCount:pages.length,truncated:false,pages:pages.filter(p=>p.text).map(p=>({...p,source:'text',engine:null,ocrConfidence:null}))})]) : new Blob([original]),error:null}),createSignedUrl:async()=>({data:{signedUrl:'https://example.invalid/source'},error:null})}}},
};
globalThis.__packetTestDb=db;
const serverUrl = compile('src/utils/tic-certification-intake.functions.ts', {
  '@tanstack/react-start':api, '@/integrations/supabase/auth-middleware':auth, '@/integrations/supabase/client.server':boundary,
  '@/lib/preview-evidence-value':compile('src/lib/preview-evidence-value.ts'), '@/lib/tic-field-registry':registry,
  '@/lib/tic-supporting-document-registry':documents, '@/lib/ocr-sidecar.mjs':sourceModule('src/lib/ocr-sidecar.mjs'),
  '@/lib/tic-packet-selection':selectionUrl, '@/lib/certification-extraction.server':rawExtraction,
  '@/lib/tic-field-extraction':extractionUrl, '@/lib/complianceDecisionAndManifest':manifestUrl,
});
const {extractCertificationTicPreview,confirmCertificationTicPreview}=await import(serverUrl);
const context={supabase:db,userId:owner};
test('actual preview handler inventories all pages including blank, without premature fields',async()=>{
 const result=await extractCertificationTicPreview({data:{source},context});
 assert.equal(result.error,undefined);assert.equal(result.pageClassifications.length,8);assert.equal(result.facts.length,0);assert.equal(result.selectionDigest,null);
});
test('actual preview handler filters selected TIC fields, and selection digest changes on omission',async()=>{
 const result=await extractCertificationTicPreview({data:{source,pageSelections:choices},context});
 assert.equal(result.error,undefined);assert.equal(result.facts.find(f=>f.field==='property_name').value,'Correct property');assert.deepEqual(result.ticPages,[4,5]);
 const changed=choices.map(c=>c.page===6?{...c,role:'omit',reason:'Unrelated employer'}:c);
 const second=await extractCertificationTicPreview({data:{source,pageSelections:changed},context});
 assert.notEqual(result.selectionDigest,second.selectionDigest);assert.equal(second.supportingDocuments.length,1);
});
test('actual save rejects stale selection digest before any record insert',async()=>{
 const before=saved.length;
 await assert.rejects(()=>confirmCertificationTicPreview({data:{source,fields:[],tenantProfileId:tenantId,pageSelections:choices,selectionDigest:'0'.repeat(64)},context}),/no longer match/);
 assert.equal(saved.length,before);
});
test('actual save preserves omission manifest and only creates explicitly included supports',async()=>{
 const preview=await extractCertificationTicPreview({data:{source,pageSelections:choices},context});
 const result=await confirmCertificationTicPreview({data:{source,fields:preview.facts.map(f=>({field:f.field,value:f.value})),tenantProfileId:tenantId,pageSelections:choices,selectionDigest:preview.selectionDigest,startReview:true},context});
 assert.equal(result.omittedPageCount,4);assert.equal(result.supportingDocumentCount,2);assert.equal(result.queuedForReview,true);
 const item=saved.find(e=>e.table==='certification_import_items'&&e.operation==='insert').payload;
 assert.equal(item.certification_type,'ANNUAL');assert.deepEqual(item.historical_changes[0].packet_selection.omittedPages,[1,2,3,8]);
 const supports=saved.find(e=>e.table==='portfolio_tenant_documents'&&e.operation==='insert').payload;
 assert.deepEqual(supports.map(d=>d.source_page_numbers),[[6],[7]]);
 assert.ok(supports.every(d=>d.sha256===realSha));
});
test('changing the source storage owner is rejected',async()=>{
 const result=await extractCertificationTicPreview({data:{source:{...source,storagePath:'someone-else/packet-job/synthetic.pdf'}},context});
 assert.match(result.error,/does not belong/);
});
