# CertivoIQ External Launch Review Packet

Status date: 2026-09-04  
Release decision: **NO-GO for unrestricted paid public launch**  
Safe operating mode: controlled beta with consequential results reviewed by a qualified compliance professional.

This packet is designed to reduce reviewer discovery time. It does not represent legal advice, an independent security assessment, or customer validation.

## Release under review

- Repository: `Watkin5/certifyiq-48308270`
- Current reviewed `main` commit: `6a86b65629661c00aee8fd05ed97ef0ebc4b2958`
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

Production security update: PR #370 is merged and migration `20260904165332_harden_authenticated_security_definer_functions.sql` is applied. Catalog verification found zero authenticated executable SECURITY DEFINER functions in `public`, 19 invoker-safe public wrappers, and 19 private implementations with empty search paths. The advisor now reports no SECURITY DEFINER warning; the remaining warning is leaked-password protection, unavailable while the organization remains on the Free plan.

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
- Backup/restore owner confirmation (technical copy/checksum verification passed in run `33902511219`)
- TN/TX independent source validation
- Supabase security remediation and clean follow-up advisor check
- Explicit production cutover authorization

## Sign-off records to return

Do not mark a gate complete from a verbal statement. Attach the underlying report or review record and complete the applicable block.

### Independent penetration test

- Assessor organization and tester:
- Independence/conflict statement:
- Test dates:
- Candidate URL and commit:
- Report location:
- Critical findings open:
- High findings open:
- Retest date and result:
- Assessor signature/date:

### Counsel review

- Counsel name, firm, and jurisdiction:
- Documents and versions reviewed:
- Approved without changes or redline location:
- Unresolved launch-blocking issues:
- Counsel signature/date:

### TN/TX source validation

- Reviewer name and qualifications:
- Tennessee documents reviewed: 15 of 15
- Texas documents reviewed: 11 of 11
- Effective dates checked:
- Supersession checked:
- Applicability and rule mappings checked:
- Exceptions or corrections:
- Reviewer signature/date:

### Controlled customer pilot

- Customer organizations:
- Written permissions:
- Qualified compliance reviewer:
- Files/cases and programs:
- Consequential false Pass count:
- Other discrepancies and disposition:
- Upload interruption, export, and deletion checks:
- Reviewer/customer approval and date:

### Controlled live Stripe lifecycle

- Written founder authorization:
- Amount/currency:
- Stripe customer/invoice or Checkout IDs:
- Paid event ID and webhook receipt:
- Entitlement ID and replay/idempotency result:
- Portal verification:
- Cancellation/refund/reversal ID:
- Post-reversal entitlement state:
- Founder confirmation/date:
