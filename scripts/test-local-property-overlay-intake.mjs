import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import {
  DIRECTORY_SOURCE_ROLE,
  PROPERTY_SOURCE_ROLE,
  ingestJurisdictionDirectorySource,
  evaluateLocalOverlayActivation,
  evaluatePropertyAuthorityActivation,
  resolveOverlayAuthorityHierarchy,
} from "../src/lib/local-property-overlay-intake.mjs";

const bytes = new TextEncoder().encode("official authority bytes");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const approvals = [
  { approved_by: "reviewer-a", approved_at: "2026-08-25T20:00:00Z" },
  { approved_by: "reviewer-b", approved_at: "2026-08-25T20:05:00Z" },
];

function source(overrides = {}) {
  return {
    source_id: "src-1",
    source_type: "PHA_DIRECTORY",
    state_code: "TN",
    official_url: "https://example.gov/directory.pdf",
    allowed_domains: ["example.gov"],
    effective_from: "2026-01-01",
    file_bytes: bytes,
    sha256,
    ...overrides,
  };
}

test("directory sources are discovery-only and never become compliance authority", () => {
  const result = ingestJurisdictionDirectorySource(source());
  assert.equal(result.status, "STAGED");
  assert.equal(result.role, DIRECTORY_SOURCE_ROLE);
  assert.equal(result.complianceRuleAuthority, false);
});

test("untrusted directory domains fail closed", () => {
  const result = ingestJurisdictionDirectorySource(
    source({ official_url: "https://not-example.gov/directory.pdf" }),
  );
  assert.equal(result.status, "BLOCKED");
});

test("local overlay activation requires jurisdiction, programs, exact bytes, and independent approval", () => {
  const result = evaluateLocalOverlayActivation(
    source({
      source_type: "PHA_ADMIN_PLAN",
      jurisdiction_id: "TN-PHA-001",
      programs: ["HCV_TENANT_BASED", "HUD_PBV"],
      approvals,
    }),
  );
  assert.equal(result.status, "ACTIVE");
  assert.deepEqual(result.programs, ["HCV_TENANT_BASED", "HUD_PBV"]);
});

test("property authority cannot activate without property verification", () => {
  const result = evaluatePropertyAuthorityActivation({
    document_id: "doc-1",
    document_type: "LURA",
    property_id: "property-1",
    state_code: "TN",
    official_url: "https://owner.example.gov/lura.pdf",
    allowed_domains: ["example.gov"],
    effective_from: "2026-01-01",
    file_bytes: bytes,
    sha256,
    programs: ["LIHTC"],
    approvals,
    property_verified: false,
  });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("property_verified"));
});

test("verified property authority activates but is never shareable as state or directory authority", () => {
  const result = evaluatePropertyAuthorityActivation({
    document_id: "doc-2",
    document_type: "REGULATORY_AGREEMENT",
    property_id: "property-1",
    state_code: "TN",
    official_url: "https://owner.example.gov/regulatory.pdf",
    allowed_domains: ["example.gov"],
    effective_from: "2026-01-01",
    file_bytes: bytes,
    sha256,
    programs: ["LIHTC", "HOME"],
    approvals,
    property_verified: true,
  });
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.role, PROPERTY_SOURCE_ROLE);
  assert.equal(result.shareableAsStateOrDirectoryAuthority, false);
});

test("authority resolution honors federal to state to local to property order and blocks conflicts", () => {
  const clean = resolveOverlayAuthorityHierarchy({
    federal: { status: "ACTIVE" },
    state: { status: "ACTIVE" },
    local: { status: "ACTIVE" },
    property: { status: "ACTIVE" },
  });
  assert.deepEqual(clean.orderedAuthority, ["FEDERAL", "STATE", "LOCAL_PHA", "PROPERTY"]);
  assert.equal(clean.effectiveAuthority, "PROPERTY");
  assert.equal(clean.ruleEvaluationAllowed, true);

  const conflict = resolveOverlayAuthorityHierarchy({
    federal: { status: "ACTIVE" },
    property: { status: "ACTIVE" },
    conflict: true,
  });
  assert.equal(conflict.conflictRequiresHumanReview, true);
  assert.equal(conflict.ruleEvaluationAllowed, false);
});
