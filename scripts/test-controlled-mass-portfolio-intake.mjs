import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260830103000_controlled_mass_portfolio_tenant_intake.sql");
const parser = read("src/lib/portfolio-intake.ts");
const intake = read("src/lib/portfolio-intake.functions.ts");
const intakeUi = read("src/components/portfolio-intake-panel.tsx");
const queueUi = read("src/components/certification-review-panel.tsx");
const review = read("src/utils/certification-review.functions.ts");
const properties = read("src/routes/properties.index.tsx");
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

test("mass intake persists profiles and links documents without starting review", () => {
  assert.match(intake, /from\("portfolio_properties"\)[\s\S]*?\.upsert/);
  assert.match(intake, /from\("portfolio_units"\)[\s\S]*?\.upsert/);
  assert.match(intake, /from\("portfolio_tenant_profiles"\)[\s\S]*?\.upsert/);
  assert.match(intakeUi, /from\("portfolio_tenant_documents"\)\.insert/);
  assert.match(intakeUi, /review_queue_status: "not_queued"/);
  assert.doesNotMatch(intakeUi, /runCertificationReview/);
  assert.match(intakeUi, /Nothing was queued for compliance review/);
  assert.match(intakeUi, /filenames must match the CSV/);
});

test("clients explicitly select multiple certifications and server orders them by upload sequence", () => {
  assert.match(queueUi, /type="checkbox"/);
  assert.match(queueUi, /Review selected/);
  assert.match(queueUi, /queueReviews/);
  assert.match(queueUi, /for \(const item of queued\.items\)/);
  assert.match(intake, /upload_sequence \?\? Number\.MAX_SAFE_INTEGER/);
  assert.match(intake, /Date\.parse\(a\.created_at\) - Date\.parse\(b\.created_at\)/);
  assert.match(intake, /review_queue_status: "queued"/);
  assert.match(review, /review_queue_status: "processing"/);
  assert.match(review, /review_queue_status: "completed"/);
});

test("property intake and certification queue share the production workflow", () => {
  assert.match(properties, /<PortfolioIntakePanel/);
  assert.match(properties, /Choose certifications to review/);
  assert.match(files, /<CertificationReviewPanel/);
  assert.match(files, /does not automatically enter compliance review/);
  assert.match(review, /certification_type, jurisdiction, program_codes/);
  assert.match(review, /portfolio_tenant_profiles\(household_name\)/);
});
