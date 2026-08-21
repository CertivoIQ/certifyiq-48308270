import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

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
  "public/sitemap.xml",
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


test("public pricing uses the single annual platform license", () => {
  const pricing = read("src/routes/pricing.tsx");
  const catalog = read("src/lib/platform-data.ts");
  const combined = pricing + catalog;

  assert.match(combined, /\$65,000/);
  assert.match(pricing, /Request a Demo/i);
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
  ];
  const combined = files.map(read).join("\n");

  assert.match(combined, /Federal baseline/i);
  assert.match(combined, /Manual Review/);
  assert.match(combined, /Agent Approval/);
  assert.match(combined, /Agent Signature/);
  assert.doesNotMatch(combined, /human review|human approval|human verification|human sign-off/i);
  assert.doesNotMatch(combined, /coverage for all 50 states|compliance intelligence for all 50 states/i);
});

test("public acquisition uses demo requests instead of free-file intake", () => {
  const files = [
    "src/routes/welcome.tsx",
    "src/routes/pricing.tsx",
    "src/components/CertivoIQVoiceoverVideo.tsx",
    "src/components/CertivoIQVoiceoverVideoBase.tsx",
    "src/components/explainer-video.tsx",
  ];
  const combined = files.map(read).join("\n");

  assert.match(combined, /Request a Demo/i);
  assert.doesNotMatch(combined, /TRY CERTIVOIQ FOR FREE|3 FREE CERTIFICATION REVIEWS|NO CREDIT CARD REQUIRED/);
});

test("primary application navigation excludes removed training and free-review products", () => {
  const shell = read("src/components/app-shell.tsx");
  assert.doesNotMatch(shell, /to=["']\/academy["']/);
  assert.doesNotMatch(shell, /to=["']\/trial["']/);
});
