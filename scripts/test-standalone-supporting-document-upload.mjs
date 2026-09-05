import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const server = read("src/utils/certification-supporting-upload.functions.ts");
const panel = read("src/components/certification-supporting-documents-panel.tsx");
const migration = read("supabase/migrations/20260905195900_tic_supporting_documents.sql");
const registry = read("src/lib/tic-supporting-document-registry.ts");

test("standalone supporting uploads attach only to saved certifications pending review", () => {
  assert.match(server, /review_queue_status === "not_queued" \|\| item\.review_queue_status === "queued"/);
  assert.match(server, /!item\.review_started_at/);
  assert.match(server, /!item\.review_finished_at/);
  assert.match(server, /Supporting documents may be attached only while the saved certification is still pending review/);
  assert.match(server, /tenant_profile_id/);
  assert.match(server, /startsWith\(`\$\{userId\}\/supporting\/\$\{data\.itemId\}\/`\)/);
});

test("standalone supporting source bytes are verified and preserved read only", () => {
  assert.match(server, /sha256Hex/);
  assert.match(server, /actualSha256\.toLowerCase\(\) !== data\.sha256\.toLowerCase\(\)/);
  assert.match(server, /source_kind: "standalone_upload"/);
  assert.match(server, /immutable: true/);
  assert.match(server, /printable: true/);
  assert.match(server, /review_status: "pending_review"/);
  assert.match(server, /classification_basis: "Reviewer-selected standalone supporting document type\."/);
  assert.doesNotMatch(server, /review_queue_status:\s*"processing"|review_queue_status:\s*"completed"/);
});

test("review shelf lets user attach one classified support file without editing TIC fields", () => {
  assert.match(panel, /Add one supporting document to this pending certification/);
  assert.match(panel, /Attach to certification/);
  assert.match(panel, /type="file"/);
  assert.match(panel, /accept=\{ACCEPTED_SUPPORT_TYPES\}/);
  assert.match(panel, /SUPPORTING_DOCUMENT_DEFINITIONS\.map/);
  assert.match(panel, /attachStandaloneCertificationSupportingDocument/);
  assert.match(panel, /source file is preserved read-only/);
  assert.match(panel, /does not change TIC fields or automatically start\/restart review/);
  assert.doesNotMatch(panel, /runCertificationReview|confirmCertificationTicPreview/);
});

test("supporting document schema explicitly permits standalone uploads and many documents per certification", () => {
  assert.match(migration, /drop constraint if exists portfolio_tenant_documents_certification_import_item_id_key/);
  assert.match(migration, /source_kind text not null default 'standalone_upload'/);
  assert.match(migration, /'packet_page_range','standalone_upload'/);
  assert.match(registry, /annual_student_certification/);
  assert.match(registry, /zero_income_certification/);
  assert.match(registry, /disposal_of_assets_certification/);
  assert.match(registry, /no_child_support_certification/);
  assert.match(registry, /check_stub/);
});
