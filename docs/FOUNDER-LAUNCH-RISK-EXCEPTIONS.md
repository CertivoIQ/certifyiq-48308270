# Founder-approved launch risk exceptions

Status date: 2026-09-04  
Approval source: founder confirmation in the CertivoIQ Codex launch-readiness task  
Scope: initial controlled production launch only

## Important classification

These entries are risk-acceptance exceptions. They do **not** state or imply that qualified counsel approved the legal documents, an independent assessor completed a penetration test, or a real customer completed a pilot. Public, contractual, security, and customer-validation claims must preserve that distinction.

The exceptions satisfy the launch-control requirement that a blocking gate be either completed or covered by a formally accepted exception. They do not remove the underlying work from the post-launch register.

## Exception 1: Terms, Privacy Notice, and DPA counsel review

**Gate:** `terms_privacy_counsel_review`  
**Decision:** Founder-approved exception  
**Underlying review:** Not completed

Residual risk accepted:

- enforceability and liability allocation may require revision;
- state or sector privacy disclosures may be incomplete;
- data-processing and subprocessor terms may require jurisdiction-specific changes;
- public compliance or security claims may need legal qualification.

Compensating controls:

- do not describe the documents as counsel-approved;
- do not describe CertivoIQ output as legal advice or professional approval;
- retain fail-closed “Unable to determine” behavior and qualified-human review for consequential compliance results;
- route legal complaints, privacy requests, or regulator contact through the incident process;
- preserve versioned legal documents and acceptance records.

Required follow-up:

- obtain qualified-counsel review after launch;
- complete counsel review before making any claim that the documents are counsel-approved;
- record redlines, approval, jurisdiction, and date in the external-review packet.

## Exception 2: Independent penetration test

**Gate:** `independent_penetration_test`  
**Decision:** Founder-approved exception  
**Underlying test:** Not completed

Residual risk accepted:

- an independent assessor has not tested the production attack surface;
- latent tenant-isolation, authorization, session, upload, webhook, secret-exposure, or configuration vulnerabilities may remain;
- internal automated tests are not a substitute for adversarial independent testing.

Compensating controls:

- retain MFA, row-level security, private-storage controls, hardened privileged functions, signed webhook validation, replay protection, audit logging, monitoring, incident response, and tested recovery;
- keep rollout controlled and monitor authentication, authorization, upload, billing, and error telemetry;
- fail closed on ambiguous authorization, compliance, and billing state;
- treat any credible cross-tenant exposure or privilege escalation as a P0 incident.

Required follow-up:

- complete the independent penetration-test scope in `docs/LAUNCH-EXTERNAL-REVIEW-PACKET.md`;
- remediate all critical and high findings before expanding beyond the controlled rollout;
- attach the report and retest evidence without secrets or customer data.

## Exception 3: Controlled customer pilot

**Gate:** `controlled_customer_pilot`  
**Decision:** Founder-approved exception  
**Underlying pilot:** Not completed

Residual risk accepted:

- workflow fit and real-world document variability have not been validated by an external customer;
- usability, processing-time, and operational-support assumptions may be wrong;
- consequential false Pass, false Fail, or missed-indeterminate behavior may surface with real customer files.

Compensating controls:

- do not claim real-customer validation;
- require qualified human review for consequential compliance results;
- keep unsupported, incomplete, obsolete, or conflicting evidence fail-closed;
- monitor early production cases and preserve source/evidence traceability;
- provide prompt export, deletion, support, and rollback paths.

Required follow-up:

- complete the supervised pilot protocol in `docs/LAUNCH-EXTERNAL-REVIEW-PACKET.md`;
- complete the pilot before claiming customer validation or allowing consequential results to bypass qualified human review;
- record discrepancies, reviewer qualifications, customer permission, and disposition.

## Exception 4: Authorized Stripe live-payment lifecycle

**Gate:** `stripe_controlled_live_e2e`  
**Decision:** Founder-approved exception  
**Underlying live paid lifecycle:** Not completed

Residual risk accepted:

- no successful live payment has verified production `invoice.paid` handling;
- exactly-once entitlement activation, portal behavior, replay handling, and reversal deactivation remain unverified with a real paid transaction;
- simulations and rolled-back database rehearsals cannot prove end-to-end behavior across live Stripe and production systems.

Compensating controls:

- do not claim that the live paid lifecycle passed;
- keep unrestricted paid onboarding disabled;
- retain signed-webhook validation, exact amount and billing-metadata checks, replay/idempotency controls, and fail-closed entitlement behavior;
- manually review any initial paid transaction and immediately disable or reverse an incorrect entitlement;
- retain the existing evidence that the prior zero-dollar event was ignored and invoice `BXFHHQOW-0001` was voided without payment or entitlement.

Required follow-up:

- complete one explicitly authorized live paid lifecycle after launch and before unrestricted paid onboarding;
- verify payment, exactly-one entitlement, event replay, portal access, and cancellation/refund/reversal;
- record only Stripe object IDs and outcomes—never keys or webhook secrets.

## Revocation and review triggers

The founder may revoke any exception at any time. Re-review is required before broadening the controlled rollout, making a claim that an underlying review was completed, materially changing authentication/authorization or compliance logic, or permitting consequential results without qualified human review.
