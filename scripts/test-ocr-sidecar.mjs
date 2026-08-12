import assert from 'node:assert/strict';
import { composeSidecarText, pageNeedsOcr, provenanceIndex, sidecarPathFor, OCR_SIDECAR_VERSION } from '../src/lib/ocr-sidecar.mjs';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('machine-readable page does not need OCR', () => {
  assert.equal(pageNeedsOcr('Tenant Signature Date: 2026-01-05  Household Annual Income: 41000'), false);
  assert.equal(pageNeedsOcr('   '), true);
});

test('scanned sidecar composes OCR text with provenance', () => {
  const composed = composeSidecarText({ schemaVersion: OCR_SIDECAR_VERSION, pages: [
    { page: 1, source: 'ocr', engine: 'tesseract.js:eng', ocrConfidence: 0.91, text: 'Gross Rent: 900' },
  ]});
  assert.equal(composed.ocrPageCount, 1);
  assert.match(composed.text, /^page 1\n/);
  assert.equal(composed.provider, 'ocr-tesseract');
  assert.equal(provenanceIndex(composed.pages).get(1).confidence, 0.91);
});

test('mixed sidecar keeps both sources in page order', () => {
  const composed = composeSidecarText({ schemaVersion: OCR_SIDECAR_VERSION, pages: [
    { page: 2, source: 'ocr', engine: 'tesseract.js:eng', ocrConfidence: 0.8, text: 'Gross Rent: 900' },
    { page: 1, source: 'text', text: 'Tenant Signature Date: 2026-01-05' },
  ]});
  assert.equal(composed.ocrPageCount, 1);
  assert.equal(composed.textPageCount, 1);
  assert.ok(composed.text.indexOf('page 1') < composed.text.indexOf('page 2'));
  assert.equal(provenanceIndex(composed.pages).get(1).provider, 'deterministic-text');
});

test('failed OCR pages are dropped, never guessed', () => {
  const composed = composeSidecarText({ schemaVersion: OCR_SIDECAR_VERSION, pages: [
    { page: 1, source: 'ocr', engine: 'tesseract.js:eng', ocrConfidence: 0, text: 'garbage' },
    { page: 2, source: 'ocr', engine: null, ocrConfidence: 0.9, text: 'garbage' },
  ]});
  assert.equal(composed.pages.length, 0);
  assert.equal(composed.skippedPageCount, 2);
  assert.equal(composed.text, '');
});

test('unsupported sidecar format is rejected', () => {
  assert.throws(() => composeSidecarText({ schemaVersion: '0.1', pages: [] }), /unsupported format/);
  assert.equal(sidecarPathFor('a/b.pdf'), 'a/b.pdf.certivoiq-ocr.json');
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { failed += 1; console.error(`FAIL ${name}: ${e.message}`); }
}
process.exit(failed ? 1 : 0);
