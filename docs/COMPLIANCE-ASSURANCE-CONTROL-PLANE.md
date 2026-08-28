# CertivoIQ Compliance Assurance Control Plane

## Purpose

This control plane extends the existing deterministic layered-program engine with supervised controls for:

- LIHTC, HUD tenant-based and project-based assistance, HOME, USDA Rural Development, state/local funding, and recorded project authority;
- regulatory conflicts and unusual exceptions;
- audit preparation and evidence-bound findings remediation;
- production role security and cross-tenant workflow reliability;
- measured human-escalation accuracy; and
- sustained performance across reviewed production customer files.

It does not make final legal or compliance decisions. The strongest system status is `READY_FOR_HUMAN_DECISION`. A named human reviewer must approve, reject, or return the case for remediation.

## Fail-closed behavior

The control plane preserves the existing safety rule: missing, ambiguous, conflicting, stale, uncited, or unvalidated evidence produces `NOT_DETERMINED`, `PENDING`, `CONFLICTING`, or `BLOCKED`. It never repairs ambiguous OCR, invents a regulatory hierarchy, assumes that a program applies, or uses one program's rent/income concept as a substitute for another.

## Feature gates

| Gate | Required evidence | Blocking conditions |
|---|---|---|
| Layered programs | Exact program inventory and completed layered-engine handoff | Missing program, unresolved layer, mismatched inventory, missing human-review control |
| Regulatory review | Controlled source hash, citation, effective dates, applicability, and independently validated precedence | Equal-precedence contradictory outcomes, stale/missing source, unapproved exception |
| Audit/remediation | Manifest, rule/source versions, calculation trace, review history, and remediation evidence | Open critical finding, incomplete package, same person verifies and closes |
| Role/workflow security | Verified RLS, role matrix, invitation workflow, append-only audit history, and zero unauthorized cross-tenant access | Any failed security probe or missing production verification |
| Escalation accuracy | Human-labeled outcomes | Fewer than 30 reviewed events, recall below 95%, precision below 90%, or any critical false negative |
| Customer-file performance | De-identified, human-reviewed production files | Fewer than 100 files/3 customers/30 days, workflow success below 99%, agreement below 95%, audit loss, cross-tenant failure, unresolved-evidence bypass, or critical incorrect result |

The numeric thresholds are release gates, not marketing claims. Changing them requires documented governance and a new engine build.

## Data minimization and access

Production observations use de-identified customer and file keys. The tables do not store source documents or tenant PII. Authenticated customers can read only cases tied to their own user ID. Active CertivoIQ `admin` and `manager` staff may review cases; employees do not receive reviewer authority. Writes of customer-file observations, escalation outcomes, and immutable assurance events are service-side only.

The reviewer authorization helper is in the non-exposed `private` schema, uses `crm_staff_access`, and does not use user-editable JWT metadata. Every exposed table has RLS enabled.

## Verification

Run:

```bash
node --test scripts/test-compliance-assurance-control-plane.mjs
node --test scripts/test-compliance-assurance-schema.mjs
```

Before production activation, also run Supabase security/performance advisors, cross-role tests for admin/manager/employee/customer identities, invitation workflow UAT, and negative cross-tenant probes.
