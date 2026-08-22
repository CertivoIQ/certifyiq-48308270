import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createStateRulePackReleaseGateway } from "../src/lib/state-rule-pack-release.mjs";

const encoder = new TextEncoder();

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function makeHarness({
  authorized = true,
  validateFixtures = true,
  validateConflicts = true,
  approveRelease = true,
  allowedStates = ["WV"],
} = {}) {
  const gateway = createStateRulePackReleaseGateway({
    authorizeMaintainer: async () => ({
      authorized,
      user_id: "maintainer-1",
      role: "state_pack_maintainer",
      authorized_at: "2026-08-22T18:00:00.000Z",
      allowed_states: allowedStates,
      program_codes: ["LIHTC"],
      official_domains: ["wvhdf.com"],
    }),
    validateSourceContent: async ({
      state_code,
      source_type,
      bytes,
      source_sha256,
    }) => {
      if (!new TextDecoder().decode(bytes).startsWith(`official:${source_type}:`)) {
        return { validation_status: "BLOCKED" };
      }
      return {
        validation_status: "VALIDATED",
        state_code,
        source_type,
        source_sha256,
        validator_build: "state-source-validator-1",
        identity_facts: { publisher: "WVHDF", classified_from_bytes: true },
      };
    },
    validateSourceConflicts: async ({
      source_manifest_sha256,
      conflict_set_sha256,
    }) => ({
      validation_status: validateConflicts ? "VALIDATED" : "BLOCKED",
      source_manifest_sha256,
      conflict_set_sha256,
      unresolved_conflict_count: validateConflicts ? 0 : 1,
    }),
    validateRuleFixtures: async ({ rule_set_sha256, fixture_set_sha256 }) => ({
      validation_status: validateFixtures ? "VALIDATED" : "BLOCKED",
      rule_set_sha256,
      fixture_set_sha256,
      failed_fixture_count: validateFixtures ? 0 : 1,
    }),
    approveIndependentRelease: async (release) =>
      approveRelease
        ? {
            approval_status: "APPROVED",
            independent_reviewer: true,
            approved_by: "expert-1",
            approved_at: "2026-08-22T18:30:00.000Z",
            source_manifest_sha256: release.source_manifest_sha256,
            rule_set_sha256: release.rule_set_sha256,
            fixture_set_sha256: release.fixture_set_sha256,
          }
        : { approval_status: "BLOCKED" },
  });
  return gateway;
}

function sourceFixture({
  id,
  type,
  lineage = id,
  version = 1,
  supersedes = null,
  text = `${id}-${version}`,
  overrides = {},
}) {
  const bytes = encoder.encode(`official:${type}:${text}`);
  return {
    source_id: id,
    source_lineage_id: lineage,
    supersedes_source_id: supersedes,
    source_type: type,
    title: `${type} source`,
    publisher: "West Virginia Housing Development Fund",
    official_url: `https://www.wvhdf.com/official/${id}.pdf`,
    file_name: `${id}.pdf`,
    mime_type: "application/pdf",
    file_bytes: bytes,
    sha256: sha256(bytes),
    version_number: version,
    published_date: "2026-01-01",
    effective_from: "2026-01-01",
    effective_to: null,
    retrieved_at: "2026-08-22T18:05:00.000Z",
    ...overrides,
  };
}

function completeSources() {
  return [
    sourceFixture({ id: "qap", type: "ALLOCATION_PLAN" }),
    sourceFixture({ id: "program-manual", type: "PROGRAM_MANUAL" }),
    sourceFixture({ id: "compliance-manual", type: "COMPLIANCE_MANUAL" }),
    sourceFixture({
      id: "forms-index",
      type: "COMPLIANCE_FORMS_INDEX",
      overrides: {
        official_url: "https://www.wvhdf.com/programs/multifamily/",
        file_name: "forms-index.html",
        mime_type: "text/html",
      },
    }),
  ];
}

function validRules() {
  return [
    {
      rule_id: "WV-LIHTC-8609-BUILDING",
      version: "1.0.0",
      program_code: "LIHTC",
      source_id: "compliance-manual",
      source_page: 6,
      citation: "Compliance Manual p. 6",
      deterministic_operation: "require one Form 8609 per LIHTC building",
    },
  ];
}

function validFixtures() {
  return [
    "POSITIVE",
    "NEGATIVE",
    "BOUNDARY",
    "LAYERED_PROGRAM",
    "SUPERSESSION",
  ].map((fixtureKind) => ({
    fixture_id: `fixture-${fixtureKind.toLowerCase()}`,
    fixture_kind: fixtureKind,
    rule_id: "WV-LIHTC-8609-BUILDING",
    expected_status: fixtureKind === "NEGATIVE" ? "FAIL" : "PASS",
  }));
}

function resolvedConflicts() {
  return [
    {
      conflict_id: "WV-CURRENCY-001",
      resolution_status: "RESOLVED",
      resolution_citation: "Expert memo tied to official source versions",
      resolved_by: "expert-1",
      resolved_at: "2026-08-22T18:20:00.000Z",
    },
  ];
}

async function sessionFor(gateway) {
  const session = await gateway.beginMaintenanceSession();
  assert.equal(session.session_status, "AUTHORIZED");
  return session;
}

async function bundleFor(gateway, sources = completeSources()) {
  const session = await sessionFor(gateway);
  const bundle = await gateway.ingestOfficialSources({
    session_receipt: session,
    state_code: "WV",
    pack_id: "wv-lihtc",
    pack_version: "2026.1-candidate",
    sources,
  });
  assert.equal(bundle.bundle_status, "VALIDATED");
  return { session, bundle };
}

test("denies maintenance not authorized by the trusted server", async () => {
  const gateway = makeHarness({ authorized: false });
  const result = await gateway.beginMaintenanceSession({ authorized: true });
  assert.equal(result.reason_code, "STATE_PACK_MAINTAINER_NOT_AUTHORIZED");
});

test("requires a maintenance receipt issued by the same gateway", async () => {
  const gateway = makeHarness();
  const result = await gateway.ingestOfficialSources({
    session_receipt: { session_status: "AUTHORIZED" },
    state_code: "WV",
    pack_id: "wv-lihtc",
    pack_version: "2026.1",
    sources: completeSources(),
  });
  assert.equal(result.reason_code, "STATE_PACK_MAINTENANCE_SESSION_REQUIRED");
});

test("rejects tenant and property documents from shared state packs", async () => {
  const gateway = makeHarness();
  const session = await sessionFor(gateway);
  for (const type of ["TENANT_FILE", "FORM_8609", "RECORDED_LURA", "HAP_CONTRACT"]) {
    const result = await gateway.ingestOfficialSources({
      session_receipt: session,
      state_code: "WV",
      pack_id: "wv-lihtc",
      pack_version: "2026.1",
      sources: [sourceFixture({ id: `bad-${type}`, type })],
    });
    assert.equal(result.reason_code, "ENTERPRISE_DOCUMENT_WRONG_STATE_PACK_BOUNDARY");
  }
});

test("enforces state scope and trusted official domains", async () => {
  const gateway = makeHarness();
  const session = await sessionFor(gateway);
  const wrongState = await gateway.ingestOfficialSources({
    session_receipt: session,
    state_code: "OH",
    pack_id: "oh-lihtc",
    pack_version: "2026.1",
    sources: completeSources(),
  });
  assert.equal(wrongState.reason_code, "STATE_PACK_SCOPE_CONFLICT");

  const source = sourceFixture({
    id: "untrusted",
    type: "ALLOCATION_PLAN",
    overrides: { official_url: "https://example.com/qap.pdf" },
  });
  const wrongDomain = await gateway.ingestOfficialSources({
    session_receipt: session,
    state_code: "WV",
    pack_id: "wv-lihtc",
    pack_version: "2026.1",
    sources: [source],
  });
  assert.equal(wrongDomain.reason_code, "UNTRUSTED_STATE_SOURCE_URL");
});

test("requires exact bytes and byte-derived source identity", async () => {
  const gateway = makeHarness();
  const session = await sessionFor(gateway);
  const mismatch = sourceFixture({ id: "mismatch", type: "ALLOCATION_PLAN" });
  mismatch.sha256 = "0".repeat(64);
  const hashResult = await gateway.ingestOfficialSources({
    session_receipt: session,
    state_code: "WV",
    pack_id: "wv-lihtc",
    pack_version: "2026.1",
    sources: [mismatch],
  });
  assert.equal(hashResult.reason_code, "STATE_SOURCE_HASH_CONFLICT");

  const unclassified = sourceFixture({
    id: "unclassified",
    type: "ALLOCATION_PLAN",
    overrides: { caller_validated: true },
  });
  unclassified.file_bytes = encoder.encode("not the claimed official document");
  unclassified.sha256 = sha256(unclassified.file_bytes);
  const contentResult = await gateway.ingestOfficialSources({
    session_receipt: session,
    state_code: "WV",
    pack_id: "wv-lihtc",
    pack_version: "2026.1",
    sources: [unclassified],
  });
  assert.equal(contentResult.reason_code, "STATE_SOURCE_CONTENT_NOT_VALIDATED");
});

test("blocks incomplete LIHTC official-source inventory", async () => {
  const gateway = makeHarness();
  const { bundle } = await bundleFor(gateway, [
    sourceFixture({ id: "qap", type: "ALLOCATION_PLAN" }),
  ]);
  const result = await gateway.createValidatedRelease({
    bundle_receipt: bundle,
    rules: validRules(),
    fixtures: validFixtures(),
    conflicts: resolvedConflicts(),
    effective_from: "2026-09-01",
  });
  assert.equal(result.reason_code, "STATE_PACK_SOURCE_INVENTORY_INCOMPLETE");
  assert.deepEqual(result.missing_inputs, [
    "COMPLIANCE_FORMS_INDEX",
    "COMPLIANCE_MANUAL",
    "PROGRAM_MANUAL",
  ]);
});

test("blocks unresolved currency and supersession conflicts", async () => {
  const gateway = makeHarness();
  const { bundle } = await bundleFor(gateway);
  const result = await gateway.createValidatedRelease({
    bundle_receipt: bundle,
    rules: validRules(),
    fixtures: validFixtures(),
    conflicts: [{ conflict_id: "WV-CURRENCY-001", resolution_status: "UNRESOLVED" }],
    effective_from: "2026-09-01",
  });
  assert.equal(result.reason_code, "STATE_PACK_CONFLICTS_UNRESOLVED");
});

test("does not let a caller omit conflicts known to the trusted validator", async () => {
  const gateway = makeHarness({ validateConflicts: false });
  const { bundle } = await bundleFor(gateway);
  const result = await gateway.createValidatedRelease({
    bundle_receipt: bundle,
    rules: validRules(),
    fixtures: validFixtures(),
    conflicts: [],
    effective_from: "2026-09-01",
    no_known_conflicts: true,
  });
  assert.equal(
    result.reason_code,
    "STATE_PACK_CONFLICT_INVENTORY_NOT_VALIDATED",
  );
});

test("requires every rule to cite an active official source page", async () => {
  const gateway = makeHarness();
  const { bundle } = await bundleFor(gateway);
  const rules = validRules();
  rules[0].source_id = "caller-document";
  const result = await gateway.createValidatedRelease({
    bundle_receipt: bundle,
    rules,
    fixtures: validFixtures(),
    conflicts: resolvedConflicts(),
    effective_from: "2026-09-01",
  });
  assert.equal(result.reason_code, "STATE_PACK_RULE_INVENTORY_INVALID");
});

test("requires all fixture categories and a trusted zero-failure result", async () => {
  const gateway = makeHarness();
  const { bundle } = await bundleFor(gateway);
  const result = await gateway.createValidatedRelease({
    bundle_receipt: bundle,
    rules: validRules(),
    fixtures: validFixtures().filter((fixture) => fixture.fixture_kind !== "SUPERSESSION"),
    conflicts: resolvedConflicts(),
    effective_from: "2026-09-01",
    fixtures_validated: true,
  });
  assert.equal(result.reason_code, "STATE_PACK_FIXTURES_NOT_VALIDATED");
  assert.deepEqual(result.missing_inputs, ["SUPERSESSION"]);

  const failingGateway = makeHarness({ validateFixtures: false });
  const failingBundle = (await bundleFor(failingGateway)).bundle;
  const failingResult = await failingGateway.createValidatedRelease({
    bundle_receipt: failingBundle,
    rules: validRules(),
    fixtures: validFixtures(),
    conflicts: resolvedConflicts(),
    effective_from: "2026-09-01",
  });
  assert.equal(failingResult.reason_code, "STATE_PACK_FIXTURES_NOT_VALIDATED");
});

test("requires independent approval bound to the exact release hashes", async () => {
  const gateway = makeHarness({ approveRelease: false });
  const { bundle } = await bundleFor(gateway);
  const result = await gateway.createValidatedRelease({
    bundle_receipt: bundle,
    rules: validRules(),
    fixtures: validFixtures(),
    conflicts: resolvedConflicts(),
    effective_from: "2026-09-01",
    approved: true,
  });
  assert.equal(result.reason_code, "INDEPENDENT_STATE_PACK_APPROVAL_REQUIRED");
});

test("issues and validates a complete West Virginia release receipt", async () => {
  const gateway = makeHarness();
  const { bundle } = await bundleFor(gateway);
  const release = await gateway.createValidatedRelease({
    bundle_receipt: bundle,
    rules: validRules(),
    fixtures: validFixtures(),
    conflicts: resolvedConflicts(),
    effective_from: "2026-09-01",
    limitations: "LIHTC rules in the approved inventory only.",
  });
  assert.equal(release.validation_status, "VALIDATED");
  assert.equal(release.status, "validated");
  assert.equal(release.state_code, "WV");
  assert.equal(release.validated_rule_count, 1);
  assert.equal(
    gateway.validateStatePackRelease({
      state_code: "WV",
      state_pack_receipt: release,
    }).validation_status,
    "VALIDATED",
  );
});

test("rejects copied or cross-state release receipts", async () => {
  const gateway = makeHarness();
  const { bundle } = await bundleFor(gateway);
  const release = await gateway.createValidatedRelease({
    bundle_receipt: bundle,
    rules: validRules(),
    fixtures: validFixtures(),
    conflicts: resolvedConflicts(),
    effective_from: "2026-09-01",
  });
  assert.equal(
    gateway.validateStatePackRelease({
      state_code: "WV",
      state_pack_receipt: { ...release },
    }).reason_code,
    "TRUSTED_STATE_PACK_RELEASE_REQUIRED",
  );
  assert.equal(
    gateway.validateStatePackRelease({
      state_code: "OH",
      state_pack_receipt: release,
    }).reason_code,
    "TRUSTED_STATE_PACK_RELEASE_REQUIRED",
  );
});

test("enforces append-only official-source version lineage", async () => {
  const gateway = makeHarness();
  const { session, bundle } = await bundleFor(gateway);
  const update = sourceFixture({
    id: "program-manual-v2",
    lineage: "program-manual",
    type: "PROGRAM_MANUAL",
    version: 2,
    supersedes: "program-manual",
  });
  const second = await gateway.ingestOfficialSources({
    session_receipt: session,
    prior_bundle_receipt: bundle,
    state_code: "WV",
    pack_id: "wv-lihtc",
    pack_version: "2026.2-candidate",
    sources: [update],
  });
  assert.equal(second.bundle_status, "VALIDATED");

  const skipped = sourceFixture({
    id: "program-manual-v4",
    lineage: "program-manual",
    type: "PROGRAM_MANUAL",
    version: 4,
    supersedes: "program-manual-v2",
  });
  const bad = await gateway.ingestOfficialSources({
    session_receipt: session,
    prior_bundle_receipt: second,
    state_code: "WV",
    pack_id: "wv-lihtc",
    pack_version: "2026.4-candidate",
    sources: [skipped],
  });
  assert.equal(bad.reason_code, "STATE_SOURCE_VERSION_CHAIN_CONFLICT");
});
