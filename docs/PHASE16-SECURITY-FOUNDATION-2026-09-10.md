# Phase 16 Security Foundation — batch 1

Status: IN PROGRESS. This is an initial gap matrix, not a completed security audit.
Baseline: `8bfce64961cde771fe60dc7c5ce719adda51a8b3` (Evidence Record PR #451).
Governing specification: the owner's uploaded CertivoIQ roadmap, Security Foundation first, then 1–13, skipping 14–15, enterprise expansion, Compliance Corpus, final hardening and SOC 2 readiness.

## Recovery credential remediation

Inspection confirmed a password-only session could call recovery-code generation without a server AAL2 check. The production `user_recovery_codes` policy also allowed authenticated owners to INSERT/UPDATE/DELETE their own hashes. Recovery removal consumed the code only after factor deletion, allowing concurrent replay.

This batch requires verified AAL2 claims before generating codes, revokes client credential writes while retaining tenant-scoped reads, and conditionally claims an unused code before factor removal. A downstream error leaves the code spent. Existing MFA setup, recovery at AAL1 with a valid code, and scoped unused-code counts are preserved.

Production contained zero recovery rows at inspection. No customer evidence, existing recovery code, or compliance record is deleted by this migration. No rule packs or determinations are changed.

## Initial gap matrix

PASS means only the specific evidence described here passed; it is not assurance over untested paths. PARTIAL includes controls that exist but need deeper or live verification.

| Area | Status | Evidence / remaining work |
|---|---|---|
| Authentication | PARTIAL | Verified-claims middleware and server session-window check exist; complete production auth matrix pending. |
| MFA | PARTIAL | Existing TOTP and enrolled-user UI gate; recovery bypass addressed in this batch. Broader server/API/Storage AAL enforcement review remains. |
| SSO readiness | PARTIAL | Supabase identity foundation exists; inspect enterprise SSO configuration and tenant mapping before implementation. |
| Account recovery | PARTIAL | Hashed recovery codes exist; AAL2 issuance and atomic consumption added; end-to-end deployment verification pending. |
| Invitations | PARTIAL | Confirmed-email, expiry, roles and revocation controls exist; source regressions pass; live journeys pending. |
| Privileged access | PARTIAL | Existing private implementations/public invoker wrappers; complete current catalog and admin endpoint inventory pending. |
| RBAC | PARTIAL | Role and owner/program authorization controls exist; production role matrix still to run. |
| Tenant isolation | PARTIAL | All 161 public tables have RLS; this alone does not prove every policy or server path. |
| Supabase RLS | PARTIAL | Current recovery-code write policy confirmed unsafe; restrictive grants and scoped read replacement in this batch. |
| Storage policies | PARTIAL | All four live buckets private with MIME/size limits; existing recovery tests pass; direct Storage auth/MFA review pending. |
| RPC exposure | PARTIAL | Prior RPC surface regressions pass; complete live grants review pending. |
| SECURITY DEFINER | PARTIAL | Prior 19-function hardening preserved; inspect later additions and all current grants. |
| Secrets handling | PARTIAL | Public publishable key distinguished from server credentials; full source/log scan pending. |
| Environment variables | PARTIAL | Deployment-provided variables and public fallback exist; full configuration inventory pending. |
| Security headers | PARTIAL | Repository headers exist; current production response verification pending. |
| Session invalidation | PARTIAL | Seven-day auth.sessions-based window exists in middleware and REST hook; Storage and recovery invalidation tests pending. |
| Rate limiting | PARTIAL | Extraction budgets exist; inventory and test all sensitive/public endpoints. |
| Upload validation | PARTIAL | Private bucket MIME/size controls and recovery regressions pass; endpoint/magic-byte/archive checks pending. |
| Audit logs | PARTIAL | Existing append-only evidence and workflow histories preserved; completeness review pending. |
| Security logs | PARTIAL | Prior invitation/staff events exist; recovery-event coverage and retention need review. |
| Backups/recovery | EXTERNAL EVIDENCE REQUIRED | Prior synthetic copy/restore receipt documented; verify current backup/PITR configuration and recovery objectives. |
| Data export | PARTIAL | Existing downloadable Evidence Record preserved; complete scoped export review pending. |
| Deletion | PARTIAL | Supervised retention worker exists; full deletion/recovery/session interaction review pending. |
| Retention | PARTIAL | Existing retention purge events and worker; validate schedules, exceptions and current operation. |
| Stripe | PARTIAL | Signature and fail-closed ledger regressions pass; full webhook ordering/idempotency audit pending. |
| CI/CD | PARTIAL | Baseline core CI and release pass; post-release browser acceptance fails on trial-versus-paid fixture mismatch. |
| Branch/change controls | EXTERNAL EVIDENCE REQUIRED | Branch protection API returns 403 to connector; owner/admin configuration evidence required. No bypass authorized. |
| Dependency vulnerabilities | PARTIAL | Frozen Bun install is established CI route; current vulnerability audit pending. npm lock is stale and must not substitute for Bun lock. |
| Source maps/log leakage | PARTIAL | Inspect build artifacts and sanitized error logging. |
| Administrative tooling | PARTIAL | Existing invitation and RPC regressions pass; broader live admin audit pending. |
| Independent penetration testing | EXTERNAL EVIDENCE REQUIRED | External tester and scope required; no completed test claimed. |
| SOC 2 assurance | EXTERNAL EVIDENCE REQUIRED | Readiness artifacts come after roadmap implementation; no SOC 2 report or certification claimed. |

## Live observations

- Supabase project `emnkzxkcpnyvglwxraxm`: ACTIVE_HEALTHY.
- Public tables: 161; tables without RLS: 0.
- Storage: certification-imports, correction-evidence, crm-marketing-documents and merlin-source-snapshots all private.
- Advisor: 21 INFO RLS-without-policy findings and one WARN for pg_net in public. This is not a clean-advisor result. pg_net is non-relocatable and private Merlin dispatch functions depend on its HTTP operations; do not drop/recreate it casually.
- Branch protection read: integration 403; configuration unverified.
- Baseline core CI run 34427352566 and native release run 34427352534 succeeded.
- Browser acceptance run 34427477998 failed: synthetic trial account tried `save_profile`, which requires a platform subscription. Preserve the paid boundary; separately repair the fixture with explicitly controlled test entitlements.

## Validation and release status

42 existing targeted security tests passed before changes. Five new tests execute the actual recovery handlers: ambiguous/AAL1 denial, AAL2 hashed issuance, concurrent single-use claim, claim failure, and downstream failure/replay. Those five plus six existing MFA tests passed locally. Database rehearsal is added to the existing CI PostgreSQL job, using the original schema followed by this migration and rollback-only tests.

Migration: `20260910035616_harden_mfa_recovery_code_writes.sql`, generated by Supabase CLI. Production application, migration, PR, merge, and verification status must be taken from the continuation report; this document does not assert deployment.

Next: finish this batch's CI/release verification, then continue Phase 16 audit and safe remediation. Do not mark Phase 16 complete or start Phase 1 based on this batch alone.
