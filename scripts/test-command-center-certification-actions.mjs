import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const dashboard = read("src/components/production-dashboard.tsx");
const filesRoute = read("src/routes/files.index.tsx");
const reviewPanel = read("src/components/certification-review-panel.tsx");
const supportPanel = read("src/components/certification-supporting-documents-panel.tsx");

test("command center certifications awaiting review is a live pending queue", () => {
  assert.match(dashboard, /listCertificationDocuments/);
  assert.match(dashboard, /queryKey:\s*\["certification-items"\]/);
  assert.match(dashboard, /item\.review_queue_status === "not_queued" \|\| item\.review_queue_status === "queued"/);
  assert.match(dashboard, /Stat label="Certifications awaiting review" value=\{pendingCertifications\.length\}/);
  assert.match(dashboard, /Panel title="Certifications Awaiting Review"/);
  assert.match(dashboard, /saved \/ pending review/);
  assert.match(dashboard, /queued for review/);
});

test("each pending certification exposes attach and review actions from command center", () => {
  assert.match(dashboard, /Attach Supporting Document/);
  assert.match(dashboard, /Review Certification/);
  assert.match(dashboard, /search=\{\{ item: item\.id, action: "support" \}\}/);
  assert.match(dashboard, /search=\{\{ item: item\.id, action: "review" \}\}/);
  assert.match(dashboard, /search=\{\{ item: item\.id \}\}/);
});

test("review route validates command center action and opens the exact certification", () => {
  assert.match(filesRoute, /action\?: "support" \| "review"/);
  assert.match(filesRoute, /search\[\x27action\x27\] === "support" \|\| search\[\x27action\x27\] === "review"/);
  assert.match(filesRoute, /const \{ item, action \} = Route\.useSearch\(\)/);
  assert.match(filesRoute, /CertificationReviewPanel initialItemId=\{item\} initialAction=\{action\}/);

  assert.match(reviewPanel, /initialAction\?: "support" \| "review"/);
  assert.match(reviewPanel, /Pending certification opened from the Command Center/);
  assert.match(reviewPanel, /certification-\$\{initialItemId\}/);
});

test("pending certification detail has direct single-certification review action", () => {
  assert.match(reviewPanel, /Pending certification actions/);
  assert.match(reviewPanel, /Review Certification/);
  assert.match(reviewPanel, /mutationFn:\s*async \(requestedIds\?: string\[\]\)/);
  assert.match(reviewPanel, /const itemIds = requestedIds\?\.length \? requestedIds : \[\.\.\.selectedIds\]/);
  assert.match(reviewPanel, /runQueue\.mutate\(\[item\.id\]\)/);
  assert.match(reviewPanel, /item\.review_queue_status === 'not_queued' \|\| item\.review_queue_status === 'queued'/);
});

test("standalone supporting upload remains one document per upload", () => {
  assert.match(supportPanel, /Add one supporting document to this pending certification/);
  assert.match(supportPanel, /Attach to certification/);
  assert.match(supportPanel, /type="file"/);
  assert.doesNotMatch(supportPanel, /\bmultiple\b/);
  assert.match(supportPanel, /supportFile: File \| null|useState<File \| null>/);
  assert.match(supportPanel, /attachStandaloneCertificationSupportingDocument/);
  assert.match(supportPanel, /does not change TIC fields or automatically start\/restart review/);
});
