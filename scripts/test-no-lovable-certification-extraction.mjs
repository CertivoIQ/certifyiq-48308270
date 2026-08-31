import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const extraction = read('src/lib/certification-extraction.server.ts');
const review = read('src/utils/certification-review.functions.ts');
const reviewPanel = read('src/components/certification-review-panel.tsx');
const pdfOcr = read('src/lib/pdf-ocr.ts');
const intake = read('src/components/portfolio-intake-panel.tsx');

const prohibited = /LOVABLE_API_KEY|createLovableAiGatewayProvider|ai\.gateway\.lovable\.dev|extractFactsWithAi|lovable-ai/;

assert.doesNotMatch(extraction, prohibited, 'certification extraction must not reference Lovable');
assert.doesNotMatch(review, prohibited, 'certification review must not reference Lovable');
assert.doesNotMatch(review, /\buseAi\b/, 'certification review must not expose an AI fallback flag');
assert.doesNotMatch(reviewPanel, /\buseAi\b/, 'the review UI must not request an AI fallback');

assert.match(pdfOcr, /import\('tesseract\.js'\)/, 'local Tesseract OCR must remain bundled');
assert.match(pdfOcr, /export function isOcrSupportedFile/, 'the shared OCR file gate must exist');
assert.match(pdfOcr, /\^image\\\/\(png\|jpeg\|webp\)/, 'PNG, JPEG, and WEBP must be recognized');
assert.match(pdfOcr, /ocrWorker\.recognize\(file\)/, 'image certifications must be extracted locally');
assert.match(intake, /isOcrSupportedFile\(file\)/, 'intake must prepare every supported certification document');
assert.match(review, /Missing evidence remains \"unable to determine\"/, 'missing evidence must fail closed to human review');

console.log('PASS certification extraction is local, source-bound, and independent of Lovable');
