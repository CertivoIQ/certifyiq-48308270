import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createEnterpriseProjectAuthorityGateway } from "../src/lib/enterprise-project-authority-intake.mjs";

const encoder = new TextEncoder();
const uploadedAt = "2026-08-22T17:05:00.000Z";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function makeHarness({
  authorized = true,
  programs = ["LIHTC"],
  bins = ["WV-26-00001", "WV-26-00002"],
} = {}) {
  const trustedStateReceipts = new WeakSet();
  const stateReceipt = Object.freeze({ registry_identity: "wv-release-1" });
  trustedStateReceipts.add(stateReceipt);
  const gateway = createEnterpriseProjectAuthorityGateway({
    authorizeUpload: async () => ({
      authorized,
      organization_id: "org-1",
      user_id: "user-1",
      property_id: "property-1",
      state_code: "WV",
      role: "compliance_admin",
      authorized_at: "2026-08-22T17:00:00.000Z",
      building_bins: bins,
      program_codes: programs,
    }),
    validateDocumentContent: async ({
      document_type,
      bytes,
      source_sha256,
    }) => {
      const decoded = new TextDecoder().decode(bytes);
      if (!decoded.startsWith(`trusted:${document_type}:`)) {
        return { validation_status: "BLOCKED" };
      }
      return {
        validation_status: "VALIDATED",
        document_type,
        source_sha256,
        validator_build: "test-byte-validator-1",
        facts: { classified_from_bytes: true },
      };
    },
    validateStatePackRelease: async ({ state_code, state_pack_receipt }) =>
      state_code === "WV" && trustedStateReceipts.has(state_pack_receipt)
        ? {
            validation_status: "VALIDATED",
            state_code: "WV",
            pack_id: "wv-lihtc",
            version: "2026.1",
          }
        : { validation_status: "BLOCKED" },
  });
  return { gateway, stateReceipt };
}

function documentFixture({
  id,
  lineage = id,
  type,
  bin,
  version = 1,
  supersedes = null,
  text = `${id}-${version}`,
  overrides = {},
}) {
  const bytes = encoder.encode(`trusted:${type}:${text}`);
  return {
    document_id: id,
    document_lineage_id: lineage,
    supersedes_document_id: supersedes,
    organization_id: "org-1",
    property_id: "property-1",
    uploaded_by_user_id: "user-1",
    document_type: type,
    building_bins: bin ? [bin] : [],
    file_name: `${id}.pdf`,
    mime_type: "application/pdf",
    file_bytes: bytes,
    sha256: sha256(bytes),
    version_number: version,
    effective_from: "2026-01-01",
    effective_to: null,
    uploaded_at: uploadedAt,
    issuer: "Authorized issuer",
    ...overrides,
  };
}

async function authorizedSession(gateway) {
  const session = await gateway.beginUploadSession({ caller_claims: "ignored" });
  assert.equal(session.session_status, "AUTHORIZED");
  return session;
}

function completeLihtcDocuments() {
  return [
    documentFixture({ id: "f8609-a", type: "FORM_8609", bin: "WV-26-00001" }),
    documentFixture({ id: "f8609-b", type: "FORM_8609", bin: "WV-26-00002" }),
    documentFixture({ id: "lura-1", type: "RECORDED_LURA" }),
  ];
}

test("denies an upload session not authorized by the trusted server", async () => {
  const { gateway } = makeHarness({ authorized: false });
  const result = await gateway.beginUploadSession({ authorized: true });
  assert.equal(result.reason_code, "ENTERPRISE_UPLOAD_NOT_AUTHORIZED");
  assert.equal(result.rule_engine_authority, "BLOCKED");
});

test("requires a session receipt issued by the same gateway", async () => {
  const { gateway } = makeHarness();
  const result = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: { session_status: "AUTHORIZED" },
    documents: completeLihtcDocuments(),
  });
  assert.equal(result.reason_code, "ENTERPRISE_UPLOAD_SESSION_REQUIRED");
});

test("blocks cross-enterprise, property, and uploader scope spoofing", async () => {
  const { gateway } = makeHarness();
  const session = await authorizedSession(gateway);
  for (const [field, value] of [
    ["organization_id", "org-2"],
    ["property_id", "property-2"],
    ["uploaded_by_user_id", "user-2"],
  ]) {
    const result = await gateway.ingestProjectAuthorityDocuments({
      session_receipt: session,
      documents: [
        documentFixture({
          id: `scope-${field}`,
          type: "RECORDED_LURA",
          overrides: { [field]: value },
        }),
      ],
    });
    assert.equal(result.reason_code, "ENTERPRISE_PROJECT_SCOPE_CONFLICT");
  }
});

test("rejects tenant records at the project-authority boundary", async () => {
  const { gateway } = makeHarness();
  const session = await authorizedSession(gateway);
  const result = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    documents: [documentFixture({ id: "lease-1", type: "LEASE" })],
  });
  assert.equal(result.reason_code, "TENANT_DOCUMENT_WRONG_INTAKE_BOUNDARY");
});

test("derives identity and classification from actual bytes", async () => {
  const { gateway } = makeHarness();
  const session = await authorizedSession(gateway);
  const hashMismatch = documentFixture({ id: "bad-hash", type: "RECORDED_LURA" });
  hashMismatch.sha256 = "0".repeat(64);
  const hashResult = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    documents: [hashMismatch],
  });
  assert.equal(hashResult.reason_code, "PROJECT_AUTHORITY_HASH_CONFLICT");

  const untrustedBytes = documentFixture({
    id: "bad-content",
    type: "RECORDED_LURA",
    overrides: { content_validated: true },
  });
  untrustedBytes.file_bytes = encoder.encode("caller says this is valid");
  untrustedBytes.sha256 = sha256(untrustedBytes.file_bytes);
  const contentResult = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    documents: [untrustedBytes],
  });
  assert.equal(contentResult.reason_code, "PROJECT_AUTHORITY_CONTENT_NOT_VALIDATED");
});

test("validates a complete building-level LIHTC authority inventory", async () => {
  const { gateway, stateReceipt } = makeHarness();
  const session = await authorizedSession(gateway);
  const release = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    documents: completeLihtcDocuments(),
  });
  assert.equal(release.release_status, "ACCEPTED");
  const evaluation = await gateway.evaluateProjectAuthority({
    release_receipt: release,
    state_pack_receipt: stateReceipt,
    required_document_types: [],
    state_pack_validated: true,
  });
  assert.equal(evaluation.resolution_status, "COMPLETED");
  assert.equal(evaluation.federal_project_authority_status, "VALIDATED");
  assert.equal(evaluation.state_pack_reconciliation_status, "VALIDATED");
  assert.deepEqual(evaluation.missing_form_8609_building_bins, []);
});

test("preserves the validated federal result when the state pack is blocked", async () => {
  const { gateway } = makeHarness();
  const session = await authorizedSession(gateway);
  const release = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    documents: completeLihtcDocuments(),
  });
  const evaluation = await gateway.evaluateProjectAuthority({
    release_receipt: release,
    state_pack_receipt: { registry_identity: "forged" },
    state_pack_validated: true,
  });
  assert.equal(evaluation.federal_project_authority_status, "VALIDATED");
  assert.equal(evaluation.state_pack_reconciliation_status, "BLOCKED");
  assert.equal(evaluation.rule_engine_authority, "BLOCKED");
  assert.equal(
    gateway.validateProjectAuthorityHandoff({
      evaluation_receipt: evaluation,
      organization_id: "org-1",
      property_id: "property-1",
      require_state_pack: false,
    }).handoff_status,
    "VALIDATED",
  );
  assert.equal(
    gateway.validateProjectAuthorityHandoff({
      evaluation_receipt: evaluation,
      organization_id: "org-1",
      property_id: "property-1",
      require_state_pack: true,
    }).reason_code,
    "VALIDATED_STATE_PACK_REQUIRED",
  );
});

test("reports missing Form 8609 building coverage and recorded LURA", async () => {
  const { gateway, stateReceipt } = makeHarness();
  const session = await authorizedSession(gateway);
  const release = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    documents: [
      documentFixture({ id: "only-8609", type: "FORM_8609", bin: "WV-26-00001" }),
    ],
  });
  const evaluation = await gateway.evaluateProjectAuthority({
    release_receipt: release,
    state_pack_receipt: stateReceipt,
  });
  assert.equal(evaluation.federal_project_authority_status, "BLOCKED");
  assert.deepEqual(evaluation.missing_document_types, ["RECORDED_LURA"]);
  assert.deepEqual(evaluation.missing_form_8609_building_bins, ["WV-26-00002"]);
});

test("supports append-only LURA amendment lineage and rejects rewrites", async () => {
  const { gateway, stateReceipt } = makeHarness({ bins: ["WV-26-00001"] });
  const session = await authorizedSession(gateway);
  const first = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    documents: [
      documentFixture({ id: "f8609", type: "FORM_8609", bin: "WV-26-00001" }),
      documentFixture({ id: "lura-v1", lineage: "lura", type: "RECORDED_LURA" }),
    ],
  });
  const second = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    prior_release_receipt: first,
    documents: [
      documentFixture({
        id: "lura-v2",
        lineage: "lura",
        type: "LURA_AMENDMENT",
        version: 2,
        supersedes: "lura-v1",
      }),
    ],
  });
  assert.equal(second.release_status, "ACCEPTED");
  const evaluation = await gateway.evaluateProjectAuthority({
    release_receipt: second,
    state_pack_receipt: stateReceipt,
  });
  assert.equal(evaluation.federal_project_authority_status, "VALIDATED");
  assert.deepEqual(evaluation.missing_document_types, []);

  const rewrite = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    prior_release_receipt: second,
    documents: [
      documentFixture({
        id: "lura-v4",
        lineage: "lura",
        type: "LURA_AMENDMENT",
        version: 4,
        supersedes: "lura-v2",
      }),
    ],
  });
  assert.equal(rewrite.reason_code, "PROJECT_AUTHORITY_VERSION_CHAIN_CONFLICT");
});

test("rejects reused bytes across append-only releases", async () => {
  const { gateway } = makeHarness();
  const session = await authorizedSession(gateway);
  const original = documentFixture({ id: "rent-v1", lineage: "rent", type: "PROJECT_RENT_SCHEDULE" });
  const first = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    documents: [original],
  });
  const duplicate = documentFixture({
    id: "rent-v2",
    lineage: "rent",
    type: "PROJECT_RENT_SCHEDULE",
    version: 2,
    supersedes: "rent-v1",
  });
  duplicate.file_bytes = original.file_bytes;
  duplicate.sha256 = original.sha256;
  const result = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    prior_release_receipt: first,
    documents: [duplicate],
  });
  assert.equal(result.reason_code, "PROJECT_AUTHORITY_HASH_CONFLICT");
});

test("requires program-specific HOME authority instead of LIHTC documents", async () => {
  const { gateway, stateReceipt } = makeHarness({ programs: ["HOME"], bins: [] });
  const session = await authorizedSession(gateway);
  const release = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    documents: [documentFixture({ id: "lura-home", type: "RECORDED_LURA" })],
  });
  const evaluation = await gateway.evaluateProjectAuthority({
    release_receipt: release,
    state_pack_receipt: stateReceipt,
    required_document_types: ["RECORDED_LURA"],
  });
  assert.deepEqual(evaluation.required_document_types, ["HOME_WRITTEN_AGREEMENT"]);
  assert.deepEqual(evaluation.missing_document_types, ["HOME_WRITTEN_AGREEMENT"]);
});

test("rejects copied receipts across gateway instances", async () => {
  const first = makeHarness();
  const second = makeHarness();
  const session = await authorizedSession(first.gateway);
  const result = await second.gateway.ingestProjectAuthorityDocuments({
    session_receipt: { ...session },
    documents: completeLihtcDocuments(),
  });
  assert.equal(result.reason_code, "ENTERPRISE_UPLOAD_SESSION_REQUIRED");
});

test("blocks unsafe filenames and unauthorized building identifiers", async () => {
  const { gateway } = makeHarness();
  const session = await authorizedSession(gateway);
  const unsafe = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    documents: [
      documentFixture({
        id: "unsafe",
        type: "RECORDED_LURA",
        overrides: { file_name: "../authority.pdf" },
      }),
    ],
  });
  assert.equal(unsafe.reason_code, "UNSAFE_PROJECT_AUTHORITY_FILENAME");

  const wrongBuilding = await gateway.ingestProjectAuthorityDocuments({
    session_receipt: session,
    documents: [
      documentFixture({ id: "wrong-bin", type: "FORM_8609", bin: "OH-OTHER" }),
    ],
  });
  assert.equal(wrongBuilding.reason_code, "PROJECT_AUTHORITY_BUILDING_SCOPE_CONFLICT");
});
