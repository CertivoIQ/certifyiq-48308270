import { createHash } from "node:crypto";

/** Deterministic Test #63 state-rule-pack source and release boundary. */
export const STATE_RULE_PACK_RELEASE_ENGINE_BUILD =
  "state-rule-pack-release-2026.08.1";

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const STATE_PATTERN = /^[A-Z]{2}$/;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "text/html"]);

const SOURCE_TYPES = new Set([
  "ALLOCATION_PLAN",
  "PROGRAM_MANUAL",
  "COMPLIANCE_MANUAL",
  "COMPLIANCE_FORMS_INDEX",
  "OFFICIAL_BLANK_FORM",
  "OFFICIAL_NOTICE",
  "UTILITY_ALLOWANCE_GUIDANCE",
  "STATE_STATUTE_OR_RULE",
]);

const DISALLOWED_SOURCE_TYPES = new Set([
  "COMPLETED_TENANT_FORM",
  "TENANT_FILE",
  "LEASE",
  "FORM_8609",
  "RECORDED_LURA",
  "HAP_CONTRACT",
  "PROJECT_REGULATORY_AGREEMENT",
]);

const PROGRAM_SOURCE_REQUIREMENTS = Object.freeze({
  LIHTC: Object.freeze([
    "ALLOCATION_PLAN",
    "PROGRAM_MANUAL",
    "COMPLIANCE_MANUAL",
    "COMPLIANCE_FORMS_INDEX",
  ]),
  HOME: Object.freeze(["PROGRAM_MANUAL", "COMPLIANCE_FORMS_INDEX"]),
  HTF: Object.freeze(["PROGRAM_MANUAL", "COMPLIANCE_FORMS_INDEX"]),
});

const REQUIRED_FIXTURE_KINDS = Object.freeze([
  "POSITIVE",
  "NEGATIVE",
  "BOUNDARY",
  "LAYERED_PROGRAM",
  "SUPERSESSION",
]);

function uniqueSorted(values = []) {
  return [...new Set(values.map(String))].sort();
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

function sha256Value(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function blocked(reasonCode, reason, missingInputs = [], details = {}) {
  return {
    validation_status: "BLOCKED",
    status: "federal_baseline",
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

function parseDate(value, field) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${field} must use YYYY-MM-DD`);
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error(`${field} must be a real calendar date`);
  }
  return text;
}

function parseTimestamp(value, field) {
  const text = String(value ?? "");
  const date = new Date(text);
  if (!text || Number.isNaN(date.valueOf()) || date.toISOString() !== text) {
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

function normalizeHostname(value) {
  return String(value ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

function officialUrl(value, domains) {
  let url;
  try {
    url = new URL(String(value ?? ""));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
  const hostname = normalizeHostname(url.hostname);
  if (
    !domains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    )
  ) {
    return null;
  }
  return url.toString();
}

function activeSources(sources) {
  const latest = new Map();
  for (const source of sources) {
    const current = latest.get(source.source_lineage_id);
    if (!current || source.version_number > current.version_number) {
      latest.set(source.source_lineage_id, source);
    }
  }
  return [...latest.values()];
}

function requiredSourceTypes(programs) {
  return uniqueSorted(
    programs.flatMap((program) => PROGRAM_SOURCE_REQUIREMENTS[program] ?? []),
  );
}

function normalizeAuthorization(value) {
  if (!value || value.authorized !== true) {
    throw new Error("The authenticated server did not authorize state-pack maintenance");
  }
  const required = ["user_id", "role", "authorized_at"];
  for (const field of required) {
    if (value[field] == null || value[field] === "") {
      throw new Error(`Authorized scope is missing ${field}`);
    }
  }
  if (!validIdentifier(value.user_id)) {
    throw new Error("Authorized maintainer identifier is invalid");
  }
  const allowedStates = uniqueSorted(
    (value.allowed_states ?? []).map((state) => String(state).toUpperCase()),
  );
  if (!allowedStates.length || allowedStates.some((state) => !STATE_PATTERN.test(state))) {
    throw new Error("Authorized state inventory is missing or invalid");
  }
  const programs = uniqueSorted(
    (value.program_codes ?? []).map((program) => String(program).toUpperCase()),
  );
  if (!programs.length || programs.some((program) => !PROGRAM_SOURCE_REQUIREMENTS[program])) {
    throw new Error("Authorized program inventory is missing or unsupported");
  }
  const domains = uniqueSorted((value.official_domains ?? []).map(normalizeHostname));
  if (
    !domains.length ||
    domains.some(
      (domain) =>
        !domain.includes(".") ||
        domain === "localhost" ||
        /[^a-z0-9.-]/.test(domain),
    )
  ) {
    throw new Error("Authorized official-source domain inventory is missing or invalid");
  }
  return Object.freeze({
    user_id: String(value.user_id),
    role: String(value.role),
    authorized_at: parseTimestamp(value.authorized_at, "authorized_at"),
    allowed_states: Object.freeze(allowedStates),
    program_codes: Object.freeze(programs),
    official_domains: Object.freeze(domains),
  });
}

/**
 * Build one trusted state-pack release gateway. Every receipt is bound to this
 * module instance; copied public fields cannot activate a state pack.
 */
export function createStateRulePackReleaseGateway(adapters = {}) {
  for (const name of [
    "authorizeMaintainer",
    "validateSourceContent",
    "validateSourceConflicts",
    "validateRuleFixtures",
    "approveIndependentRelease",
  ]) {
    if (typeof adapters[name] !== "function") {
      throw new Error(`${name} server adapter is required`);
    }
  }

  const sessions = new WeakSet();
  const sessionScopes = new WeakMap();
  const bundles = new WeakSet();
  const bundleRecords = new WeakMap();
  const releases = new WeakSet();
  const releaseRecords = new WeakMap();

  async function beginMaintenanceSession(request = {}) {
    let scope;
    try {
      scope = normalizeAuthorization(await adapters.authorizeMaintainer(request));
    } catch (error) {
      return blocked(
        "STATE_PACK_MAINTAINER_NOT_AUTHORIZED",
        error instanceof Error ? error.message : "State-pack authorization failed.",
        ["authenticated_state_pack_maintainer"],
      );
    }
    const receipt = Object.freeze({
      session_status: "AUTHORIZED",
      user_id: scope.user_id,
      role: scope.role,
      allowed_states: scope.allowed_states,
      program_codes: scope.program_codes,
      authorized_at: scope.authorized_at,
      engine_build: STATE_RULE_PACK_RELEASE_ENGINE_BUILD,
    });
    sessions.add(receipt);
    sessionScopes.set(receipt, scope);
    return receipt;
  }

  async function ingestOfficialSources(input = {}) {
    const session = input.session_receipt;
    if (!session || !sessions.has(session)) {
      return blocked(
        "STATE_PACK_MAINTENANCE_SESSION_REQUIRED",
        "Official sources require a receipt from this authenticated state-pack gateway.",
        ["session_receipt"],
      );
    }
    const scope = sessionScopes.get(session);
    const stateCode = String(input.state_code ?? "").toUpperCase();
    if (!scope.allowed_states.includes(stateCode)) {
      return blocked(
        "STATE_PACK_SCOPE_CONFLICT",
        "The authenticated maintainer is not authorized for the requested state.",
        ["state_code"],
      );
    }
    if (!validIdentifier(input.pack_id) || !validIdentifier(input.pack_version)) {
      return blocked(
        "STATE_PACK_IDENTITY_INVALID",
        "A controlled pack identifier and version are required.",
        ["pack_id", "pack_version"],
      );
    }

    const priorReceipt = input.prior_bundle_receipt ?? null;
    let priorSources = [];
    if (priorReceipt !== null) {
      const prior = bundleRecords.get(priorReceipt);
      if (
        !bundles.has(priorReceipt) ||
        !prior ||
        prior.state_code !== stateCode ||
        prior.pack_id !== String(input.pack_id) ||
        JSON.stringify(prior.programs) !== JSON.stringify(scope.program_codes)
      ) {
        return blocked(
          "PRIOR_STATE_SOURCE_BUNDLE_INVALID",
          "Source updates require a prior bundle issued for the same state pack.",
          ["prior_bundle_receipt"],
        );
      }
      priorSources = prior.sources;
    }

    if (!Array.isArray(input.sources) || !input.sources.length) {
      return blocked(
        "OFFICIAL_STATE_SOURCES_REQUIRED",
        "At least one official state source document is required.",
        ["sources"],
      );
    }

    const existingIds = new Set(priorSources.map((source) => source.source_id));
    const hashes = new Set(priorSources.map((source) => source.source_sha256));
    const latestByLineage = new Map(
      activeSources(priorSources).map((source) => [source.source_lineage_id, source]),
    );
    const accepted = [];

    for (const [index, source] of input.sources.entries()) {
      const prefix = `sources[${index}]`;
      const sourceType = String(source?.source_type ?? "").toUpperCase();
      if (DISALLOWED_SOURCE_TYPES.has(sourceType)) {
        return blocked(
          "ENTERPRISE_DOCUMENT_WRONG_STATE_PACK_BOUNDARY",
          "Completed tenant and property-specific documents cannot enter a shared state pack.",
          [`${prefix}.source_type`],
        );
      }
      if (!SOURCE_TYPES.has(sourceType)) {
        return blocked(
          "STATE_SOURCE_TYPE_NOT_REGISTERED",
          "The official state source type is not registered.",
          [`${prefix}.source_type`],
        );
      }
      const required = [
        "source_id",
        "source_lineage_id",
        "title",
        "publisher",
        "official_url",
        "file_name",
        "mime_type",
        "file_bytes",
        "sha256",
        "version_number",
        "published_date",
        "effective_from",
        "retrieved_at",
      ];
      const missing = required.filter(
        (field) => source?.[field] == null || source[field] === "",
      );
      if (missing.length) {
        return blocked(
          "STATE_SOURCE_METADATA_INCOMPLETE",
          "Official source metadata is incomplete.",
          missing.map((field) => `${prefix}.${field}`),
        );
      }
      if (
        !validIdentifier(source.source_id) ||
        !validIdentifier(source.source_lineage_id) ||
        existingIds.has(String(source.source_id))
      ) {
        return blocked(
          "STATE_SOURCE_ID_CONFLICT",
          "Official source identifiers must be valid, unique, and append-only.",
          [`${prefix}.source_id`],
        );
      }
      const url = officialUrl(source.official_url, scope.official_domains);
      if (!url) {
        return blocked(
          "UNTRUSTED_STATE_SOURCE_URL",
          "Official source URLs must use HTTPS on a server-authorized agency domain.",
          [`${prefix}.official_url`],
        );
      }
      if (!safeFilename(source.file_name) || !ALLOWED_MIME_TYPES.has(String(source.mime_type))) {
        return blocked(
          "STATE_SOURCE_FILE_INVALID",
          "Official source filenames and MIME types must satisfy the controlled allowlist.",
          [`${prefix}.file_name`, `${prefix}.mime_type`],
        );
      }
      const bytes = source.file_bytes instanceof Uint8Array ? source.file_bytes : null;
      if (!bytes || !bytes.byteLength || bytes.byteLength > MAX_SOURCE_BYTES) {
        return blocked(
          "STATE_SOURCE_BYTES_REQUIRED",
          "Actual non-empty official source bytes within the size limit are required.",
          [`${prefix}.file_bytes`],
        );
      }
      const actualHash = createHash("sha256").update(bytes).digest("hex");
      if (
        !HASH_PATTERN.test(String(source.sha256)) ||
        String(source.sha256) !== actualHash ||
        hashes.has(actualHash)
      ) {
        return blocked(
          "STATE_SOURCE_HASH_CONFLICT",
          "Official source bytes must match a unique claimed SHA-256 identity.",
          [`${prefix}.sha256`, `${prefix}.file_bytes`],
          { actual_sha256: actualHash },
        );
      }
      const versionNumber = Number(source.version_number);
      const latest = latestByLineage.get(String(source.source_lineage_id));
      if (
        !Number.isInteger(versionNumber) ||
        versionNumber < 1 ||
        (!latest && (versionNumber !== 1 || source.supersedes_source_id != null)) ||
        (latest &&
          (versionNumber !== latest.version_number + 1 ||
            String(source.supersedes_source_id ?? "") !== latest.source_id ||
            sourceType !== latest.source_type))
      ) {
        return blocked(
          "STATE_SOURCE_VERSION_CHAIN_CONFLICT",
          "Official source updates must append the next version in the same typed lineage.",
          [
            `${prefix}.source_lineage_id`,
            `${prefix}.version_number`,
            `${prefix}.supersedes_source_id`,
          ],
        );
      }
      let publishedDate;
      let effectiveFrom;
      let effectiveTo = null;
      let retrievedAt;
      try {
        publishedDate = parseDate(source.published_date, `${prefix}.published_date`);
        effectiveFrom = parseDate(source.effective_from, `${prefix}.effective_from`);
        effectiveTo =
          source.effective_to == null
            ? null
            : parseDate(source.effective_to, `${prefix}.effective_to`);
        retrievedAt = parseTimestamp(source.retrieved_at, `${prefix}.retrieved_at`);
      } catch (error) {
        return blocked("STATE_SOURCE_DATE_INVALID", error.message, [prefix]);
      }
      if (effectiveTo !== null && effectiveTo < effectiveFrom) {
        return blocked(
          "STATE_SOURCE_EFFECTIVE_PERIOD_INVALID",
          "Official source effective_to cannot precede effective_from.",
          [`${prefix}.effective_to`],
        );
      }

      let validation;
      try {
        validation = await adapters.validateSourceContent({
          state_code: stateCode,
          source_type: sourceType,
          official_url: url,
          mime_type: String(source.mime_type),
          bytes,
          source_sha256: actualHash,
        });
      } catch (error) {
        return blocked(
          "STATE_SOURCE_CONTENT_VALIDATION_FAILED",
          error instanceof Error ? error.message : "Official source validation failed.",
          [`${prefix}.file_bytes`],
        );
      }
      if (
        !validation ||
        validation.validation_status !== "VALIDATED" ||
        validation.state_code !== stateCode ||
        validation.source_type !== sourceType ||
        validation.source_sha256 !== actualHash ||
        !validIdentifier(validation.validator_build)
      ) {
        return blocked(
          "STATE_SOURCE_CONTENT_NOT_VALIDATED",
          "Caller metadata cannot replace byte-derived official-source validation.",
          [`${prefix}.content_validation_receipt`],
        );
      }

      const record = Object.freeze({
        source_id: String(source.source_id),
        source_lineage_id: String(source.source_lineage_id),
        supersedes_source_id:
          source.supersedes_source_id == null
            ? null
            : String(source.supersedes_source_id),
        version_number: versionNumber,
        source_type: sourceType,
        title: String(source.title),
        publisher: String(source.publisher),
        official_url: url,
        file_name: String(source.file_name),
        mime_type: String(source.mime_type),
        byte_length: bytes.byteLength,
        source_sha256: actualHash,
        published_date: publishedDate,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
        retrieved_at: retrievedAt,
        validator_build: String(validation.validator_build),
        extracted_identity_sha256: sha256Value(validation.identity_facts ?? {}),
      });
      accepted.push(record);
      existingIds.add(record.source_id);
      hashes.add(record.source_sha256);
      latestByLineage.set(record.source_lineage_id, record);
    }

    const sources = Object.freeze([...priorSources, ...accepted]);
    const active = Object.freeze(activeSources(sources));
    const receipt = Object.freeze({
      bundle_status: "VALIDATED",
      state_code: stateCode,
      pack_id: String(input.pack_id),
      pack_version: String(input.pack_version),
      program_codes: scope.program_codes,
      source_count: active.length,
      historical_source_count: sources.length,
      source_manifest_sha256: sha256Value(sources),
      engine_build: STATE_RULE_PACK_RELEASE_ENGINE_BUILD,
      agent_approval_required: true,
    });
    bundles.add(receipt);
    bundleRecords.set(receipt, {
      state_code: stateCode,
      pack_id: String(input.pack_id),
      pack_version: String(input.pack_version),
      programs: scope.program_codes,
      sources,
      active_sources: active,
    });
    return receipt;
  }

  async function createValidatedRelease(input = {}) {
    const bundleReceipt = input.bundle_receipt;
    const bundle = bundleRecords.get(bundleReceipt);
    if (!bundleReceipt || !bundles.has(bundleReceipt) || !bundle) {
      return blocked(
        "VALIDATED_STATE_SOURCE_BUNDLE_REQUIRED",
        "A source bundle issued by this gateway is required.",
        ["bundle_receipt"],
      );
    }
    const activeTypes = new Set(bundle.active_sources.map((source) => source.source_type));
    const missingTypes = requiredSourceTypes(bundle.programs).filter(
      (type) => !activeTypes.has(type),
    );
    if (missingTypes.length) {
      return blocked(
        "STATE_PACK_SOURCE_INVENTORY_INCOMPLETE",
        "The state pack is missing required official source categories.",
        missingTypes,
        { source_bundle_status: "VALIDATED" },
      );
    }

    const conflicts = Array.isArray(input.conflicts) ? input.conflicts : [];
    const unresolvedConflicts = conflicts.filter(
      (conflict) =>
        !validIdentifier(conflict?.conflict_id) ||
        conflict.resolution_status !== "RESOLVED" ||
        !conflict.resolution_citation ||
        !conflict.resolved_by ||
        !conflict.resolved_at,
    );
    if (unresolvedConflicts.length) {
      return blocked(
        "STATE_PACK_CONFLICTS_UNRESOLVED",
        "Every currency, supersession, and substantive source conflict requires documented expert resolution.",
        unresolvedConflicts.map(
          (conflict, index) => conflict?.conflict_id ?? `conflicts[${index}]`,
        ),
        { source_bundle_status: "VALIDATED" },
      );
    }
    const conflictSetSha256 = sha256Value(conflicts);
    let conflictValidation;
    try {
      conflictValidation = await adapters.validateSourceConflicts({
        state_code: bundle.state_code,
        pack_id: bundle.pack_id,
        pack_version: bundle.pack_version,
        source_manifest_sha256: bundleReceipt.source_manifest_sha256,
        conflict_set_sha256: conflictSetSha256,
        active_sources: bundle.active_sources,
        conflicts,
      });
    } catch (error) {
      return blocked(
        "STATE_PACK_CONFLICT_VALIDATION_FAILED",
        error instanceof Error ? error.message : "State source-conflict validation failed.",
        ["conflicts"],
      );
    }
    if (
      !conflictValidation ||
      conflictValidation.validation_status !== "VALIDATED" ||
      conflictValidation.source_manifest_sha256 !==
        bundleReceipt.source_manifest_sha256 ||
      conflictValidation.conflict_set_sha256 !== conflictSetSha256 ||
      Number(conflictValidation.unresolved_conflict_count) !== 0
    ) {
      return blocked(
        "STATE_PACK_CONFLICT_INVENTORY_NOT_VALIDATED",
        "A trusted byte-bound conflict inventory must confirm that no known source conflict was omitted or left unresolved.",
        ["source_conflict_validation_receipt"],
        { source_bundle_status: "VALIDATED" },
      );
    }

    const rules = Array.isArray(input.rules) ? input.rules : [];
    const sourceIds = new Set(bundle.active_sources.map((source) => source.source_id));
    const ruleIds = new Set();
    const invalidRules = [];
    for (const [index, rule] of rules.entries()) {
      const ruleId = String(rule?.rule_id ?? "");
      if (
        !validIdentifier(ruleId) ||
        ruleIds.has(ruleId) ||
        !validIdentifier(rule?.version) ||
        !bundle.programs.includes(String(rule?.program_code ?? "").toUpperCase()) ||
        !sourceIds.has(String(rule?.source_id ?? "")) ||
        !Number.isInteger(Number(rule?.source_page)) ||
        Number(rule.source_page) < 1 ||
        !String(rule?.citation ?? "").trim() ||
        !String(rule?.deterministic_operation ?? "").trim()
      ) {
        invalidRules.push(ruleId || `rules[${index}]`);
      }
      ruleIds.add(ruleId);
    }
    if (!rules.length || invalidRules.length) {
      return blocked(
        "STATE_PACK_RULE_INVENTORY_INVALID",
        "Every state rule must be unique, deterministic, program-scoped, and page-cited to an active official source.",
        invalidRules.length ? invalidRules : ["rules"],
        { source_bundle_status: "VALIDATED" },
      );
    }

    const fixtures = Array.isArray(input.fixtures) ? input.fixtures : [];
    const fixtureKinds = new Set(
      fixtures.map((fixture) => String(fixture?.fixture_kind ?? "").toUpperCase()),
    );
    const missingFixtureKinds = REQUIRED_FIXTURE_KINDS.filter(
      (kind) => !fixtureKinds.has(kind),
    );
    const ruleSetSha256 = sha256Value(rules);
    const fixtureSetSha256 = sha256Value(fixtures);
    let fixtureValidation;
    try {
      fixtureValidation = await adapters.validateRuleFixtures({
        state_code: bundle.state_code,
        pack_id: bundle.pack_id,
        pack_version: bundle.pack_version,
        source_manifest_sha256: bundleReceipt.source_manifest_sha256,
        rule_set_sha256: ruleSetSha256,
        fixture_set_sha256: fixtureSetSha256,
        rules,
        fixtures,
      });
    } catch (error) {
      return blocked(
        "STATE_PACK_FIXTURE_VALIDATION_FAILED",
        error instanceof Error ? error.message : "State fixture validation failed.",
        ["fixtures"],
      );
    }
    if (
      missingFixtureKinds.length ||
      !fixtureValidation ||
      fixtureValidation.validation_status !== "VALIDATED" ||
      fixtureValidation.rule_set_sha256 !== ruleSetSha256 ||
      fixtureValidation.fixture_set_sha256 !== fixtureSetSha256 ||
      Number(fixtureValidation.failed_fixture_count) !== 0
    ) {
      return blocked(
        "STATE_PACK_FIXTURES_NOT_VALIDATED",
        "Positive, negative, boundary, layered-program, and supersession fixtures must all pass a trusted validator.",
        missingFixtureKinds.length ? missingFixtureKinds : ["fixture_validation_receipt"],
        { source_bundle_status: "VALIDATED" },
      );
    }

    const effectiveFrom = (() => {
      try {
        return parseDate(input.effective_from, "effective_from");
      } catch {
        return null;
      }
    })();
    if (!effectiveFrom) {
      return blocked(
        "STATE_PACK_EFFECTIVE_DATE_INVALID",
        "A real prospective state-pack effective date is required.",
        ["effective_from"],
      );
    }

    let approval;
    try {
      approval = await adapters.approveIndependentRelease({
        state_code: bundle.state_code,
        pack_id: bundle.pack_id,
        pack_version: bundle.pack_version,
        effective_from: effectiveFrom,
        source_manifest_sha256: bundleReceipt.source_manifest_sha256,
        rule_set_sha256: ruleSetSha256,
        fixture_set_sha256: fixtureSetSha256,
        conflict_set_sha256: conflictSetSha256,
      });
    } catch (error) {
      return blocked(
        "INDEPENDENT_STATE_PACK_APPROVAL_FAILED",
        error instanceof Error ? error.message : "Independent approval failed.",
        ["independent_expert_approval"],
      );
    }
    if (
      !approval ||
      approval.approval_status !== "APPROVED" ||
      approval.independent_reviewer !== true ||
      !validIdentifier(approval.approved_by) ||
      approval.source_manifest_sha256 !== bundleReceipt.source_manifest_sha256 ||
      approval.rule_set_sha256 !== ruleSetSha256 ||
      approval.fixture_set_sha256 !== fixtureSetSha256
    ) {
      return blocked(
        "INDEPENDENT_STATE_PACK_APPROVAL_REQUIRED",
        "Caller approval booleans cannot activate a state pack; an independent receipt bound to the exact release is required.",
        ["independent_expert_approval"],
      );
    }
    let approvedAt;
    try {
      approvedAt = parseTimestamp(approval.approved_at, "approved_at");
    } catch (error) {
      return blocked(
        "INDEPENDENT_STATE_PACK_APPROVAL_REQUIRED",
        error.message,
        ["independent_expert_approval.approved_at"],
      );
    }

    const receipt = Object.freeze({
      validation_status: "VALIDATED",
      status: "validated",
      state_code: bundle.state_code,
      pack_id: bundle.pack_id,
      version: bundle.pack_version,
      effective_from: effectiveFrom,
      approved_at: approvedAt,
      approved_by: String(approval.approved_by),
      validated_rule_count: rules.length,
      source_manifest_sha256: bundleReceipt.source_manifest_sha256,
      rule_set_sha256: ruleSetSha256,
      fixture_set_sha256: fixtureSetSha256,
      limitations: input.limitations == null ? null : String(input.limitations),
      agent_approval_required: true,
      engine_build: STATE_RULE_PACK_RELEASE_ENGINE_BUILD,
    });
    releases.add(receipt);
    releaseRecords.set(receipt, receipt);
    return receipt;
  }

  function validateStatePackRelease(input = {}) {
    const receipt = input.state_pack_receipt;
    const record = releaseRecords.get(receipt);
    const stateCode = String(input.state_code ?? "").toUpperCase();
    if (!receipt || !releases.has(receipt) || !record || record.state_code !== stateCode) {
      return blocked(
        "TRUSTED_STATE_PACK_RELEASE_REQUIRED",
        "A release receipt issued by this gateway for the requested state is required.",
        ["state_pack_receipt"],
      );
    }
    return record;
  }

  return Object.freeze({
    beginMaintenanceSession,
    ingestOfficialSources,
    createValidatedRelease,
    validateStatePackRelease,
  });
}
