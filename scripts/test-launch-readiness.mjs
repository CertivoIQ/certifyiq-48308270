import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  normalizeOnboardingProgress,
  previousOnboardingProgress,
} from "../src/lib/onboarding-progress.mjs";

const read = (path) => readFileSync(path, "utf8");

const requiredFiles = [
  "src/routes/index.tsx",
  "src/routes/welcome.tsx",
  "src/routes/pricing.tsx",
  "src/routes/privacy.tsx",
  "src/routes/terms.tsx",
  "src/routes/security.tsx",
  "src/routes/methodology.tsx",
  "src/routes/contact-support.tsx",
  "src/routes/_authenticated/supportiq.tsx",
  "src/routes/api/public/payments/webhook.ts",
  "src/lib/stateCoverageRegistry.ts",
  "src/lib/stripe.server.ts",
  "src/lib/organization-email.mjs",
  "public/sitemap.xml",
  "public/certivoiq-logo.png",
  "public/certivoiq-logo-dark.png",
  "public/certivoiq-mark.png",
  "public/certivoiq-social-card.png",
  "public/favicon.png",
  "LICENSE",
];

test("launch-critical routes and controls exist", () => {
  for (const path of requiredFiles) {
    assert.equal(existsSync(path), true, `Missing launch-critical file: ${path}`);
  }
});

test("root route sends public visitors to /welcome", () => {
  const source = read("src/routes/index.tsx");
  assert.match(source, /redirect\(\{\s*to:\s*["']\/welcome["']/s);
});

test("public launch copy does not overstate fifty-state rule validation", () => {
  const files = [
    "src/routes/__root.tsx",
    "src/routes/welcome.tsx",
    "src/routes/pricing.tsx",
  ];
  for (const path of files) {
    const source = read(path);
    assert.doesNotMatch(
      source,
      /(?:auditing|coverage) across all 50 states|coverage for all 50 states/i,
      `${path} contains an unqualified 50-state coverage claim`,
    );
  }
});

test("state coverage defaults to federal baseline until validated", () => {
  const source = read("src/lib/stateCoverageRegistry.ts");
  assert.match(source, /status:\s*["']federal_baseline["']/);
  assert.match(source, /validatedRuleCount:\s*0/);
  assert.match(source, /state-specific review required/i);
  assert.match(source, /isUsableForDetermination/);
});

test("payment code requires explicit live credentials and signed webhooks", () => {
  const stripe = read("src/lib/stripe.server.ts");
  assert.match(stripe, /STRIPE_LIVE_API_KEY/);
  assert.match(stripe, /PAYMENTS_LIVE_WEBHOOK_SECRET/);
  assert.match(stripe, /stripe-signature/);
  assert.match(stripe, /Invalid webhook signature/);
});

test("SupportIQ remains authenticated and agent-gated for risky support", () => {
  const route = read("src/routes/_authenticated/supportiq.tsx");
  const triage = read("src/lib/support-triage.mjs");
  assert.match(route, /triageSupportRequest/);
  assert.match(triage, /P0_SECURITY/);
  assert.match(triage, /P1_BILLING/);
  assert.match(triage, /P2_COMPLIANCE_REVIEW/);
  assert.match(triage, /approve_certification/);
});

test("privacy and terms are public and discoverable", () => {
  const shell = read("src/components/public-shell.tsx");
  const sitemap = read("public/sitemap.xml");
  assert.match(shell, /to=["']\/privacy["']/);
  assert.match(shell, /to=["']\/terms["']/);
  assert.match(sitemap, /certivoiq\.com\/privacy/);
  assert.match(sitemap, /certivoiq\.com\/terms/);
});

test("sitemap leads with public marketing and excludes authenticated dashboard", () => {
  const sitemap = read("public/sitemap.xml");
  assert.match(sitemap, /certivoiq\.com\/welcome/);
  assert.doesNotMatch(sitemap, /certivoiq\.com\/dashboard/);
});

test("repository is marked proprietary", () => {
  const license = read("LICENSE");
  assert.match(license, /proprietary|all rights reserved/i);
});


test("public pricing uses the two authoritative annual license types", () => {
  const pricing = read("src/routes/pricing.tsx");
  const catalog = read("src/lib/platform-data.ts");
  const combined = pricing + catalog;

  assert.match(combined, /\$65,000/);
  assert.match(combined, /\$150,000/);
  assert.match(combined, /selected state/i);
  assert.match(combined, /PHA/i);
  assert.match(pricing, /Try CertivoIQ for Free/i);
  assert.doesNotMatch(combined, /\$999|\$4,999|\$9,999|\$14,999/);
  assert.doesNotMatch(pricing, /Professional|Enterprise Plus|CertivoIQ Academy/i);
});

test("public launch surfaces use federal baseline and agent terminology", () => {
  const files = [
    "src/routes/welcome.tsx",
    "src/routes/pricing.tsx",
    "src/routes/methodology.tsx",
    "src/routes/security.tsx",
    "src/routes/terms.tsx",
    "src/components/CertivoIQVoiceoverVideo.tsx",
    "src/components/CertivoIQVoiceoverVideoBase.tsx",
    "src/components/explainer-video.tsx",
    "src/routes/_authenticated/marketing-kit.tsx",
    "src/routes/pha/index.tsx",
    "src/routes/pha/$persona.tsx",
  ];
  const combined = files.map(read).join("\n");

  assert.match(combined, /Federal baseline/i);
  assert.match(combined, /Manual Review/);
  assert.match(combined, /Agent Approval/);
  assert.match(combined, /Agent Signature/);
  assert.doesNotMatch(combined, /human review|human approval|human verification|human sign-off/i);
  assert.doesNotMatch(combined, /coverage for all 50 states|compliance intelligence for all 50 states/i);
});

test("public acquisition uses three free certification reviews", () => {
  const files = [
    "src/routes/welcome.tsx",
    "src/routes/pricing.tsx",
    "src/components/CertivoIQVoiceoverVideo.tsx",
    "src/components/CertivoIQVoiceoverVideoBase.tsx",
    "src/components/explainer-video.tsx",
  ];
  const combined = files.map(read).join("\n");

  assert.match(combined, /TRY CERTIVOIQ FOR FREE/i);
  assert.match(combined, /FREE_REVIEW_COUNT\s*=\s*3/);
  assert.match(combined, /FREE CERTIFICATION REVIEWS/i);
  assert.match(combined, /ORGANIZATION WEBSITE EMAIL REQUIRED/i);
  assert.doesNotMatch(combined, /Request a Demo/i);
});

test("primary application navigation excludes removed training and free-review products", () => {
  const shell = read("src/components/app-shell.tsx");
  assert.doesNotMatch(shell, /to=["']\/academy["']/);
  assert.doesNotMatch(shell, /to=["']\/trial["']/);
});


test("official CertivoIQ logo is used across site and search metadata", () => {
  const brandedSurfaces = [
    "src/components/public-shell.tsx",
    "src/components/app-shell.tsx",
    "src/routes/welcome.tsx",
    "src/routes/auth.tsx",
    "src/routes/reset-password.tsx",
    "src/routes/contact-support.tsx",
    "src/routes/security.tsx",
    "src/routes/methodology.tsx",
    "src/components/explainer-video.tsx",
    "src/routes/_authenticated/marketing-kit.tsx",
  ];
  const combined = brandedSurfaces.map(read).join("\n");
  const root = read("src/routes/__root.tsx");
  const email = read("src/lib/email-templates/shared.tsx");

  assert.match(combined, /\/certivoiq-logo\.png/);
  assert.match(combined, /\/certivoiq-logo-dark\.png/);
  for (const path of brandedSurfaces.filter((path) => !path.endsWith("app-shell.tsx") && !path.endsWith("explainer-video.tsx"))) {
    const source = read(path);
    assert.match(source, /\/certivoiq-logo\.png/, `${path} is missing the light-background wordmark`);
    assert.match(source, /\/certivoiq-logo-dark\.png/, `${path} is missing the dark-background wordmark`);
  }
  assert.doesNotMatch(combined, /certivoiq-logo[^\n]*(?:bg-white|rounded-md|px-1\.5|py-1)/);
  assert.doesNotMatch(combined, /brand-gradient grid[^\n]*>IQ<\/span>/);
  assert.match(root, /\/favicon\.png/);
  assert.match(root, /\/certivoiq-mark\.png/);
  assert.match(root, /certivoiq-social-card\.png/);
  assert.match(root, /application\/ld\+json/);
  assert.match(root, /"@type": "Organization"/);
  assert.match(email, /https:\/\/certivoiq\.com\/certivoiq-logo\.png/);
});


test("self-directed onboarding persists without obsolete certificate claims", () => {
  const route = read("src/routes/launchpad.tsx");
  const catalog = read("src/lib/platform-data.ts");
  const migration = read(
    "supabase/migrations/20260821123000_self_directed_onboarding.sql",
  );

  assert.match(route, /customer_onboarding_progress/);
  assert.match(route, /upsert/);
  assert.match(route, /progress saved automatically/i);
  assert.match(route, /to=["']\/workspace-setup["']/);
  assert.match(route, /to=["']\/properties["']/);
  assert.match(route, /to=["']\/compliance-intelligence["']/);
  assert.match(route, /to=["']\/account\/security["']/);
  assert.match(route, /previousOnboardingProgress/);
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /completed_at timestamptz/);
  assert.doesNotMatch(route + catalog, /Launch Certified|Merlin|Graduation/);
  assert.match(route + catalog, /not a training certificate/i);
});

test("chat and email support persist deterministic ticket triage", () => {
  const chat = read("src/utils/supportiq.functions.ts");
  const email = read("src/routes/api/public/crm/support-email.ts");
  const combined = chat + email;

  assert.match(combined, /triage_category/);
  assert.match(combined, /triage_priority/);
  assert.match(combined, /triage_disposition/);
  assert.match(combined, /human_required/);
  assert.match(combined, /supportiq_metadata/);
  assert.match(email, /classifySupportRequest/);
  assert.match(email, /timingSafeEqual/);
});


test("LaunchPad Back invalidates the returned step and persists zero percent at step one", () => {
  assert.deepEqual(
    previousOnboardingProgress({
      currentStep: 2,
      completedSteps: [1],
      totalSteps: 6,
    }),
    {
      currentStep: 1,
      completedSteps: [],
      completedAt: null,
    },
  );
});

test("LaunchPad normalizes inconsistent persisted progress fail-closed", () => {
  assert.deepEqual(
    normalizeOnboardingProgress({
      currentStep: 1,
      completedSteps: [1, 2, 2, 99],
      completedAt: null,
      totalSteps: 6,
    }),
    {
      currentStep: 1,
      completedSteps: [],
      completedAt: null,
    },
  );

  assert.deepEqual(
    normalizeOnboardingProgress({
      currentStep: 6,
      completedSteps: [1, 2, 3, 4, 5, 6],
      completedAt: null,
      totalSteps: 6,
    }),
    {
      currentStep: 6,
      completedSteps: [1, 2, 3, 4, 5],
      completedAt: null,
    },
  );
});
