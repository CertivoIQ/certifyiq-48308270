import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const launchpad = read("src/routes/launchpad.tsx");
const dashboard = read("src/routes/_authenticated/dashboard.tsx");
const uploadRoute = read("src/routes/upload-certification.tsx");
const uploadPanel = read("src/components/certification-upload-panel-v4.tsx");
const ticReviewForm = read("src/components/certivoiq-tic-review-form.tsx");
const ticExtraction = read("src/lib/tic-field-extraction.ts");
const supportPanel = read("src/components/certification-supporting-documents-panel.tsx");
const reviewPanel = read("src/components/certification-review-panel.tsx");
const filesRoute = read("src/routes/files.index.tsx");
const ticIntake = read("src/utils/tic-certification-intake.functions.ts");
const ticRegistry = read("src/lib/tic-field-registry.ts");
const supportRegistry = read("src/lib/tic-supporting-document-registry.ts");
const packetClassifier = read("src/lib/tic-packet-classifier.ts");
const supportMigration = read("supabase/migrations/20260905195900_tic_supporting_documents.sql");
const propertiesRoute = read("src/routes/properties.index.tsx");
const onboardingPanel = read("src/components/portfolio-onboarding-panel.tsx");
const onboardingStorage = read("src/lib/portfolio-onboarding-storage.ts");
const pdfOcr = read("src/lib/pdf-ocr.ts");
const catalog = read("src/lib/platform-data.ts");

test("certification upload is distinct from portfolio and tenant onboarding", () => {
  assert.match(uploadRoute, /certification-upload-panel-v4/);
  assert.match(uploadRoute, /CertificationUploadPanel/);
  assert.doesNotMatch(uploadRoute, /PortfolioIntakePanel|PortfolioOnboardingPanel/);
  assert.match(uploadPanel, /Certification document intake/);
  assert.match(uploadPanel, /Upload the full Tenant Income Certification packet/);
  assert.match(uploadPanel, /CertivoIQ TIC Review Form/);
  assert.doesNotMatch(uploadPanel, /parsePortfolioIntakeCsv|createPortfolioIntake/);

  assert.match(propertiesRoute, /PortfolioOnboardingPanel/);
  assert.doesNotMatch(propertiesRoute, /CertificationUploadPanel|PortfolioIntakePanel/);
  assert.match(onboardingPanel, /Portfolio & tenant onboarding/);
  assert.match(onboardingPanel, /createPortfolioOnboarding/);
  assert.match(onboardingStorage, /total_files: 0/);
  assert.doesNotMatch(onboardingStorage, /portfolio_tenant_documents|certification_import_items/);
  assert.doesNotMatch(onboardingPanel, /uploadCertificationFile|prepareCertificationForReview/);
});

test("certification OCR sidecar stays compatible with the restricted storage bucket", () => {
  assert.match(uploadPanel, /OCR_SIDECAR_STORAGE_MIME\s*=\s*"application\/octet-stream"/);
  assert.match(uploadPanel, /contentType:\s*OCR_SIDECAR_STORAGE_MIME/);
  assert.doesNotMatch(uploadPanel, /type:\s*"application\/json"/);
});

test("scanned PDF OCR handles blank pages and form layouts without weakening evidence controls", () => {
  assert.match(pdfOcr, /const RENDER_SCALE = 3/);
  assert.match(pdfOcr, /TESSERACT_WORKER_PATH/);
  assert.match(pdfOcr, /cdn\.jsdelivr\.net\/npm\/tesseract\.js@/);
  assert.match(pdfOcr, /TESSERACT_CORE_PATH/);
  assert.match(pdfOcr, /cdn\.jsdelivr\.net\/npm\/tesseract\.js-core@/);
  assert.match(pdfOcr, /TESSERACT_LANG_PATH\s*=\s*'https:\/\/tessdata\.projectnaptha\.com\/4\.0\.0_best'/);
  assert.match(pdfOcr, /rotateAuto:\s*true/);
  assert.match(pdfOcr, /createHighContrastCanvas/);
  assert.match(pdfOcr, /otsuThreshold/);
  assert.match(pdfOcr, /visualInkProfile/);
  assert.match(pdfOcr, /looksVisuallyBlank/);
  assert.match(pdfOcr, /PSM\.AUTO/);
  assert.match(pdfOcr, /PSM\.SPARSE_TEXT/);
  assert.match(pdfOcr, /PSM\.SINGLE_BLOCK/);
  assert.match(pdfOcr, /user_defined_dpi:\s*'300'/);
  assert.match(pdfOcr, /background:\s*'#ffffff'/);
  assert.match(pdfOcr, /First nonblank failed page/);
  assert.match(pdfOcr, /if \(pages\.length === 0\)/);
  assert.doesNotMatch(pdfOcr, /if \(ocrPageCount === 0\)/);
});

test("complete Tenant Income Certification field registry is exposed in source-form order", () => {
  for (const required of [
    "current_date", "property_name", "building_identification_number", "unit_number", "unit_bedrooms",
    "total_income_e", "asset_actual_income_below_iit", "total_nnpp", "total_income_assets_m",
    "household_annual_income", "applicable_lihtc_income_limit", "tenant_paid_rent", "utility_allowance",
    "rent_assistance", "other_non_optional_charges", "gross_rent", "all_occupants_full_time_students",
    "student_exception_code", "program_type_pennhomes", "program_type_pennhomes_home",
    "tenant_signature_date", "owner_representative_signature_date",
  ]) assert.match(ticRegistry, new RegExp(`\\b${required}\\b`));

  assert.match(ticRegistry, /TIC_HOUSEHOLD_ROW_COUNT = 10/);
  assert.match(ticRegistry, /TIC_INCOME_ROW_COUNT = 10/);
  assert.match(ticRegistry, /TIC_ASSET_ROW_COUNT = 27/);
  for (const generated of [
    "household_member_\\$\\{member\\}_race",
    "household_member_\\$\\{member\\}_ethnicity",
    "household_member_\\$\\{member\\}_disability",
    "household_member_\\$\\{member\\}_gender",
    "asset_\\$\\{row\\}_current_disposed",
    "asset_\\$\\{row\\}_category",
    "asset_\\$\\{row\\}_income_method",
  ]) assert.match(ticRegistry, new RegExp(generated));
  assert.match(uploadPanel, /TIC_FIELD_DEFINITIONS/);
  assert.match(uploadPanel, /CertivoIqTicReviewForm/);
  for (const heading of [
    "PART I — DEVELOPMENT DATA", "PART II — HOUSEHOLD COMPOSITION", "PART III — GROSS ANNUAL INCOME",
    "PART IV — INCOME FROM ASSETS", "PART V — TOTAL HOUSEHOLD INCOME",
    "PART VI — DETERMINATION OF INCOME ELIGIBILITY", "PART VII — RENT", "PART VIII — STUDENT STATUS", "PART IX — PROGRAM TYPE",
  ]) assert.match(ticReviewForm, new RegExp(heading));
});

test("blank TIC lines do not inherit neighboring labels as extracted values", () => {
  assert.match(ticExtraction, /FORM_BOUNDARIES/);
  assert.match(ticExtraction, /stripBlankArtifacts/);
  assert.match(ticExtraction, /boundedTail/);
  assert.match(ticExtraction, /normalizeDate/);
  assert.match(ticExtraction, /looksLikeAnotherFieldLabel/);
  assert.match(ticExtraction, /Blank form lines stay blank/);
  assert.match(ticRegistry, /utility allowance source", "ua source"/i);
  assert.doesNotMatch(ticExtraction, /return raw\.trim\(\) \|\| null/);
});

test("standard supporting documents are classified and preserved beneath the TIC", () => {
  for (const type of [
    "annual_student_certification",
    "voluntary_race_ethnicity_disability",
    "zero_income_certification",
    "disposal_of_assets_certification",
    "dependent_children_certification",
    "no_child_support_certification",
    "self_certification",
    "affidavit",
    "check_stub",
    "other_supporting_document",
  ]) assert.match(supportRegistry, new RegExp(`\\b${type}\\b`));

  assert.match(packetClassifier, /classifyPacketPage/);
  assert.match(packetClassifier, /groupSupportingPages/);
  assert.match(packetClassifier, /kind: "tic"/);
  assert.match(packetClassifier, /kind: "supporting"/);
  assert.match(uploadPanel, /Included supporting documents/);
  assert.match(uploadPanel, /TicPacketOrganizer/);
  assert.match(uploadPanel, /pageSelections: pageChoices/);
  assert.match(ticIntake, /selectionDigest/);
  assert.match(uploadPanel, /Open source page/);
  assert.match(ticIntake, /supportingDocuments: serverSupportingDocuments/);
  assert.match(ticIntake, /source_kind: "packet_page_range"/);
  assert.match(ticIntake, /immutable: true/);
  assert.match(ticIntake, /printable: true/);
  assert.match(ticIntake, /portfolio_tenant_documents/);
});

test("one TIC may own multiple tenant supporting document records", () => {
  assert.match(supportMigration, /drop constraint if exists portfolio_tenant_documents_certification_import_item_id_key/);
  assert.match(supportMigration, /document_type text/);
  assert.match(supportMigration, /source_page_start integer/);
  assert.match(supportMigration, /source_page_end integer/);
  assert.match(supportMigration, /source_page_numbers integer\[\]/);
  assert.match(supportMigration, /source_kind in \('packet_page_range','standalone_upload'\)/);
  assert.match(supportMigration, /portfolio_tenant_documents_certification_idx/);
  assert.match(supportMigration, /Multiple preserved supporting documents may link to the same certification/);
});

test("certification packet must be stored in a tenant file", () => {
  assert.match(uploadPanel, /listCertificationTenantDestinations/);
  assert.match(uploadPanel, /Tenant file destination/);
  assert.match(uploadPanel, /Select tenant file/);
  assert.match(uploadPanel, /disabled=\{busy \|\| !tenantProfileId \|\| stage !== "tic" \|\| !draft\.selectionDigest\}/);
  assert.match(ticIntake, /tenantProfileId: string/);
  assert.match(ticIntake, /portfolio_tenant_profiles/);
  assert.match(ticIntake, /tenant_profile_id: tenant\.id/);
  assert.match(ticIntake, /property_id: tenant\.property_id/);
  assert.match(ticIntake, /unit_id: tenant\.unit_id/);
});

test("OCR-proposed and missed TIC fields can both be corrected before save", () => {
  assert.match(uploadPanel, /extractCertificationTicPreview/);
  assert.match(uploadPanel, /confirmCertificationTicPreview/);
  assert.match(uploadPanel, /cancelCertificationTicPreview/);
  assert.match(uploadPanel, /reviewerSuppliedCount/);
  assert.match(ticIntake, /TIC_FIELD_KEY_SET/);
  assert.match(ticIntake, /reviewerSuppliedFields/);
  assert.match(ticIntake, /REVIEWER_CONFIRMED_PROVIDER/);
  assert.doesNotMatch(ticIntake, /was not extracted from this document and cannot be confirmed here/);
  assert.match(ticIntake, /human_verified:\s*true/);
  assert.match(ticIntake, /tic_pre_save_confirmation/);
});

test("supporting documents are reviewable and printable while source contents remain non-editable", () => {
  assert.match(reviewPanel, /CertificationSupportingDocumentsPanel/);
  assert.match(supportPanel, /Preserved supporting tenant documents/);
  assert.match(supportPanel, /Open \/ Print/);
  assert.match(supportPanel, /Mark reviewed/);
  assert.match(supportPanel, /read-only/);
  assert.match(supportPanel, /type="file"/);
  assert.doesNotMatch(supportPanel, /<textarea|contentEditable|type="text"/);
  assert.match(ticIntake, /markCertificationSupportingDocumentReviewed/);
  assert.match(ticIntake, /review_status: "reviewed"/);
});

test("confirmed certification can be saved alone or saved and explicitly started in review", () => {
  assert.match(uploadPanel, /Save Document/);
  assert.match(uploadPanel, /Save & Start Review/);
  assert.match(uploadPanel, /confirmAndSave\(false\)/);
  assert.match(uploadPanel, /confirmAndSave\(true\)/);
  assert.match(ticIntake, /review_queue_status:\s*"queued"/);
  assert.match(ticIntake, /queued_for_review_at:\s*confirmedAt/);
  assert.match(ticIntake, /queuedForReview:\s*data\.startReview/);
});

test("save and start review opens the exact saved certification in the review workspace", () => {
  assert.match(uploadPanel, /useNavigate/);
  assert.match(uploadPanel, /navigate\(\{ to: "\/files", search: \{ item: result\.itemId \} \}\)/);
  assert.match(filesRoute, /validateSearch/);
  assert.match(filesRoute, /CertificationReviewPanel initialItemId=\{item\}/);
  assert.match(reviewPanel, /initialItemId\?: string \| null/);
  assert.match(reviewPanel, /setSelectedId\(initialItemId\)/);
  assert.match(reviewPanel, /tic-certification-review\.functions/);
  assert.doesNotMatch(reviewPanel, /setSelectedIds\(new Set\(\[initialItemId\]\)\)/);
});

test("LaunchPad requires actual onboarding data before the operational dashboard", () => {
  assert.match(catalog, /Complete portfolio & tenant onboarding/);
  assert.match(catalog, /Upload your first certification/);
  assert.match(launchpad, /case 3:[\s\S]*to="\/properties"/);
  assert.match(launchpad, /case 4:[\s\S]*to="\/upload-certification"/);
  assert.match(launchpad, /portfolio_properties/);
  assert.match(launchpad, /portfolio_units/);
  assert.match(launchpad, /portfolio_tenant_profiles/);
  assert.match(launchpad, /certification_import_items/);
  assert.match(dashboard, /customer_onboarding_progress/);
});
