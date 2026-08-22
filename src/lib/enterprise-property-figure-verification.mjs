import { createHash } from "node:crypto";

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const blocked = (reason_code, message, missing_inputs = []) => Object.freeze({ status: "BLOCKED", reason_code, message, missing_inputs });

export function createEnterprisePropertyFigureVerificationGateway({ authorizeVpCompliance, validatePropertyAuthority } = {}) {
  if (typeof authorizeVpCompliance !== "function" || typeof validatePropertyAuthority !== "function") {
    throw new TypeError("Trusted VP authorization and property-authority validation adapters are required.");
  }
  const approvals = new WeakSet();
  const records = new WeakMap();

  async function verify(input = {}) {
    const official = input.official_baseline;
    if (!official || official.validation_status !== "VALIDATED" || !official.source_sha256 || !official.effective_from) {
      return blocked("VALIDATED_OFFICIAL_BASELINE_REQUIRED", "An immutable, source-bound official baseline is required.", ["official_baseline"]);
    }
    const auth = await authorizeVpCompliance(input);
    if (!auth?.authorized || auth.role !== "VP_COMPLIANCE" || auth.enterprise_id !== input.enterprise_id) {
      return blocked("ENTERPRISE_VP_COMPLIANCE_APPROVAL_REQUIRED", "The enterprise VP of Compliance must perform property verification.", ["vp_compliance_approval"]);
    }
    if (!input.property_id || auth.allowed_property_ids?.includes(input.property_id) !== true) {
      return blocked("PROPERTY_APPROVAL_SCOPE_CONFLICT", "The reviewer is not authorized for this property.", ["property_id"]);
    }

    const observed = input.observed_figures ?? {};
    const baseline = official.figures ?? {};
    const mismatches = Object.keys(baseline).filter((key) => Number(observed[key]) !== Number(baseline[key]));
    const overlays = Array.isArray(input.property_overlays) ? input.property_overlays : [];
    const validated = [];
    for (const overlay of overlays) {
      const authority = await validatePropertyAuthority({ ...overlay, enterprise_id: input.enterprise_id, property_id: input.property_id });
      if (authority?.validation_status !== "VALIDATED" || authority.property_id !== input.property_id || authority.source_sha256 !== overlay.source_sha256) {
        return blocked("PROPERTY_OVERLAY_AUTHORITY_NOT_VALIDATED", "Property-specific figures require exact supporting authority.", [overlay.figure_code]);
      }
      const officialValue = Number(baseline[overlay.figure_code]);
      const overlayValue = Number(overlay.value);
      if (!Number.isFinite(officialValue) || !Number.isFinite(overlayValue) || overlayValue > officialValue) {
        return blocked("PROPERTY_OVERLAY_NOT_MORE_RESTRICTIVE", "A property overlay may only impose a more restrictive comparable limit.", [overlay.figure_code]);
      }
      validated.push({ ...overlay, authority_type: authority.authority_type });
    }

    const unresolved = mismatches.filter((key) => !validated.some((o) => o.figure_code === key && Number(o.value) === Number(observed[key])));
    if (unresolved.length) {
      return blocked("PROPERTY_FIGURE_MISMATCH_UNRESOLVED", "Every difference from CertivoIQ's official figures must be supported and resolved.", unresolved);
    }
    if (input.approval_decision !== "APPROVE") {
      return blocked("PROPERTY_FIGURES_NOT_APPROVED", "Explicit VP of Compliance approval is required.", ["approval_decision"]);
    }

    const effective = { ...baseline };
    for (const overlay of validated) effective[overlay.figure_code] = Number(overlay.value);
    const receipt = Object.freeze({
      status: "APPROVED",
      enterprise_id: input.enterprise_id,
      property_id: input.property_id,
      approved_by: auth.user_id,
      approved_at: auth.approved_at,
      official_source_sha256: official.source_sha256,
      observed_figures_sha256: hash(observed),
      overlay_set_sha256: hash(validated),
      effective_figures: Object.freeze(effective),
      reapproval_required_on_source_change: true,
      agent_approval_required: true,
    });
    approvals.add(receipt);
    records.set(receipt, receipt);
    return receipt;
  }

  function validate({ receipt, official_source_sha256, enterprise_id, property_id } = {}) {
    const record = records.get(receipt);
    if (!record || !approvals.has(receipt) || record.official_source_sha256 !== official_source_sha256 || record.enterprise_id !== enterprise_id || record.property_id !== property_id) {
      return blocked("CURRENT_PROPERTY_VERIFICATION_REQUIRED", "A current property-bound approval receipt is required.", ["property_verification_receipt"]);
    }
    return record;
  }

  return Object.freeze({ verify, validate });
}
