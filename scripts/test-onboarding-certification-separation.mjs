import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const launchpad = read("src/routes/launchpad.tsx");
const dashboard = read("src/routes/_authenticated/dashboard.tsx");
const uploadRoute = read("src/routes/upload-certification.tsx");
const uploadPanel = read("src/components/certification-upload-panel.tsx");
const propertiesRoute = read("src/routes/properties.index.tsx");
const onboardingPanel = read("src/components/portfolio-onboarding-panel.tsx");
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
