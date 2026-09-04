import assert from 'node:assert/strict';
import {
  MAX_OCR_PAGES,
  OCR_ENGINE,
  OCR_LIMIT_MESSAGE,
  OCR_SIDECAR_VERSION,
  composeSidecarText,
  pageNeedsOcr,
  provenanceIndex,
  sidecarPathFor,
} from '../src/lib/ocr-sidecar.mjs';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const SOURCE = {
  schemaVersion: OCR_SIDECAR_VERSION,
  sourceFileName: 'tenant-certification.pdf',
  sourceSha256: 'a'.repeat(64),
  sourceByteSize: 1200,
  createdAt: '2026-08-25T18:00:00.000Z',
  pageCount: 2,
  truncated: false,
};

test('machine-readable page does not need OCR', () => {
  assert.equal(pageNeedsOcr('Tenant Signature Date: 2026-01-05  Household Annual Income: 41000'), false);
  assert.equal(pageNeedsOcr('   '), true);
});

test('source-bound sidecar composes OCR text with provenance', () => {
  const composed = composeSidecarText({ ...SOURCE, pages: [
    { page: 1, source: 'ocr', engine: OCR_ENGINE, ocrConfidence: 0.91, text: 'Gross Rent: 900' },
  ]}, { fileName: SOURCE.sourceFileName, sha256: SOURCE.sourceSha256, byteSize: SOURCE.sourceByteSize });
  assert.equal(composed.ocrPageCount, 1);
  assert.match(composed.text, /^page 1\n/);
  assert.equal(composed.provider, 'ocr-tesseract');
  assert.equal(composed.sourceIdentity.sourceSha256, SOURCE.sourceSha256);
  assert.equal(provenanceIndex(composed.pages).get(1).confidence, 0.91);
});

test('mixed sidecar keeps both sources in page order', () => {
  const composed = composeSidecarText({ ...SOURCE, pages: [
    { page: 2, source: 'ocr', engine: OCR_ENGINE, ocrConfidence: 0.8, text: 'Gross Rent: 900' },
    { page: 1, source: 'text', text: 'Tenant Signature Date: 2026-01-05' },
  ]});
  assert.equal(composed.ocrPageCount, 1);
  assert.equal(composed.textPageCount, 1);
  assert.ok(composed.text.indexOf('page 1') < composed.text.indexOf('page 2'));
  assert.equal(provenanceIndex(composed.pages).get(1).provider, 'deterministic-text');
});

test('failed OCR pages are dropped, never guessed', () => {
  const composed = composeSidecarText({ ...SOURCE, pages: [
    { page: 1, source: 'ocr', engine: OCR_ENGINE, ocrConfidence: 0, text: 'garbage' },
    { page: 2, source: 'ocr', engine: null, ocrConfidence: 0.9, text: 'garbage' },
  ]});
  assert.equal(composed.pages.length, 0);
  assert.equal(composed.skippedPageCount, 2);
  assert.equal(composed.text, '');
});

test('legacy, mismatched, duplicate, and unknown-engine sidecars are rejected or dropped', () => {
  assert.throws(
    () => composeSidecarText({ ...SOURCE, schemaVersion: '1.0', pages: [] }),
    /unsupported or unbound format/,
  );
  assert.throws(
    () => composeSidecarText({ ...SOURCE, pages: [] }, { ...SOURCE, fileName: SOURCE.sourceFileName, sha256: 'b'.repeat(64), byteSize: SOURCE.sourceByteSize }),
    /does not match/,
  );
  assert.throws(
    () => composeSidecarText({ ...SOURCE, pages: [
      { page: 1, source: 'text', text: 'one' },
      { page: 1, source: 'ocr', engine: OCR_ENGINE, ocrConfidence: 0.9, text: 'two' },
    ]}),
    /duplicate page/,
  );
  const unknown = composeSidecarText({ ...SOURCE, pages: [
    { page: 1, source: 'ocr', engine: 'caller-engine', ocrConfidence: 1, text: 'Gross Rent: 1' },
  ]});
  assert.equal(unknown.pages.length, 0);
});

test('source page bounds and truncation are enforced', () => {
  assert.throws(
    () => composeSidecarText({ ...SOURCE, truncated: true, pages: [] }),
    /invalid source identity/,
  );
  const outOfRange = composeSidecarText({ ...SOURCE, pages: [
    { page: 3, source: 'ocr', engine: OCR_ENGINE, ocrConfidence: 0.9, text: 'Gross Rent: 1' },
  ]});
  assert.equal(outOfRange.pages.length, 0);
});

test('controlled OCR limit accepts 50 scanned pages and rejects 51', () => {
  assert.equal(MAX_OCR_PAGES, 50);
  assert.match(OCR_LIMIT_MESSAGE, /up to 50 scanned pages each/);
  const makePages = (count) => Array.from({ length: count }, (_, index) => ({
    page: index + 1,
    source: 'ocr',
    engine: OCR_ENGINE,
    ocrConfidence: 0.9,
    text: `Page ${index + 1} readable text`,
  }));
  const fiftyPageSource = { ...SOURCE, pageCount: 50 };
  const fifty = composeSidecarText({ ...fiftyPageSource, pages: makePages(50) });
  assert.equal(fifty.ocrPageCount, 50);

  const fiftyOnePageSource = { ...SOURCE, pageCount: 51 };
  assert.throws(
    () => composeSidecarText({ ...fiftyOnePageSource, pages: makePages(51) }),
    /controlled OCR page limit/,
  );
});

test('sidecar path remains adjacent to its source object', () => {
  assert.equal(sidecarPathFor('a/b.pdf'), 'a/b.pdf.certivoiq-ocr.json');
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { failed += 1; console.error(`FAIL ${name}: ${e.message}`); }
}
process.exit(failed ? 1 : 0);