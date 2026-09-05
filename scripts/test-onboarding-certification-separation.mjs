import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const launchpad = read("src/routes/launchpad.tsx");
const dashboard = read("src/routes/_authenticated/dashboard.tsx");
const uploadRoute = read("src/routes/upload-certification.tsx");
const uploadPanel = read("src/components/certification-upload-panel.tsx");
const reviewPanel = read("src/components/certification-review-panel.tsx");
const filesRoute = read("src/routes/files.index.tsx");
const extractionPreview = read("src/utils/certification-extraction-preview.functions.ts");
const propertiesRoute = read("src/routes/properties.index.tsx");
const onboardingPanel = read("src/components/portfolio-onboarding-panel.tsx");
const pdfOcr = read("src/lib/pdf-ocr.ts");
const catalog = read("src/lib/platform-data.ts");

test("certification upload is distinct from portfolio and tenant onboarding", () => {
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
  assert.doesNotMatch(uploadPanel, /new Blob\(\[JSON\.stringify\(prepared\.sidecar\)\],\s*\{\s*type:\s*"application\/json"/);
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

test("extracted certification fields must be reviewed or corrected before the document is saved", () => {
  assert.match(uploadPanel, /extractCertificationDocumentPreview/);
  assert.match(uploadPanel, /confirmCertificationDocumentPreview/);
  assert.match(uploadPanel, /cancelCertificationDocumentPreview/);
  assert.match(uploadPanel, /Review extracted information before saving/);
  assert.match(uploadPanel, /will not appear in Documents or the Compliance Review Queue until you confirm it/);
  assert.doesNotMatch(uploadPanel, /certification_import_items"\)\.insert\([\s\S]*status:\s*"completed"/);

  assert.match(extractionPreview, /Nothing is written to certification_import_items or certification_facts until this confirmation runs/);
  assert.match(extractionPreview, /confirmCertificationDocumentPreview/);
  assert.match(extractionPreview, /historical_changes/);
  assert.match(extractionPreview, /original_extracted_data/);
  assert.match(extractionPreview, /confirmed_extracted_data/);
  assert.match(extractionPreview, /human_verified:\s*true/);
  assert.match(extractionPreview, /review_queue_status:\s*"not_queued"/);
  assert.match(extractionPreview, /\.eq\("status", "completed"\)/);

  assert.match(reviewPanel, /Extracted document information/);
  assert.match(reviewPanel, /item\.extracted_data/);
  assert.match(reviewPanel, /Compliance review begins only when selected below/);
});

test("confirmed certification can be saved alone or saved and explicitly started in review", () => {
  assert.match(uploadPanel, /Save Document/);
  assert.match(uploadPanel, /Save & Start Review/);
  assert.match(uploadPanel, /confirmAndSave\(false\)/);
  assert.match(uploadPanel, /confirmAndSave\(true\)/);
  assert.match(uploadPanel, /startReview,/);
  assert.match(uploadPanel, /It is now in the Compliance Review Queue/);

  assert.match(extractionPreview, /startReview\?: boolean/);
  assert.match(extractionPreview, /startReview:\s*data\.startReview === true/);
  assert.match(extractionPreview, /review_queue_status:\s*"queued"/);
  assert.match(extractionPreview, /queued_for_review_at:\s*confirmedAt/);
  assert.match(extractionPreview, /review_order:\s*Date\.now\(\) \* 1000/);
  assert.match(extractionPreview, /reviewQueueStatus:\s*data\.startReview \? "queued" : "not_queued"/);
  assert.match(extractionPreview, /queuedForReview:\s*data\.startReview/);
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