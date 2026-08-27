import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const customerFacingApprovalSurfaces = [
  "src/routes/__root.tsx",
  "src/routes/welcome.tsx",
  "src/routes/methodology.tsx",
  "src/components/CertivoIQVoiceoverVideoBase.tsx",
  "src/routes/_authenticated/marketing-kit.tsx",
  "src/routes/demo-dashboard.tsx",
  "src/routes/files.index.tsx",
  "src/routes/files.$fileId.tsx",
  "src/components/FreeReviewLeadGate.tsx",
  "src/components/certification-review-panel.tsx",
  "src/routes/pha/$persona.tsx",
  "src/lib/merlin-knowledge.server.ts",
  "src/lib/enterprise-licensing.server.ts",
  "src/lib/support-triage.mjs",
  "src/utils/supportiq.functions.ts",
  "src/routes/api/public/crm/support-email.ts",
];

test("customer-facing approval wording uses the authorized compliance vocabulary", () => {
  const violations = [];
  for (const path of customerFacingApprovalSurfaces) {
    const source = read(path);
    for (const pattern of [/\bhuman\b/i, /soft[- ]?approv/i, /all 50 states/i]) {
      if (pattern.test(source)) violations.push(`${path}: ${pattern}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("public capability claims stay behind controlled-source activation", () => {
  const root = read("src/routes/__root.tsx");
  const welcome = read("src/routes/welcome.tsx");
  const methodology = read("src/routes/methodology.tsx");
  const explainer = read("src/components/CertivoIQVoiceoverVideoBase.tsx");
  const merlin = read("src/lib/merlin-knowledge.server.ts");
  const publicCopy = [root, welcome, methodology, explainer].join("\n");

  assert.doesNotMatch(
    publicCopy,
    /supported federal LIHTC, HOME, Project-Based Section 8, and HOTMA/i,
  );
  assert.doesNotMatch(root, /reviews LIHTC, Section 8, HOME and HOTMA certifications/i);
  assert.match(welcome, /required federal controls, source versions, and inputs are active/i);
  assert.match(methodology, /do not produce a supported determination/i);
  assert.match(merlin, /Unable to Determine/);
  assert.match(merlin, /authorized compliance approval remains required/i);
});

test("paid model use and live billing fail closed until explicitly verified", () => {
  const root = read("src/routes/__root.tsx");
  const chat = read("src/routes/api/chat.ts");
  const review = read("src/components/certification-review-panel.tsx");
  const payments = read("src/utils/payments.functions.ts");
  const invoices = read("src/lib/enterprise-invoice.functions.ts");
  const stripe = read("src/lib/stripe.server.ts");

  assert.match(root, /VITE_MERLIN_PUBLIC_CHAT_ENABLED/);
  assert.match(root, /PUBLIC_MERLIN_ENABLED \? <WizardHelper \/> : null/);
  assert.match(chat, /MERLIN_PUBLIC_CHAT_ENABLED/);
  assert.match(chat, /MAX_CHAT_BYTES/);
  assert.match(chat, /approvedOrigin/);
  assert.match(review, /useAi:\s*false/);
  assert.match(payments, /Live billing is not verified for release/);
  assert.match(invoices, /Live billing is not verified for release/);
  assert.match(stripe, /assertLiveBillingConfiguration/);
});

test("the free-review funnel does not resurrect obsolete feature tiers", () => {
  const gate = read("src/components/FreeReviewLeadGate.tsx");
  assert.doesNotMatch(gate, /Professional up to|Business up to|Enterprise above/i);
  assert.match(gate, /there are no public feature tiers/i);
  assert.match(gate, /lead\.isError/);
  assert.match(gate, /Sign in before opening the certification queue/);
});

test("environment configuration is injected and never committed", () => {
  for (const path of [".env", ".env.development", ".env.production"]) {
    assert.equal(existsSync(path), false, `${path} must not be tracked`);
  }
  assert.match(read(".gitignore"), /^\.env$/m);
  assert.match(read(".gitignore"), /^\.env\.\*$/m);
});

test("every advertised upload format has a verified processing path", () => {
  const upload = read("src/components/compliance-intelligence-suite.tsx");
  const ocr = read("src/lib/pdf-ocr.ts");
  const extraction = read("src/lib/certification-extraction.server.ts");

  assert.doesNotMatch(upload, /\.zip|or ZIP/);
  assert.match(upload, /prepareImageForReview/);
  assert.match(ocr, /isImageFile/);
  assert.match(ocr, /sourceSha256/);
  assert.match(ocr, /ocrConfidence/);
  assert.match(extraction, /requires a verified OCR sidecar or is not supported/);
});

test("the three-review offer is enforced server-side and serialized", () => {
  const migration = read("supabase/migrations/20260827200000_enforce_free_review_limit.sql");
  const state = read("src/lib/entitlements.server.ts");

  assert.match(migration, /before insert on public\.certification_import_items/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /existing_reviews >= 3/);
  assert.match(migration, /has_active_subscription/);
  assert.doesNotMatch(migration, /application\/zip/);
  assert.match(state, /freeReviewCount/);
  assert.match(state, /isTrial \? freeReviewCount/);
});

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

test("standalone legacy approval wording never returns to application source", () => {
  const violations = sourceFiles("src")
    .filter((path) => /\.(?:ts|tsx|mjs|json)$/.test(path))
    .filter((path) => /\bhuman\b/i.test(read(path)));
  assert.deepEqual(violations, []);
});
