import assert from "node:assert/strict";
import test from "node:test";
import { importYardiVoyagerCsv, reconcileYardiImport } from "../src/lib/yardi-voyager-import.mjs";

test("normalizes a valid Yardi Voyager CSV export", () => {
  const csv = [
    "Property Code,Property Name,Unit Code,Resident Code,Resident Name,Certification Type,Effective Date,Annual Income,Status",
    'MG01,"Meridian Gardens",204,R-100,"Taylor, Jordan",Annual,08/01/2026,"$42,000.00",Current',
  ].join("\n");
  const result = importYardiVoyagerCsv(csv);
  assert.deepEqual(result.summary, { total: 1, accepted: 1, rejected: 0, duplicates: 0 });
  assert.equal(result.records[0].property.externalId, "MG01");
  assert.equal(result.records[0].household.name, "Taylor, Jordan");
  assert.equal(result.records[0].certification.effectiveDate, "2026-08-01");
  assert.equal(result.records[0].certification.annualIncome, 42000);
  assert.equal(reconcileYardiImport(result).readyToCommit, true);
});

test("blocks missing identifiers, malformed values, and duplicate records", () => {
  const csv = [
    "Property Code,Unit Code,Resident Code,Effective Date,Annual Income",
    "MG01,204,R-100,not-a-date,not-income",
    "MG01,204,R-100,,42000",
    "MG01,204,R-100,,42000",
    "MG01,,R-101,08/02/2026,39000",
  ].join("\n");
  const result = importYardiVoyagerCsv(csv);
  assert.deepEqual(result.summary, { total: 4, accepted: 1, rejected: 3, duplicates: 1 });
  assert.ok(result.errors.some((error) => error.field === "effectiveDate"));
  assert.ok(result.errors.some((error) => error.field === "annualIncome"));
  assert.ok(result.errors.some((error) => error.field === "externalRecordKey"));
  assert.ok(result.errors.some((error) => error.field === "unitCode"));
  assert.equal(reconcileYardiImport(result).readyToCommit, false);
});

test("requires the minimum Yardi export columns", () => {
  const result = importYardiVoyagerCsv("Property Name,Unit Code\nMeridian Gardens,204");
  assert.equal(result.records.length, 0);
  assert.ok(result.errors.some((error) => error.field === "propertyCode"));
  assert.ok(result.errors.some((error) => error.field === "residentCode"));
  assert.equal(reconcileYardiImport(result).totalsMatch, true);
});
