import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();

const customerFacingFiles = [
  "src/components/CertivoIQComparisonChart.tsx",
  "src/components/production-dashboard.tsx",
  "src/lib/academy-track-a.ts",
  "src/lib/email-templates/i18n.ts",
  "src/lib/email-templates/payment-succeeded.tsx",
  "src/lib/i18n/en.ts",
  "src/lib/i18n/es.ts",
  "src/lib/trial-data.ts",
  "src/routes/_authenticated/billing.tsx",
  "src/routes/_authenticated/marketing-kit.tsx",
  "src/routes/_authenticated/submission-center.tsx",
  "src/routes/copilot.tsx",
  "src/routes/demo-dashboard.tsx",
  "src/routes/files.$fileId.tsx",
  "src/routes/files.index.tsx",
  "src/routes/launchpad.tsx",
  "src/routes/methodology.tsx",
  "src/routes/security.tsx",
  "src/utils/entitlements.functions.ts",
];

const prohibitedPatterns = [
  /\bAI Compliance\b/i,
  /\bAI Data Use\b/i,
  /\bAI-powered\b/i,
  /\bAI powered\b/i,
  /\bAI review\b/i,
  /\bAI extraction\b/i,
  /\bAI soft\b/i,
  /\bartificial intelligence\b/i,
  /\bgenerative AI\b/i,
  /\bmachine learning\b/i,
  /\bAI document\b/i,
  /\bAI assistant\b/i,
  /\bAI Copilot\b/i,
];

test("customer-facing source contains no prohibited AI branding language", () => {
  const violations = [];

  for (const relativePath of customerFacingFiles) {
    const absolutePath = path.join(root, relativePath);

    assert.ok(
      fs.existsSync(absolutePath),
      `Expected customer-facing file to exist: ${relativePath}`,
    );

    const content = fs.readFileSync(absolutePath, "utf8");

    for (const pattern of prohibitedPatterns) {
      if (pattern.test(content)) {
        violations.push(`${relativePath}: ${pattern}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Prohibited customer-facing terminology found:\n${violations.join("\n")}`,
  );
});