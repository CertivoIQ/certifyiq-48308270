import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const launchpad = read("src/routes/launchpad.tsx");
const dashboard = read("src/routes/_authenticated/dashboard.tsx");
const uploadRoute = read("src/routes/upload-certification.tsx");
const uploadPanel = read("src/components/certification-upload-panel-v2.tsx");
const reviewPanel = read("src/components/certification-review-panel.tsx");
const filesRoute = read("src/routes/files.index.tsx");
const ticIntake = read("src/utils/tic-certification-intake.functions.ts");
const ticRegistry = read("src/lib/tic-field-registry.ts");
const propertiesRoute = read("src/routes/properties.index.tsx");
const onboardingPanel = read("src/components/portfolio-onboarding-panel.tsx");
const pdfOcr = read("src/lib/pdf-ocr.ts");
const catalog = read("src/lib/platform-data.ts");

test("certification upload is distinct from portfolio and tenant onboarding", () => {
  assert.match(uploadRoute, /certification-upload-panel-v2/);
  assert.match(uploadRoute, /CertificationUploadPanel/);
  assert.doesNotMatch(uploadRoute, /PortfolioIntakePanel|PortfolioOnboardingPanel/);
  assert.match(uploadPanel, /Certification document intake/);
  assert.match(uploadPanel, /does not create properties, units, or tenant profiles/);
  assert.doesNotMatch(uploadPanel, /parsePortfolioIntakeCsv|createPortfolioIntake/);

  assert.match(propertiesRoute, /PortfolioOnboardingPanel/);
  assert.doesNotMatch(propertiesRoute, /CertificationUploadPanel|PortfolioIntakePanel/);
  assert.match(onboardingPanel, /Portfolio & tenant onboarding/);
  assert.match(onboardingPanel, /documentCount: 0/);
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
  assert.match(pdfOcr, /OCR completed but could not recover readable text/);
});

test("complete Tenant Income Certification field registry is exposed for pre-save correction", () => {
  for (const required of [
    "property_name",
    "building_identification_number",
    "unit_number",
    "unit_bedrooms",
    "household_size",
    "household_annual_income",
    "applicable_lihtc_income_limit",
    "tenant_paid_rent",
    "utility_allowance",
    "rent_assistance",
    "other_non_optional_charges",
    "gross_rent",
    "all_occupants_full_time_students",
    "student_exception_code",
    "tenant_signature_date",
    "owner_representative_signature_date",
  ]) {
    assert.match(ticRegistry, new RegExp(`\\b${required}\\b`));
  }
  assert.match(ticRegistry, /Array\.from\(\{ length: 7 \}/);
  assert.match(ticRegistry, /household_member_\$\{member\}_last_name/);
  assert.match(ticRegistry, /household_member_\$\{member\}_date_of_birth/);
  assert.match(ticRegistry, /household_member_\$\{member\}_full_time_student/);
  assert.match(ticRegistry, /income_member_\$\{member\}_wages_business/);
  assert.match(ticRegistry, /income_member_\$\{member\}_social_security_pension/);
  assert.match(ticRegistry, /income_member_\$\{member\}_public_assistance/);
  assert.match(ticRegistry, /income_member_\$\{member\}_other_income/);
  assert.match(ticRegistry, /Array\.from\(\{ length: 8 \}/);
  assert.match(ticRegistry, /asset_\$\{row\}_type/);
  assert.match(ticRegistry, /asset_\$\{row\}_cash_value/);
  assert.match(ticRegistry, /asset_\$\{row\}_annual_income/);
  assert.match(uploadPanel, /TIC_FIELD_DEFINITIONS/);
  assert.match(uploadPanel, /TIC_FIELD_SECTIONS/);
  assert.match(uploadPanel, /Not extracted — enter if shown on the certification/);
  assert.match(uploadPanel, /sourcePreviewUrl/);
  assert.match(uploadPanel, /Review and correct the complete TIC before saving/);
});

test("OCR-proposed and missed TIC fields can both be corrected before save", () => {
  assert.match(uploadPanel, /extractCertificationTicPreview/);
  assert.match(uploadPanel, /confirmCertificationTicPreview/);
  assert.match(uploadPanel, /cancelCertificationTicPreview/);
  assert.match(uploadPanel, /TIC_FIELD_DEFINITIONS\.map/);
  assert.match(uploadPanel, /reviewerSuppliedCount/);
  assert.match(ticIntake, /TIC_FIELD_KEY_SET/);
  assert.match(ticIntake, /reviewerSuppliedFields/);
  assert.match(ticIntake, /REVIEWER_CONFIRMED_PROVIDER/);
  assert.doesNotMatch(ticIntake, /was not extracted from this document and cannot be confirmed here/);
  assert.match(ticIntake, /source_page:\s*original\?\.page \?\? null/);
  assert.match(ticIntake, /human_verified:\s*true/);
  assert.match(ticIntake, /tic_pre_save_confirmation/);
  assert.match(ticIntake, /review_queue_status:\s*"not_queued"/);
});

test("confirmed certification can be saved alone or saved and explicitly started in review", () => {
  assert.match(uploadPanel, /Save Document/);
  assert.match(uploadPanel, /Save & Start Review/);
  assert.match(uploadPanel, /confirmAndSave\(false\)/);
  assert.match(uploadPanel, /confirmAndSave\(true\)/);
  assert.match(uploadPanel, /startReview,/);
  assert.match(uploadPanel, /It is now in the Compliance Review Queue/);

  assert.match(ticIntake, /startReview\?: boolean/);
  assert.match(ticIntake, /startReview:\s*data\.startReview === true/);
  assert.match(ticIntake, /review_queue_status:\s*"queued"/);
  assert.match(ticIntake, /queued_for_review_at:\s*confirmedAt/);
  assert.match(ticIntake, /review_order:\s*Date\.now\(\) \* 1000/);
  assert.match(ticIntake, /reviewQueueStatus:\s*data\.startReview \? "queued" : "not_queued"/);
  assert.match(ticIntake, /queuedForReview:\s*data\.startReview/);
});

test("save and start review opens the exact saved certification in the review workspace", () => {
  assert.match(uploadPanel, /useNavigate/);
  assert.match(
    uploadPanel,
    /if \(result\.queuedForReview\) \{[\s\S]*navigate\(\{ to: "\/files", search: \{ item: result\.itemId \} \}\)/,
  );

  assert.match(filesRoute, /validateSearch/);
  assert.match(filesRoute, /UUID_PATTERN/);
  assert.match(filesRoute, /const \{ item \} = Route\.useSearch\(\)/);
  assert.match(filesRoute, /CertificationReviewPanel initialItemId=\{item\}/);

  assert.match(reviewPanel, /initialItemId\?: string \| null/);
  assert.match(reviewPanel, /useState<string \| null>\(initialItemId\)/);
  assert.match(reviewPanel, /if \(!initialItemId\) return/);
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
  assert.match(dashboard, /data && !data\.completed_at/);
  assert.match(dashboard, /navigate\(\{ to: "\/launchpad", replace: true \}\)/);
  assert.match(dashboard, /Legacy users without an onboarding record/);
});
