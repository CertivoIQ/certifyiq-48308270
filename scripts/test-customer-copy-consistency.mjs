import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("welcome experience does not claim a single all-features platform license", () => {
  const welcome = read("src/routes/welcome.tsx");
  const calculator = read("src/components/CostComparisonCalculator.tsx");
  const customerCopy = `${welcome}\n${calculator}`;

  assert.doesNotMatch(customerCopy, /all currently available platform features/i);
  assert.doesNotMatch(
    customerCopy,
    /(single|one)\s+(annual\s+)?(platform\s+)?license/i,
    "welcome experience must not present one all-inclusive platform license",
  );
  assert.match(calculator, /COMMERCIAL_TERMS\.multifamilyAnnualPerStateUsd/);
  assert.match(calculator, /per selected state per year/);
  assert.match(calculator, /flat organization-level PHA license/);
});

test("pricing page renders commercial terms from the authoritative catalog", () => {
  const pricing = read("src/routes/pricing.tsx");
  const catalog = read("src/lib/plan-catalog.ts");

  assert.match(pricing, /import \{ COMMERCIAL_TERMS \} from "@\/lib\/plan-catalog"/);
  assert.match(pricing, /COMMERCIAL_TERMS\.multifamilyAnnualPerStateUsd/);
  assert.match(pricing, /COMMERCIAL_TERMS\.phaAnnualUsd/);
  assert.match(catalog, /multifamilyAnnualPerStateUsd: 65_000/);
  assert.match(catalog, /phaAnnualUsd: 150_000/);
});
