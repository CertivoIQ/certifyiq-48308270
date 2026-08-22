import { createHash } from "node:crypto";

/** Deterministic Test #62 enterprise/project authority intake boundary. */
export const ENTERPRISE_PROJECT_AUTHORITY_ENGINE_BUILD =
  "enterprise-project-authority-2026.08.1";

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const STATE_CODE_PATTERN = /^[A-Z]{2}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const DOCUMENT_SCOPE = Object.freeze({
  FORM_8609: "BUILDING",
  RECORDED_LURA: "PROPERTY",
  LURA_AMENDMENT: "PROPERTY",
  ALLOCATION_OR_42M_LETTER: "PROPERTY",
  BOND_REGULATORY_AGREEMENT: "PROPERTY",
  HOME_WRITTEN_AGREEMENT: "PROPERTY",
  HTF_WRITTEN_AGREEMENT: "PROPERTY",
  HAP_CONTRACT: "PROPERTY",
  RD_REGULATORY_AGREEMENT: "PROPERTY",
  STATE_REGULATORY_AGREEMENT: "PROPERTY",
  LOCAL_REGULATORY_AGREEMENT: "PROPERTY",
  PROJECT_RENT_SCHEDULE: "PROPERTY",
  UTILITY_ALLOWANCE_SCHEDULE: "PROPERTY",
  STATE_AGENCY_WAIVER: "PROPERTY",
});

const DISALLOWED_TENANT_DOCUMENT_TYPES = new Set([
  "TENANT_CERTIFICATION",
  "TENANT_APPLICATION",
  "LEASE",
  "INCOME_VERIFICATION",
  "ASSET_VERIFICATION",
  "STUDENT_CERTIFICATION",
]);

const PROGRAM_REQUIREMENTS = Object.freeze({
  LIHTC: Object.freeze(["FORM_8609", "RECORDED_LURA"]),
  TAX_EXEMPT_BOND: Object.freeze([
    "BOND_REGULATORY_AGREEMENT",
    "ALLOCATION_OR_42M_LETTER",
  ]),
  HOME: Object.freeze(["HOME_WRITTEN_AGREEMENT"]),
  HTF: Object.freeze(["HTF_WRITTEN_AGREEMENT"]),
  HCV_TENANT_BASED: Object.freeze(["HAP_CONTRACT"]),
  HUD_PBV: Object.freeze(["HAP_CONTRACT"]),
  HUD_MFH_PROJECT_BASED: Object.freeze(["HAP_CONTRACT"]),
  RURAL_DEVELOPMENT: Object.freeze(["RD_REGULATORY_AGREEMENT"]),
  STATE_HFA: Object.freeze(["STATE_REGULATORY_AGREEMENT"]),
  LOCAL_PROGRAM: Object.freeze(["LOCAL_REGULATORY_AGREEMENT"]),
});

function uniqueSorted(values = []) {
  return [...new Set(values.map(String))].sort();
}

function blocked(reasonCode, reason, missingInputs = [], details = {}) {
  return {
    resolution_status: "NOT_DETERMINED",
    determination_status: "NOT_DETERMINED",
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    reason_code: reasonCode,
    reason,
    missing_inputs: uniqueSorted(missingInputs),
    agent_action_required: true,
    agent_approval_required: true,
    ...details,
  };
}

function parseIsoDate(value, field) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${field} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`${field} must be a real calendar date`);
  }
  return text;
}

function parseIsoTimestamp(value, field) {
  const text = String(value ?? "");
  const parsed = new Date(text);
  if (!text || Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== text) {
    throw new Error(`${field} must be a canonical ISO-8601 UTC timestamp`);
  }
  return text;
}

function validIdentifier(value) {
  return IDENTIFIER_PATTERN.test(String(value ?? ""));
}

function safeFilename(value) {
  const text = String(value ?? "");
  return (
    text.length > 0 &&
    text.length <= 255 &&
    text !== "." &&
    text !== ".." &&
    !text.includes("/") &&
    !text.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(text)
  );
}

function bytesFrom(value) {
  return value instanceof Uint8Array ? value : null;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function manifestSha256(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function freezeArray(values) {
  return Object.freeze([...values]);
}

function normalizeAuthorization(value) {
  if (!value || value.authorized !== true) {
    throw new Error("The authenticated server did not authorize this upload scope");
  }
  const required = [
    "organization_id",
    "user_id",
    "property_id",
    "state_code",
    "role",
    "authorized_at",
  ];
  for (const field of required) {
    if (value[field] === null || value[field] === undefined || value[field] === "") {
      throw new Error(`Authorized scope is missing ${field}`);
    }
  }
  if (
    !validIdentifier(value.organization_id) ||
    !validIdentifier(value.user_id) ||
    !validIdentifier(value.property_id)
  ) {
    throw new Error("Authorized organization, user, and property identifiers are invalid");
  }
  const stateCode = String(value.state_code).toUpperCase();
  if (!STATE_CODE_PATTERN.test(stateCode)) {
    throw new Error("Authorized state_code must be a two-letter code");
  }
  const buildingBins = uniqueSorted(value.building_bins ?? []);
  const programCodes = uniqueSorted(
    (value.program_codes ?? []).map((code) => String(code).toUpperCase()),
  );
  if (!programCodes.length || programCodes.some((code) => !PROGRAM_REQUIREMENTS[code])) {
    throw new Error("Authorized program inventory is missing or unsupported");
  }
  if (buildingBins.some((bin) => !validIdentifier(bin))) {
    throw new Error("Authorized building identifiers are invalid");
  }
  return Object.freeze({
    organization_id: String(value.organization_id),
    user_id: String(value.user_id),
    property_id: String(value.property_id),
    state_code: stateCode,
    role: String(value.role),
    authorized_at: parseIsoTimestamp(value.authorized_at, "authorized_at"),
    building_bins: freezeArray(buildingBins),
    program_codes: freezeArray(programCodes),
  });
}

function requiredDocumentTypes(programCodes) {
  return uniqueSorted(
    programCodes.flatMap((program) => PROGRAM_REQUIREMENTS[program] ?? []),
  );
}

function activeDocuments(documents) {
  const byLineage = new Map();
  for (const document of documents) {
    const current = byLineage.get(document.document_lineage_id);
    if (!current || document.version_number > current.version_number) {
      byLineage.set(document.document_lineage_id, document);
    }
  }
  return [...byLineage.values()];
}

function lineageTypesCompatible(previousType, nextType) {
  if (previousType === nextType) return true;
  return (
    (previousType === "RECORDED_LURA" || previousType === "LURA_AMENDMENT") &&
    nextType === "LURA_AMENDMENT"
  );
}

function satisfiesDocumentType(document, requiredType) {
  if (document.document_type === requiredType) return true;
  return (
    requiredType === "RECORDED_LURA" &&
    document.document_type === "LURA_AMENDMENT"
  );
}

/**
 * Build one server-owned intake boundary. Receipts issued by another gateway
 * instance are rejected, even when every public field is copied.
 */
export function createEnterpriseProjectAuthorityGateway(adapters = {}) {
  if (typeof adapters.authorizeUpload !== "function") {
    throw new Error("authorizeUpload server adapter is required");
  }
  if (typeof adapters.validateDocumentContent !== "function") {
    throw new Error("validateDocumentContent server adapter is required");
  }
  if (typeof adapters.validateStatePackRelease !== "function") {
    throw new Error("validateStatePackRelease server adapter is required");
  }

  const issuedSessions = new WeakSet();
  const sessionScopes = new WeakMap();
  const issuedReleases = new WeakSet();
  const releaseRecords = new WeakMap();
  const issuedEvaluations = new WeakSet();

  async function beginUploadSession(request = {}) {
    let authorized;
    try {
      authorized = normalizeAuthorization(await adapters.authorizeUpload(request));
    } catch (error) {
      return blocked(
        "ENTERPRISE_UPLOAD_NOT_AUTHORIZED",
        error instanceof Error ? error.message : "Enterprise upload authorization failed.",
        ["authenticated_enterprise_scope"],
      );
    }
    const receipt = Object.freeze({
      session_status: "AUTHORIZED",
      organization_id: authorized.organization_id,
      user_id: authorized.user_id,
      property_id: authorized.property_id,
      state_code: authorized.state_code,
      role: authorized.role,
      building_bins: authorized.building_bins,
      program_codes: authorized.program_codes,
      authorized_at: authorized.authorized_at,
      engine_build: ENTERPRISE_PROJECT_AUTHORITY_ENGINE_BUILD,
    });
    issuedSessions.add(receipt);
    sessionScopes.set(receipt, authorized);
    return receipt;
  }

  async function ingestProjectAuthorityDocuments(input = {}) {
    const session = input.session_receipt;
    if (!session || !issuedSessions.has(session)) {
      return blocked(
        "ENTERPRISE_UPLOAD_SESSION_REQUIRED",
        "Project authority uploads require a receipt from this authenticated server gateway.",
        ["session_receipt"],
      );
    }
    const scope = sessionScopes.get(session);
    const priorRelease = input.prior_release_receipt ?? null;
    let priorDocuments = [];
    if (priorRelease !== null) {
      const prior = releaseRecords.get(priorRelease);
      if (
        !issuedReleases.has(priorRelease) ||
        !prior ||
        prior.scope.organization_id !== scope.organization_id ||
        prior.scope.property_id !== scope.property_id
      ) {
        return blocked(
          "PRIOR_PROJECT_AUTHORITY_RELEASE_INVALID",
          "Version updates require a prior release issued by this gateway for the same enterprise and property.",
          ["prior_release_receipt"],
        );
      }
      priorDocuments = prior.documents;
    }

    if (!Array.isArray(input.documents) || !input.documents.length) {
      return blocked(
        "PROJECT_AUTHORITY_DOCUMENTS_REQUIRED",
        "At least one enterprise-owned project authority document is required.",
        ["documents"],
      );
    }

    const existingById = new Map(priorDocuments.map((document) => [document.document_id, document]));
    const latestByLineage = new Map(
      activeDocuments(priorDocuments).map((document) => [
        document.document_lineage_id,
        document,
      ]),
    );
    const newIds = new Set();
    const newHashes = new Set(
      priorDocuments.map((document) => document.source_sha256),
    );
    const accepted = [];

    for (const [index, document] of input.documents.entries()) {
      const prefix = `documents[${index}]`;
      if (!document || typeof document !== "object" || Array.isArray(document)) {
        return blocked(
          "INVALID_PROJECT_AUTHORITY_DOCUMENT",
          "Each project authority upload must be a structured record.",
          [prefix],
        );
      }
      const type = String(document.document_type ?? "").toUpperCase();
      if (DISALLOWED_TENANT_DOCUMENT_TYPES.has(type)) {
        return blocked(
          "TENANT_DOCUMENT_WRONG_INTAKE_BOUNDARY",
          "Tenant and household records belong in the enterprise tenant-file workflow, not the shared project-authority inventory.",
          [`${prefix}.document_type`],
        );
      }
      if (!DOCUMENT_SCOPE[type]) {
        return blocked(
          "UNRECOGNIZED_PROJECT_AUTHORITY_DOCUMENT_TYPE",
          "The project authority document type is not registered.",
          [`${prefix}.document_type`],
        );
      }
      const required = [
        "document_id",
        "document_lineage_id",
        "organization_id",
        "property_id",
        "uploaded_by_user_id",
        "file_name",
        "mime_type",
        "sha256",
        "version_number",
        "effective_from",
        "uploaded_at",
        "issuer",
      ];
      const missing = required.filter(
        (field) =>
          document[field] === null ||
          document[field] === undefined ||
          document[field] === "",
      );
      if (missing.length) {
        return blocked(
          "PROJECT_AUTHORITY_METADATA_INCOMPLETE",
          "Project authority metadata is incomplete.",
          missing.map((field) => `${prefix}.${field}`),
        );
      }
      if (
        !validIdentifier(document.document_id) ||
        !validIdentifier(document.document_lineage_id) ||
        newIds.has(String(document.document_id)) ||
        existingById.has(String(document.document_id))
      ) {
        return blocked(
          "PROJECT_AUTHORITY_DOCUMENT_ID_CONFLICT",
          "Document identifiers must be valid, unique, and append-only.",
          [`${prefix}.document_id`],
        );
      }
      if (
        String(document.organization_id) !== scope.organization_id ||
        String(document.property_id) !== scope.property_id ||
        String(document.uploaded_by_user_id) !== scope.user_id
      ) {
        return blocked(
          "ENTERPRISE_PROJECT_SCOPE_CONFLICT",
          "A project authority document cannot cross organization, property, or authenticated-uploader boundaries.",
          [
            `${prefix}.organization_id`,
            `${prefix}.property_id`,
            `${prefix}.uploaded_by_user_id`,
          ],
        );
      }
      if (!safeFilename(document.file_name)) {
        return blocked(
          "UNSAFE_PROJECT_AUTHORITY_FILENAME",
          "Uploaded authority filenames must be plain filenames without paths or control characters.",
          [`${prefix}.file_name`],
        );
      }
      if (!ALLOWED_MIME_TYPES.has(String(document.mime_type))) {
        return blocked(
          "PROJECT_AUTHORITY_MIME_TYPE_NOT_ALLOWED",
          "The project authority file type is not allowed.",
          [`${prefix}.mime_type`],
        );
      }
      const bytes = bytesFrom(document.file_bytes);
      if (!bytes || !bytes.byteLength || bytes.byteLength > MAX_DOCUMENT_BYTES) {
        return blocked(
          "PROJECT_AUTHORITY_BYTES_REQUIRED",
          "Actual non-empty authority-document bytes within the size limit are required.",
          [`${prefix}.file_bytes`],
        );
      }
      const actualSha256 = createHash("sha256").update(bytes).digest("hex");
      if (
        !SHA256_PATTERN.test(String(document.sha256)) ||
        actualSha256 !== String(document.sha256) ||
        newHashes.has(actualSha256)
      ) {
        return blocked(
          "PROJECT_AUTHORITY_HASH_CONFLICT",
          "The uploaded bytes must match a unique claimed SHA-256 identity.",
          [`${prefix}.sha256`, `${prefix}.file_bytes`],
          { actual_sha256: actualSha256 },
        );
      }

      const buildingBins = uniqueSorted(document.building_bins ?? []);
      if (
        buildingBins.some((bin) => !scope.building_bins.includes(bin)) ||
        (DOCUMENT_SCOPE[type] === "BUILDING" && buildingBins.length !== 1)
      ) {
        return blocked(
          "PROJECT_AUTHORITY_BUILDING_SCOPE_CONFLICT",
          "Building-scoped authority must identify exactly one authorized BIN; property authority cannot name an unauthorized BIN.",
          [`${prefix}.building_bins`],
        );
      }

      const versionNumber = Number(document.version_number);
      const latest = latestByLineage.get(String(document.document_lineage_id));
      if (!Number.isInteger(versionNumber) || versionNumber < 1) {
        return blocked(
          "PROJECT_AUTHORITY_VERSION_INVALID",
          "Authority document versions must be positive integers.",
          [`${prefix}.version_number`],
        );
      }
      if (
        (!latest &&
          (versionNumber !== 1 || document.supersedes_document_id != null)) ||
        (latest &&
          (versionNumber !== latest.version_number + 1 ||
            String(document.supersedes_document_id ?? "") !== latest.document_id ||
            !lineageTypesCompatible(latest.document_type, type)))
      ) {
        return blocked(
          "PROJECT_AUTHORITY_VERSION_CHAIN_CONFLICT",
          "Updates must append the next version and supersede the current document in a compatible authority lineage.",
          [
            `${prefix}.document_lineage_id`,
            `${prefix}.version_number`,
            `${prefix}.supersedes_document_id`,
          ],
        );
      }

      let effectiveFrom;
      let effectiveTo = null;
      let uploadedAt;
      try {
        effectiveFrom = parseIsoDate(document.effective_from, `${prefix}.effective_from`);
        effectiveTo =
          document.effective_to == null
            ? null
            : parseIsoDate(document.effective_to, `${prefix}.effective_to`);
        uploadedAt = parseIsoTimestamp(document.uploaded_at, `${prefix}.uploaded_at`);
      } catch (error) {
        return blocked(
          "PROJECT_AUTHORITY_DATE_INVALID",
          error.message,
          [prefix],
        );
      }
      if (effectiveTo !== null && effectiveTo < effectiveFrom) {
        return blocked(
          "PROJECT_AUTHORITY_EFFECTIVE_PERIOD_INVALID",
          "Authority effective_to cannot precede effective_from.",
          [`${prefix}.effective_to`],
        );
      }

      let validation;
      try {
        validation = await adapters.validateDocumentContent({
          document_type: type,
          bytes,
          source_sha256: actualSha256,
          organization_id: scope.organization_id,
          property_id: scope.property_id,
          state_code: scope.state_code,
          building_bins: buildingBins,
        });
      } catch (error) {
        return blocked(
          "PROJECT_AUTHORITY_CONTENT_VALIDATION_FAILED",
          error instanceof Error ? error.message : "Authority content validation failed.",
          [`${prefix}.file_bytes`],
        );
      }
      if (
        !validation ||
        validation.validation_status !== "VALIDATED" ||
        validation.document_type !== type ||
        validation.source_sha256 !== actualSha256
      ) {
        return blocked(
          "PROJECT_AUTHORITY_CONTENT_NOT_VALIDATED",
          "Caller booleans cannot replace byte-derived document classification and content validation.",
          [`${prefix}.content_validation_receipt`],
        );
      }

      const record = Object.freeze({
        document_id: String(document.document_id),
        document_lineage_id: String(document.document_lineage_id),
        supersedes_document_id:
          document.supersedes_document_id == null
            ? null
            : String(document.supersedes_document_id),
        version_number: versionNumber,
        document_type: type,
        document_scope: DOCUMENT_SCOPE[type],
        organization_id: scope.organization_id,
        property_id: scope.property_id,
        state_code: scope.state_code,
        building_bins: freezeArray(buildingBins),
        file_name: String(document.file_name),
        mime_type: String(document.mime_type),
        source_sha256: actualSha256,
        byte_length: bytes.byteLength,
        issuer: String(document.issuer),
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
        uploaded_by_user_id: scope.user_id,
        uploaded_at: uploadedAt,
        content_validation_build: String(validation.validator_build ?? ""),
        validated_facts_sha256: manifestSha256(validation.facts ?? {}),
      });
      accepted.push(record);
      newIds.add(record.document_id);
      newHashes.add(actualSha256);
      latestByLineage.set(record.document_lineage_id, record);
    }

    const combinedDocuments = Object.freeze([...priorDocuments, ...accepted]);
    const active = Object.freeze(activeDocuments(combinedDocuments));
    const receipt = Object.freeze({
      release_status: "ACCEPTED",
      organization_id: scope.organization_id,
      property_id: scope.property_id,
      state_code: scope.state_code,
      building_bins: scope.building_bins,
      program_codes: scope.program_codes,
      active_document_count: active.length,
      historical_document_count: combinedDocuments.length,
      authority_manifest_sha256: manifestSha256(combinedDocuments),
      engine_build: ENTERPRISE_PROJECT_AUTHORITY_ENGINE_BUILD,
      agent_approval_required: true,
    });
    issuedReleases.add(receipt);
    releaseRecords.set(receipt, {
      scope,
      documents: combinedDocuments,
      active_documents: active,
    });
    return receipt;
  }

  async function evaluateProjectAuthority(input = {}) {
    const receipt = input.release_receipt;
    const release = releaseRecords.get(receipt);
    if (!receipt || !issuedReleases.has(receipt) || !release) {
      return blocked(
        "PROJECT_AUTHORITY_RELEASE_REQUIRED",
        "Project authority evaluation requires a release issued by this enterprise gateway.",
        ["release_receipt"],
      );
    }

    const requiredTypes = requiredDocumentTypes(release.scope.program_codes);
    const presentTypes = new Set(
      release.active_documents.map((document) => document.document_type),
    );
    const missingTypes = requiredTypes.filter(
      (type) =>
        !release.active_documents.some((document) =>
          satisfiesDocumentType(document, type),
        ),
    );
    const missingBins = release.scope.program_codes.includes("LIHTC")
      ? release.scope.building_bins.filter(
          (bin) =>
            !release.active_documents.some(
              (document) =>
                document.document_type === "FORM_8609" &&
                document.building_bins.includes(bin),
            ),
        )
      : [];

    let statePack;
    try {
      statePack = await adapters.validateStatePackRelease({
        state_code: release.scope.state_code,
        state_pack_receipt: input.state_pack_receipt,
      });
    } catch (error) {
      statePack = {
        validation_status: "BLOCKED",
        reason:
          error instanceof Error ? error.message : "State-pack validation failed.",
      };
    }
    const stateValidated =
      statePack?.validation_status === "VALIDATED" &&
      String(statePack.state_code).toUpperCase() === release.scope.state_code &&
      validIdentifier(statePack.pack_id) &&
      validIdentifier(statePack.version);

    const federalStatus =
      missingTypes.length || missingBins.length ? "BLOCKED" : "VALIDATED";
    const stateStatus = stateValidated ? "VALIDATED" : "BLOCKED";
    const result = Object.freeze({
      resolution_status:
        federalStatus === "VALIDATED" && stateStatus === "VALIDATED"
          ? "COMPLETED"
          : "NOT_DETERMINED",
      determination_status:
        federalStatus === "VALIDATED" && stateStatus === "VALIDATED"
          ? "PASS"
          : "NOT_DETERMINED",
      rule_engine_authority:
        federalStatus === "VALIDATED" && stateStatus === "VALIDATED"
          ? "ALLOWED"
          : "BLOCKED",
      finding:
        federalStatus === "VALIDATED" && stateStatus === "VALIDATED"
          ? "PASS"
          : "UNABLE_TO_DETERMINE",
      organization_id: release.scope.organization_id,
      property_id: release.scope.property_id,
      state_code: release.scope.state_code,
      program_codes: release.scope.program_codes,
      building_bins: release.scope.building_bins,
      federal_project_authority_status: federalStatus,
      state_pack_reconciliation_status: stateStatus,
      state_pack_id: stateValidated ? String(statePack.pack_id) : null,
      state_pack_version: stateValidated ? String(statePack.version) : null,
      required_document_types: freezeArray(requiredTypes),
      active_document_types: freezeArray(uniqueSorted([...presentTypes])),
      missing_document_types: freezeArray(missingTypes),
      missing_form_8609_building_bins: freezeArray(missingBins),
      authority_manifest_sha256: receipt.authority_manifest_sha256,
      caller_required_document_inventory_ignored: true,
      caller_state_pack_booleans_ignored: true,
      agent_action_required:
        federalStatus !== "VALIDATED" || stateStatus !== "VALIDATED",
      agent_approval_required: true,
      engine_build: ENTERPRISE_PROJECT_AUTHORITY_ENGINE_BUILD,
    });
    issuedEvaluations.add(result);
    return result;
  }

  function validateProjectAuthorityHandoff(input = {}) {
    const evaluation = input.evaluation_receipt;
    if (
      !evaluation ||
      !issuedEvaluations.has(evaluation) ||
      evaluation.organization_id !== String(input.organization_id ?? "") ||
      evaluation.property_id !== String(input.property_id ?? "") ||
      !SHA256_PATTERN.test(String(evaluation.authority_manifest_sha256 ?? ""))
    ) {
      return blocked(
        "PROJECT_AUTHORITY_EVALUATION_RECEIPT_REQUIRED",
        "Downstream evaluation requires a receipt issued by this project-authority gateway for the same enterprise property.",
        ["evaluation_receipt"],
      );
    }
    if (evaluation.federal_project_authority_status !== "VALIDATED") {
      return blocked(
        "FEDERAL_PROJECT_AUTHORITY_INCOMPLETE",
        "Required enterprise project authority remains incomplete.",
        [
          ...evaluation.missing_document_types,
          ...evaluation.missing_form_8609_building_bins,
        ],
      );
    }
    if (
      input.require_state_pack === true &&
      evaluation.state_pack_reconciliation_status !== "VALIDATED"
    ) {
      return blocked(
        "VALIDATED_STATE_PACK_REQUIRED",
        "State-specific evaluation requires a validated state pack reconciled to this property authority release.",
        ["state_pack_receipt"],
      );
    }
    return {
      handoff_status: "VALIDATED",
      organization_id: evaluation.organization_id,
      property_id: evaluation.property_id,
      state_code: evaluation.state_code,
      authority_manifest_sha256: evaluation.authority_manifest_sha256,
      federal_project_authority_validated: true,
      state_pack_validated:
        evaluation.state_pack_reconciliation_status === "VALIDATED",
    };
  }

  return Object.freeze({
    beginUploadSession,
    ingestProjectAuthorityDocuments,
    evaluateProjectAuthority,
    validateProjectAuthorityHandoff,
  });
}
