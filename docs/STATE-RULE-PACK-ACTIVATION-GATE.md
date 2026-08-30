# CertivoIQ State Rule Pack Activation Gate

## Purpose

State and federal source validation is not the same thing as activation of executable compliance rules. CertivoIQ keeps these controls separate and fail-closed.

Certification Final Review Confirmation is a different workflow. It applies only to certifications after findings have been resolved and is not part of state-rule source validation or rule-pack activation.

## State rule-pack lifecycle

1. `queued_for_agent_verification`
   - Required state and shared federal source records are queued.
   - Compliance activation is blocked.

2. `agent_verification_in_progress`
   - Exact official bytes, SHA-256 identity, retrieval metadata, currency, and supersession evidence are being validated.
   - Compliance activation is blocked.

3. `awaiting_second_verification`
   - Every required source is verified.
   - A different Administrator must complete the independent source-validation approval.
   - Compliance activation is blocked.

4. `verified`
   - The exact source snapshot has completed dual-control source validation.
   - This status does **not** mean executable state rules are active.
   - Deterministic rules, page-level citations, conflict resolution, fixtures, and independent release approval still must pass.

5. `active`
   - The current exact source snapshot has a matching validated deterministic release.
   - The release is bound to the source snapshot, source manifest, rule set, fixture set, and conflict set by SHA-256 identities.
   - At least one deterministic rule is validated.
   - All required fixture categories are represented and zero fixtures failed.
   - Zero source conflicts remain unresolved.
   - Independent release approval is recorded.
   - The release effective date has arrived.
   - Only at this point is `compliance_activation_allowed = true`.

## Test #63 release contract

The deterministic release engine already requires:

- complete official source inventory for the program;
- exact-byte source identity;
- page-level citations to active official sources;
- deterministic rule operations;
- trusted conflict validation with zero unresolved conflicts;
- positive, negative, boundary, layered-program, and supersession fixtures;
- trusted fixture validation with zero failures; and
- independent release approval bound to the exact release hashes.

A trusted server process records a validated release through `record_validated_state_rule_pack_release(...)`. Browser clients cannot write validated releases directly.

## Database binding

A validated database release is bound to:

- `pack_candidate_id`;
- the current `source_snapshot_sha256` computed from controlled source-validation records;
- the matching independent source-approval event;
- the Test #63 `source_manifest_sha256`;
- `rule_set_sha256`;
- `fixture_set_sha256`;
- `conflict_set_sha256`;
- validated rule and fixture counts;
- zero failed fixtures;
- zero unresolved conflicts;
- release engine build; and
- independent approver and approval timestamp.

If the source snapshot changes, the prior release no longer matches the current snapshot and the state pack returns to a fail-closed validation state until a new deterministic release is validated.

## Certification Final Review is separate

The certification workflow retains its own `PENDING FINAL REVIEW` control. Final Review Confirmation is required only after certification findings have been resolved and requires the responsible party's signature and position. Nothing in the state-rule validation or activation gate uses that certification confirmation.
