# CertivoIQ External Launch Review Packet

Status date: 2026-09-04  
Release decision: **NO-GO for unrestricted paid public launch**  
Safe operating mode: controlled beta with consequential results reviewed by a qualified compliance professional.

This packet is designed to reduce reviewer discovery time. It does not represent legal advice, an independent security assessment, or customer validation.

## Release under review

- Repository: `Watkin5/certifyiq-48308270`
- Candidate source commit: `ce5c5a5ab864c32d2ba4f73e6096ad314d61e10c`
- Candidate Worker version: `7518fe5b-49c1-45c7-b478-6187f28d1c1c`
- Candidate deployment evidence: GitHub Actions run `33846067022`
- Candidate URL: `https://certivoiq-launch-candidate-20260904-v2.rodsheka-watkins.workers.dev`
- Production routing was not changed.

## System boundaries reviewers should assume

- Customer authentication, database access, storage, and row-level authorization use Supabase.
- Public application delivery uses Cloudflare.
- Billing uses Stripe and remains fail-closed pending a controlled live end-to-end verification.
- State and document rule material remains fail-closed until its documented release gates pass.
- Customer files may contain sensitive identity, income, household, and housing-program information.
- No unrestricted automated compliance determination should be treated as professional approval.

## Independent penetration-test scope

Minimum in-scope surfaces:

1. Public and authenticated web routes.
2. Supabase REST, RPC, Auth, Storage, and Realtime surfaces.
3. Cross-tenant identifier substitution using two isolated test tenants.
4. Role escalation, invitation acceptance, founder/staff authorization, and MFA recovery.
5. Upload validation, content-type confusion, malformed documents, oversized input, and stored-file access.
6. Stripe webhook signature validation, replay/idempotency, entitlement changes, and customer portal boundaries.
7. SECURITY DEFINER functions, exposed views, RLS policies, grants, and search paths.
8. Export, audit, deletion, retention, and recovery workflows.
9. Secret exposure in browser assets, logs, error responses, source maps, and repository history.
10. Rate limiting, abuse resistance, session invalidation, and account recovery.

Required report fields:

- Reproduction steps and affected role/tenant
- Severity and business impact
- Evidence without customer data or secrets
- Recommended remediation
- Retest result
- Explicit statement that no critical or high finding remains open

Known item awaiting production remediation: the Supabase advisor reported RLS disabled on `public.state_rule_document_requirements` and a SECURITY DEFINER readiness view. The proposed fix is in PR #366 and must be applied and rechecked before testing is considered final.

## Legal review scope

Qualified counsel should review the implementation and public language together:

- Privacy Notice and Terms
- Data Processing Addendum
- State privacy disclosures
- Subprocessor list, purposes, locations, and change notices
- Data ownership, export, retention, deletion, and backup language
- Security commitments and incident/breach notification
- Warranty, indemnity, limitation of liability, and insurance assumptions
- Trial, annual billing, renewal, cancellation, and refund terms
- Accuracy, methodology, federal/state coverage, and “Unable to determine” claims
- Allocation of responsibility between CertivoIQ and qualified compliance professionals
- Statements about model training and secondary use of customer files

Counsel should return a dated approval or redline with an owner for every unresolved item.

## Controlled customer-pilot protocol

Use written customer permission and historical or synthetic files. Do not use the pilot as an unsupervised production determination.

Minimum sample:

- At least two organizations or explicitly document why a smaller pilot is accepted
- Multiple programs and document-quality levels
- Complete, incomplete, conflicting, obsolete, and unsupported evidence
- At least one upload interruption/retry case
- At least one deletion/export request

For every case record:

- Expected result labeled by a qualified reviewer
- CertivoIQ result and cited evidence
- False Pass, false Fail, correct indeterminate, or correct determination
- Processing and upload timing
- Severity and disposition of discrepancies
- Reviewer name, credentials, and date

Any consequential false Pass affecting eligibility, income, rent, required documentation, or program compliance blocks unrestricted launch until fixed and regression-tested.

## Billing validation still required

The connected Stripe session currently exposes only the live Certivo account. Do not manufacture a successful test-mode result.

Required controlled verification:

1. Confirm Products/Prices and annual license amounts.
2. Confirm promotion behavior, including `FOUNDERS50` if still offered.
3. Confirm webhook endpoint and signing secret.
4. Create the explicitly authorized controlled invoice or Checkout flow.
5. Verify `invoice.paid` creates exactly one entitlement.
6. Replay the event and confirm idempotency.
7. Verify portal access and cancellation/reversal.
8. Confirm failed or reversed payment cannot leave active entitlement.
9. Record Stripe object IDs only; never record keys or webhook secrets.
10. Consider Stripe Tax obligations before enabling tax calculation; enabling automatic tax without an active registration does not establish tax collection.

## Required reviewer outputs

Launch remains blocked until the launch-control manifest contains evidence for:

- Independent penetration test
- Counsel approval
- Controlled customer pilot
- Controlled Stripe billing lifecycle
- Backup/restore drill
- TN/TX independent source validation
- Supabase security remediation and clean follow-up advisor check
- Explicit production cutover authorization
