import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260830103000_controlled_mass_portfolio_tenant_intake.sql");
const transitionFix = read("supabase/migrations/20260830104500_fix_certification_import_updated_at_columns.sql");
const parser = read("src/lib/portfolio-intake.ts");
const intake = read("src/lib/portfolio-intake.functions.ts");
const intakeUi = read("src/components/portfolio-intake-panel.tsx");
const onboardingUi = read("src/components/portfolio-onboarding-panel.tsx");
const certificationUi = read("src/components/certification-upload-panel.tsx");
const extractionPreview = read("src/utils/certification-extraction-preview.functions.ts");
const queueUi = read("src/components/certification-review-panel.tsx");
const review = read("src/utils/certification-review.functions.ts");
const properties = read("src/routes/properties.index.tsx");
const upload = read("src/routes/upload-certification.tsx");
const files = read("src/routes/files.index.tsx");

test("portfolio, unit, tenant, and document records are tenant isolated", () => {
  for (const table of ["portfolio_properties", "portfolio_units", "portfolio_tenant_profiles", "portfolio_tenant_documents"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(migration, /with check \(\(select auth\.uid\(\)\) = user_id/);
  assert.match(migration, /revoke all[\s\S]*from anon/);
  assert.match(migration, /review_queue_status text not null default 'not_queued'/);
  assert.match(migration, /upload never queues review automatically/);
  assert.match(transitionFix, /alter table public\.certification_import_jobs[\s\S]*updated_at/);
  assert.match(transitionFix, /alter table public\.certification_import_items[\s\S]*updated_at/);
});

test("CSV intake parses the required portfolio hierarchy and document mapping", () => {
  for (const column of ["property_external_id", "unit_external_id", "tenant_external_id", "household_name", "certification_type", "document_file_name"]) {
    assert.match(parser, new RegExp(column));
  }
  assert.match(parser, /parseCsvRecords/);
  assert.match(parser, /unclosed quoted value/);
  assert.match(parser, /certification_type must be INITIAL, ANNUAL, or INTERIM/);
  assert.match(parser, /Download CSV template|PORTFOLIO_IMPORT_TEMPLATE/);
});

test("single-document intake never sends a PDF through the CSV parser", () => {
  assert.match(intakeUi, /async function uploadSingleDocument\(\)/);
  assert.match(intakeUi, /if \(documents\.length === 1\)[\s\S]*uploadSingleDocument\(\)/);
  assert.match(intakeUi, /if \(manifest\)[\s\S]*importPortfolio\(\)/);
  assert.match(intakeUi, /The portfolio mapping file must be a CSV/);
  assert.match(intakeUi, /one file needs no CSV/);
  assert.match(intakeUi, /intake_type: "certification_documents"/);
  assert.match(intakeUi, /review_queue_status: "not_queued"/);
  assert.match(intakeUi, /status: "completed"/);
  assert.match(intakeUi, /uploadCertificationFile\("certification-imports", storagePath, file/);
  assert.doesNotMatch(intakeUi.slice(intakeUi.indexOf("async function uploadSingleDocument"), intakeUi.indexOf("async function importPortfolio")), /parsePortfolioIntakeCsv/);
});

test("mass intake persists profiles and links documents without starting review", () => {
  assert.match(intake, /from\("portfolio_properties"\)[\s\S]*?\.upsert/);
  assert.match(intake, /from\("portfolio_units"\)[\s\S]*?\.upsert/);
  assert.match(intake, /from\("portfolio_tenant_profiles"\)[\s\S]*?\.upsert/);
  assert.match(intakeUi, /from\("portfolio_tenant_documents"\)\.insert/);
  assert.match(intakeUi, /review_queue_status: "not_queued"/);
  assert.doesNotMatch(intakeUi, /runCertificationReview/);
  assert.match(intakeUi, /Nothing was queued for compliance review/);
  assert.match(intakeUi, /filenames must match the CSV|mapped to property, unit, and tenant profiles/);
});

test("clients explicitly select multiple certifications and server preserves global upload chronology", () => {
  assert.match(queueUi, /type="checkbox"/);
  assert.match(queueUi, /Review selected/);
  assert.match(queueUi, /queueReviews/);
  assert.match(queueUi, /for \(const item of queued\.items\)/);
  const createdAtSort = intake.indexOf("Date.parse(a.created_at) - Date.parse(b.created_at)");
  const sequenceTieBreak = intake.indexOf("a.upload_sequence ?? Number.MAX_SAFE_INTEGER");
  assert.ok(createdAtSort >= 0 && sequenceTieBreak > createdAtSort, "global upload time must sort before per-batch sequence");
  assert.match(intake, /review_order: reviewOrderBase \+ index/);
  assert.match(intake, /review_queue_status: "queued"/);
  assert.match(review, /review_queue_status: "processing"/);
  assert.match(review, /review_queue_status: "completed"/);
});

test("onboarding and certification intake are separate production entry points", () => {
  assert.match(properties, /<PortfolioOnboardingPanel/);
  assert.match(onboardingUi, /documentCount: 0/);
  assert.match(onboardingUi, /documentFileName: undefined/);
  assert.match(onboardingUi, /properties, units, and tenant profiles/);
  assert.doesNotMatch(onboardingUi, /uploadCertificationFile/);

  assert.match(upload, /<CertificationUploadPanel/);
  assert.match(certificationUi, /intake_type: "certification_documents"/);
  assert.match(certificationUi, /Review extracted information before saving/);
  assert.match(certificationUi, /Confirm & Save Document/);
  assert.doesNotMatch(certificationUi, /parsePortfolioIntakeCsv|createPortfolioIntake/);
  assert.match(extractionPreview, /review_queue_status:\s*"not_queued"/);
  assert.match(extractionPreview, /status:\s*"processing"/);
  assert.match(extractionPreview, /update\(\{ status: "completed" \}\)/);
  assert.match(extractionPreview, /historical_changes/);

  assert.match(files, /<CertificationReviewPanel/);
  assert.match(files, /does not automatically enter compliance review/);
  assert.match(review, /certification_type, jurisdiction, program_codes/);
  assert.match(review, /portfolio_tenant_profiles\(household_name\)/);
});
