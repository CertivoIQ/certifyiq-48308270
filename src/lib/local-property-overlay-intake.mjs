import { createHash } from "node:crypto";

export const LOCAL_PROPERTY_OVERLAY_INTAKE_BUILD =
  "local-property-overlay-intake-2026.08.25.1";

export const DIRECTORY_SOURCE_ROLE = "JURISDICTION_DISCOVERY_ONLY";
export const PROPERTY_SOURCE_ROLE = "PROPERTY_SPECIFIC_AUTHORITY";

const SHA256 = /^[a-f0-9]{64}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const STATE = /^[A-Z]{2}$/;

const DIRECTORY_TYPES = new Set([
  "PHA_DIRECTORY",
  "LOCAL_AGENCY_DIRECTORY",
  "PROGRAM_DIRECTORY",
]);

const OVERLAY_TYPES = new Set([
  "PHA_ADMIN_PLAN",
  "PHA_ACOP",
  "LOCAL_PROGRAM_RULE",
  "LOCAL_NOTICE",
  "UTILITY_ALLOWANCE_SCHEDULE",
  "RENT_SCHEDULE",
]);

const PROPERTY_TYPES = new Set([
  "LURA",
  "REGULATORY_AGREEMENT",
  "HAP_CONTRACT",
  "FORM_8609",
  "BOND_REGULATORY_AGREEMENT",
  "PROJECT_ELECTION",
  "PROPERTY_RENT_SCHEDULE",
  "PROPERTY_UTILITY_ALLOWANCE",
]);

function unique(values = []) {
  return [...new Set(values.map(String))].sort();
}

function officialHttpsUrl(value, allowedDomains = []) {
  try {
    const url = new URL(String(value ?? ""));
    const host = url.hostname.toLowerCase();
    const allowed = allowedDomains.map((domain) => String(domain).toLowerCase());
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    if (!allowed.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function validDate(value) {
  const text = String(value ?? "");
  if (!DATE.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === text;
}

function sourceIdentity(input, allowedDomains) {
  const errors = [];
  if (!ID.test(String(input.source_id ?? ""))) errors.push("source_id");
  if (!STATE.test(String(input.state_code ?? "").toUpperCase())) errors.push("state_code");
  if (!officialHttpsUrl(input.official_url, allowedDomains)) errors.push("official_url");
  if (!validDate(input.effective_from)) errors.push("effective_from");
  if (input.effective_to != null && !validDate(input.effective_to)) errors.push("effective_to");
  if (!(input.file_bytes instanceof Uint8Array) || input.file_bytes.byteLength === 0) errors.push("file_bytes");

  let actualHash = null;
  if (input.file_bytes instanceof Uint8Array && input.file_bytes.byteLength > 0) {
    actualHash = createHash("sha256").update(input.file_bytes).digest("hex");
    if (!SHA256.test(String(input.sha256 ?? "")) || input.sha256 !== actualHash) errors.push("sha256");
  }
  return { errors: unique(errors), actualHash };
}

function approvalsSatisfied(approvals = []) {
  const valid = approvals.filter(
    (approval) =>
      approval &&
      ID.test(String(approval.approved_by ?? "")) &&
      !Number.isNaN(Date.parse(String(approval.approved_at ?? ""))),
  );
  const identities = unique(valid.map((approval) => approval.approved_by.toLowerCase()));
  return { identities, satisfied: identities.length >= 2 };
}

export function ingestJurisdictionDirectorySource(input = {}) {
  const type = String(input.source_type ?? "").toUpperCase();
  if (!DIRECTORY_TYPES.has(type)) {
    return Object.freeze({ status: "BLOCKED", reason: "DIRECTORY_SOURCE_TYPE_REQUIRED" });
  }
  const identity = sourceIdentity(input, input.allowed_domains ?? []);
  if (identity.errors.length) {
    return Object.freeze({ status: "BLOCKED", reason: "DIRECTORY_SOURCE_IDENTITY_INVALID", missing: identity.errors });
  }
  return Object.freeze({
    status: "STAGED",
    role: DIRECTORY_SOURCE_ROLE,
    complianceRuleAuthority: false,
    source_id: input.source_id,
    source_type: type,
    state_code: String(input.state_code).toUpperCase(),
    official_url: officialHttpsUrl(input.official_url, input.allowed_domains ?? []),
    effective_from: input.effective_from,
    effective_to: input.effective_to ?? null,
    sha256: identity.actualHash,
    humanApprovalRequired: true,
  });
}

export function evaluateLocalOverlayActivation(input = {}) {
  const type = String(input.source_type ?? "").toUpperCase();
  if (!OVERLAY_TYPES.has(type)) {
    return Object.freeze({ status: "BLOCKED", reason: "LOCAL_OVERLAY_SOURCE_TYPE_REQUIRED" });
  }
  const identity = sourceIdentity(input, input.allowed_domains ?? []);
  const approval = approvalsSatisfied(input.approvals);
  const missing = [...identity.errors];
  if (!ID.test(String(input.jurisdiction_id ?? ""))) missing.push("jurisdiction_id");
  if (!Array.isArray(input.programs) || input.programs.length === 0) missing.push("programs");
  if (!approval.satisfied) missing.push("independent_two_person_approval");
  const normalizedMissing = unique(missing);
  return Object.freeze({
    status: normalizedMissing.length ? "BLOCKED" : "ACTIVE",
    role: "LOCAL_PROGRAM_OVERLAY",
    jurisdiction_id: input.jurisdiction_id ?? null,
    state_code: String(input.state_code ?? "").toUpperCase(),
    source_type: type,
    source_sha256: identity.actualHash,
    programs: Object.freeze(unique(input.programs ?? [])),
    approved_by: Object.freeze(approval.identities),
    missing: Object.freeze(normalizedMissing),
    humanApprovalRequired: true,
  });
}

export function evaluatePropertyAuthorityActivation(input = {}) {
  const type = String(input.document_type ?? "").toUpperCase();
  if (!PROPERTY_TYPES.has(type)) {
    return Object.freeze({ status: "BLOCKED", reason: "PROPERTY_AUTHORITY_TYPE_REQUIRED" });
  }
  const identity = sourceIdentity(
    { ...input, source_id: input.document_id, source_type: type },
    input.allowed_domains ?? [],
  );
  const approval = approvalsSatisfied(input.approvals);
  const missing = [...identity.errors];
  if (!ID.test(String(input.property_id ?? ""))) missing.push("property_id");
  if (!Array.isArray(input.programs) || input.programs.length === 0) missing.push("programs");
  if (input.property_verified !== true) missing.push("property_verified");
  if (!approval.satisfied) missing.push("independent_two_person_approval");
  const normalizedMissing = unique(missing);
  return Object.freeze({
    status: normalizedMissing.length ? "BLOCKED" : "ACTIVE",
    role: PROPERTY_SOURCE_ROLE,
    property_id: input.property_id ?? null,
    document_id: input.document_id ?? null,
    document_type: type,
    source_sha256: identity.actualHash,
    programs: Object.freeze(unique(input.programs ?? [])),
    approved_by: Object.freeze(approval.identities),
    missing: Object.freeze(normalizedMissing),
    shareableAsStateOrDirectoryAuthority: false,
    humanApprovalRequired: true,
  });
}

export function resolveOverlayAuthorityHierarchy(input = {}) {
  const layers = [
    ["FEDERAL", input.federal],
    ["STATE", input.state],
    ["LOCAL_PHA", input.local],
    ["PROPERTY", input.property],
  ].map(([level, value]) => ({ level, value })).filter((entry) => entry.value?.status === "ACTIVE");

  return Object.freeze({
    orderedAuthority: Object.freeze(layers.map((entry) => entry.level)),
    effectiveAuthority: layers.length ? layers[layers.length - 1].level : null,
    conflictRequiresHumanReview: input.conflict === true,
    ruleEvaluationAllowed: layers.length > 0 && input.conflict !== true,
  });
}
