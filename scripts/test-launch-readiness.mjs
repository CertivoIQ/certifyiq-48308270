import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const requiredFiles = [
  "src/routes/index.tsx",
  "src/routes/welcome.tsx",
  "src/routes/pricing.tsx",
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

test("SupportIQ remains authenticated and human-gated for risky support", () => {
  const route = read("src/routes/_authenticated/supportiq.tsx");
  const triage = read("src/lib/support-triage.mjs");
  assert.match(route, /triageSupportRequest/);
  assert.match(triage, /P0_SECURITY/);
  assert.match(triage, /P1_BILLING/);
  assert.match(triage, /P2_COMPLIANCE_REVIEW/);
  assert.match(triage, /approve_certification/);
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
