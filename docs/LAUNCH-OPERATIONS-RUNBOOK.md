# CertivoIQ launch operations runbook

This runbook defines the minimum operating controls for a controlled pilot. It
does not replace customer contracts, legal advice, an incident-response firm,
or independent regulatory review.

## Launch decision

Run:

```sh
node scripts/audit-launch-control-gates.mjs --enforce
```

A public launch is blocked while any blocking gate is not
`technical_complete` or `human_approved`. Engineering may continue
preparation while a human gate is open, but must not relabel it or infer
approval.

## Support and incident intake

All customer reports enter `support_cases`; operational exceptions enter
`operations_incidents`. Never represent an unavailable source as an empty
queue. Preserve the error, affected route/workflow, first observed time,
request/correlation identifier, affected tenant count, and containment action.

| Priority | Example | First response target | Immediate control |
| --- | --- | ---: | --- |
| P0 | suspected cross-tenant access, credential compromise, destructive data event | 15 minutes | contain access, preserve logs, notify founder/security owner |
| P1 | billing entitlement failure, production sign-in outage, source activation defect | 1 hour | stop affected automation, open incident, preserve state |
| P2 | compliance result conflict, missing controlled source, blocked review workflow | 4 business hours | fail closed, route Manual Review, attach evidence |
| P3 | usability issue or non-blocking question | 1 business day | create/triage support case |

The response targets are internal operating goals, not a customer SLA unless a
signed agreement states otherwise.

## Regulatory escalation

- Never activate a state pack from an automated capture alone.
- Preserve exact bytes, SHA-256, retrieval time, final URL, effective date, and
  supersession notes.
- State-pack verification requires an authorized reviewer and an append-only
  verification event.
- NSPIRE activation requires the controlled checksum, 63/407 reconciliation,
  and two distinct staff attestations.
- Conflicting LIHTC, HUD, HOME, RD, or local requirements remain
  `unable_to_determine` until an authorized reviewer resolves applicability.

## Billing escalation

- Reject missing, stale, malformed, or invalid Stripe webhook signatures.
- Treat duplicate event IDs as already processed; treat ledger unavailability
  as an error and request retry.
- Do not manually grant a production entitlement without invoice/payment
  evidence and an audit record.
- Billing refunds, credits, and contract exceptions require authorized human
  approval.

## Evidence preservation

Do not delete or overwrite customer evidence during incident diagnosis. Use
transaction rollback for production UAT. For any repair, record pre-state,
repair command/migration, reviewer, result, and post-state. Customer-file
restores must target a new recovery location until the owner confirms the
result.

## Human-owned launch packet

Before public launch, retain:

1. Counsel-approved Terms, Privacy Notice, DPA, and subprocessor schedule.
2. Founder MFA/recovery confirmation and leaked-password setting evidence.
3. Stripe sandbox checkout/update/cancel/portal evidence.
4. Two NSPIRE attestations and TN/TX independent validation records.
5. Completed non-destructive restore drill with measured recovery time.
6. Named incident commander, security contact, compliance approvers, and
   billing owner with a tested after-hours contact method.
