import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const moduleUrl = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
function compile(file, bindings = {}) {
  let code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [name, url] of Object.entries(bindings)) code = code.split(name).join(url);
  return moduleUrl(code);
}
const registry = compile('src/lib/tic-field-registry.ts');
const core = pathToFileURL(path.resolve('src/lib/tic-cell-repair.mjs')).href;
const bindings = { '@/lib/tic-field-registry': registry, '@/lib/tic-cell-repair.mjs': core };
const { extractTicFieldsFromText } = await import(compile('src/lib/tic-field-extraction.ts', bindings));
const { ticPdfFormValueLinesByPage } = await import(compile('src/lib/tic-pdf-form-values.ts', bindings));
const documents = compile('src/lib/tic-supporting-document-registry.ts');
const { classifyPacketPage } = await import(compile('src/lib/tic-packet-classifier.ts', { ...bindings, '@/lib/tic-supporting-document-registry': documents }));
test('uppercase native checkbox labels preserve canonical certification selection', () => {
  const pages = ticPdfFormValueLinesByPage({ RECERTIFICATION: [{ value: 'Yes', type: 'checkbox', page: 0 }] });
  const text = [...pages].map(([page,lines]) => `Page ${page}\n${lines.join('\n')}`).join('\n');
  assert.equal(extractTicFieldsFromText(text,'SYNTHETIC.pdf').facts.find(item=>item.field==='certification_type')?.value, 'Recertification');
});
test('a mention of TIC inside a bank statement does not convert it into the TIC', () => {
  assert.equal(classifyPacketPage({page: 5, text: 'Bank Statement\nAttached for the tenant income certification\nEnding Balance: 5000'}).documentType, 'bank_statement');
});
test('TIC instructions with an agency header remain outside the TIC', () => {
  assert.notEqual(classifyPacketPage({page: 1, text: 'Agency letterhead\nInstructions for completing Tenant Income Certification'}).kind, 'tic');
});
test('second-page rent and eligibility sections identify a TIC continuation', () => {
  assert.equal(classifyPacketPage({page: 6, text: 'PART VI DETERMINATION OF INCOME ELIGIBILITY\nPART VII RENT'}).kind, 'tic');
});
