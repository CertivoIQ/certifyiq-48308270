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
const { extractTicSpatialValueLines } = await import('../src/lib/tic-spatial-extraction.mjs');
const facts = text => extractTicFieldsFromText(text, 'SYNTHETIC-TIC.pdf').facts;
const field = (values, name) => values.find(item => item.field === name)?.value;
const markedText = pages => [...pages].map(([page, lines]) => `Page ${page}\n${lines.join('\n')}`).join('\n');

test('native selection flows end to end into the TIC field', () => {
  for (const type of ['Initial Certification', 'Recertification', 'Other']) {
    const text = markedText(ticPdfFormValueLinesByPage({ [type]: [{ value: 'Yes', type: 'checkbox', page: 0 }] }));
    assert.equal(field(facts(text), 'certification_type'), type);
  }
});
test('unselected checkbox export values are not treated as selections', () => {
  const pages = ticPdfFormValueLinesByPage({ 'Initial Certification': [{ buttonValue: 'Yes', type: 'checkbox', page: 0 }], Recertification: [{ value: 'Off', buttonValue: 'Yes', type: 'checkbox' }] });
  assert.equal(field(facts(markedText(pages)), 'certification_type'), undefined);
});
test('conflicting native choices stay missing rather than first-choice wins', () => {
  const result = extractTicFieldsFromText('__CERTIVOIQ_TIC_FIELD__ certification_type: Initial Certification\n__CERTIVOIQ_TIC_FIELD__ certification_type: Recertification', 'SYNTHETIC-TIC.pdf');
  assert.equal(field(result.facts, 'certification_type'), undefined);
  assert.ok(result.missingFields.includes('certification_type'));
});
test('the source recertification checkbox selects only the corresponding TIC option', () => assert.equal(field(facts('Page 1\n☐ Initial Certification ☒ Recertification ☐ Other'), 'certification_type'), 'Recertification'));
test('separate native first-name and initial cells combine without guessing a surname', () => {
  const text = markedText(ticPdfFormValueLinesByPage({ 'Last Name': [{ value: 'DOE', page: 0 }], 'First Name': [{ value: 'JANE', page: 0 }], 'Middle Initial': [{ value: 'A', page: 0 }] }));
  assert.equal(field(facts(text), 'household_member_1_last_name'), 'DOE');
  assert.equal(field(facts(text), 'household_member_1_first_name_middle_initial'), 'JANE A');
});
test('canonical native TIC field names map to their registry cell', () => {
  const text = markedText(ticPdfFormValueLinesByPage({ household_member_2_last_name: [{ value: 'SMITH', page: 0 }], income_member_2_wages_business: [{ value: '12345.67', page: 0 }] }));
  assert.equal(field(facts(text), 'household_member_2_last_name'), 'SMITH');
  assert.equal(field(facts(text), 'income_member_2_wages_business'), 12345.67);
});
test('duplicate numeric candidates are not silently resolved', () => {
  const result = facts('__CERTIVOIQ_TIC_FIELD__ total_income_e: 42000\n__CERTIVOIQ_TIC_FIELD__ total_income_e: 24000');
  assert.equal(field(result, 'total_income_e'), undefined);
});
test('a TIC after the first three pages is recognized', () => assert.equal(classifyPacketPage({ page: 8, text: 'TENANT INCOME CERTIFICATION PART II HOUSEHOLD COMPOSITION' }).kind, 'tic'));
test('the saved review note is a supported TIC field', () => {
  assert.ok((awaitRegistry()).includes('calculation_review_note'));
});
function awaitRegistry() { return [...readFileSync('src/lib/tic-field-registry.ts', 'utf8').matchAll(/field\("([a-z0-9_]+)"/g)].map(match => match[1]); }

test('two asset accounts for the same member retain distinct asset rows', () => {
  const line = (text, y, tokens = [[text, 20, 600]]) => ({ text, bbox: { x0: 20, y0: y, x1: 980, y1: y + 10 }, words: tokens.map(([text, x, width = 30]) => ({ text, bbox: { x0: x, y0: y, x1: x + width, y1: y + 10 } })) });
  const lines = [line('Tenant Income Certification', 50), line('Part IV Income From Assets', 200), line('Type of Asset Cash Value Annual Income', 220), line('1 Savings C 5000 25', 250, [['1', 40], ['Savings', 160, 60], ['C', 440], ['5000', 600, 40], ['25', 930]]), line('1 Checking C 2000 5', 280, [['1', 40], ['Checking', 160, 70], ['C', 440], ['2000', 600, 40], ['5', 930]]), line('Part V Total Household Income', 320)];
  const result = extractTicSpatialValueLines([{ paragraphs: [{ lines }] }], 1000, 1000).join('\n');
  assert.match(result, /asset_1_household_member_number: 1/);
  assert.match(result, /asset_2_household_member_number: 1/);
  assert.match(result, /asset_1_cash_value: 5000/);
  assert.match(result, /asset_2_cash_value: 2000/);
});
