import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAllMfhHotmaOwnerSystemControls,
  classifyMfhHotmaOwnerSystemControl,
} from "../src/lib/mfh-hotma-owner-system-engine.mjs";

const complete = {
  mfh_program_subtype: "SECTION_8_PBRA",
  program_applicability_validated: true,
  certification_effective_date: "2027-01-01",
  property_hotma_implementation_date: "2026-10-01",
  controlled_source_release_approved: true,
  current_rule_version_validated: true,
  source_status_conflict: false,
  owner_adoption_authority_validated: true,
  tsp_policy_sections_validated: true,
  eiv_verification_hierarchy_validated: true,
  notice_delivery_method_validated: true,
  notice_language_accessibility_validated: true,
  hud_lease_applicability_validated: true,
  lease_execution_validated: true,
  software_compatibility_validated: true,
  certification_form_effective_date_validated: true,
  tracs_transmission_validated: true,
  rent_override_authority_validated: true,
  rent_override_calculation_validated: true,
  certification_action_dates_validated: true,
  evidence_manifest_validated: true,
  evidence: {
    tenant_selection_plan_ref: "TSP-2027-01",
    tsp_revision_date: "2026-09-01",
    tsp_effective_date: "2026-10-01",
    tsp_approval_record_ref: "OWNER-BOARD-2026-09",
    eiv_policy_ref: "EIV-2027-01",
    eiv_policy_effective_date: "2026-10-01",
    eiv_approval_record_ref: "OWNER-BOARD-2026-09",
    tenant_notice_template_ref: "NOTICE-HOTMA-2026",
    tenant_notice_version: "2026.1",
    tenant_notice_delivery_record_ref: "DELIVERY-001",
    lease_applicability_record_ref: "LEASE-REVIEW-001",
    executed_lease_or_addendum_ref: "LEASE-ADDENDUM-001",
    lease_or_addendum_version: "2026.1",
    tracs_release: "CONTROLLED-TRACS-RELEASE",
    certification_form_version: "CONTROLLED-CERT-FORM",
    transmission_validation_ref: "TRACS-VALIDATION-001",
    rent_override_condition_ref: "OVERRIDE-CONDITION-001",
    rent_override_reason: "Documented qualifying condition",
    rent_override_approver_ref: "APPROVER-001",
    rent_override_calculation_ref: "CALC-001",
    rent_override_audit_trail_ref: "AUDIT-001",
    property_hotma_implementation_record_ref: "IMPLEMENTATION-001",
    tenant_file_annotation_ref: "ANNOTATION-001",
    certification_action_ref: "CERT-ACTION-001"
  }
};

test("all seven owner and system controls route without manufacturing PASS or FAIL", () => {
  const result = classifyAllMfhHotmaOwnerSystemControls(complete);
  assert.equal(result.module_count, 7);
  assert.ok(result.classifications.every((entry) =>
    entry.finding_classification === "COMPLIANCE_FINDING"));
  assert.ok(result.classifications.every((entry) =>
    !["PASS", "FAIL"].includes(entry.finding)));
  assert.ok(result.classifications.every((entry) =>
    entry.human_approval_required === true));
});

test("missing policy evidence remains unable to determine", () => {
  const result = classifyMfhHotmaOwnerSystemControl({
    ...complete,
    module_id: "MFH-HOTMA-OWNER-TSP-REVISION",
    evidence: { ...complete.evidence, tenant_selection_plan_ref: "" },
  });
  assert.equal(result.finding_classification, "UNABLE_TO_DETERMINE");
  assert.match(result.missing_inputs.join(" "), /tenant_selection_plan_ref/);
});

test("pre-adoption certification is not applicable", () => {
  const result = classifyMfhHotmaOwnerSystemControl({
    ...complete,
    module_id: "MFH-HOTMA-TENANT-NOTICE",
    certification_effective_date: "2026-09-01",
  });
  assert.equal(result.finding_classification, "NOT_APPLICABLE");
});

test("pre-2027 adopted implementation routes as an observation", () => {
  const result = classifyMfhHotmaOwnerSystemControl({
    ...complete,
    module_id: "MFH-HOTMA-TRACS-FORM-VERSION",
    certification_effective_date: "2026-11-01",
  });
  assert.equal(result.finding_classification, "PRE_IMPLEMENTATION_OBSERVATION");
});

test("guidance alone cannot authorize a rent override classification", () => {
  const result = classifyMfhHotmaOwnerSystemControl({
    ...complete,
    module_id: "MFH-HOTMA-RENT-OVERRIDE",
    rent_override_supported_only_by_guidance: true,
  });
  assert.equal(result.finding_classification, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "RENT_OVERRIDE_PROPERTY_AUTHORITY_REQUIRED");
});
