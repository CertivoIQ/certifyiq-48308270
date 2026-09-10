# CertivoIQ Final Hardening Report — 2026-09-10

Status: CODE HARDENING IN REVIEW; PRODUCTION DDL HELD FOR OWNER APPROVAL.

Scope: full regression suite, Supabase posture and tenant isolation, production authentication evidence, role escalation, uploads, deletion/export, Stripe boundaries, audit history, secrets/logging, Cloudflare release boundary, and CI/CD.

## Verified controls

- **Database/RLS:** production has 170 public tables and zero public tables without RLS.
- **Tenant and role boundaries:** `user_roles` has no client write policy; recovery codes have no client write policy or write grants; no client role memberships or schema-create privileges exist.
- **Privileged functions:** no public SECURITY DEFINER function is executable by `anon`; no SECURITY DEFINER function is missing a fixed `search_path`. Six authenticated functions remain deliberately exposed and are covered by caller/scope rehearsals.
- **Storage:** all four production buckets are private. Session/MFA assurance is a RESTRICTIVE policy, so it composes with owner/bucket rules. Bucket size and MIME allowlists are present.
- **Stripe:** the processed-event ledger has no client grants. Signature verification, idempotency, environment separation, paid-license integrity, and fail-closed behavior remain in the full CI suite.
- **Audit/deletion:** Audit Replay has an immutable BEFORE trigger. Retention purge receipts are service-only; the supervised worker inventories tenant-owned import/evidence paths, removes them in bounded batches, and records completion/failure.
- **Export:** Evidence Record and audit-package exports use the existing tenant-scoped records and preserve final-review labeling.
- **Cloudflare:** both `certivoiq.com` and `www.certivoiq.com` are enabled on the production Worker. The deployment uses secret bindings, private runtime credentials are not returned, HTML is non-cacheable, and the live response passed HSTS, CSP frame isolation, MIME sniffing, referrer, and clickjacking controls.
- **Production authentication evidence:** release acceptance verified deployment identity, anonymous calculator rejection, real browser sign-in, onboarding state enforcement, profile save/reload, and tenant-scoped CSV onboarding. The final calculator persistence step correctly rejected the unlicensed fixture.
- **CI/CD:** key workflows use read-only `contents` permission; repository-wide regression rejects `pull_request_target`; the release suite uses frozen dependencies and now fails on high/critical production dependency advisories.
- **Internal tracker:** repository issue search found no open issue containing “critical” or “vulnerability.” Issue #277 is an external owner work order, described below.

## Remediation in PR #469

Migration `20260910200500_revoke_client_structural_privileges.sql` removes `TRUNCATE`, `REFERENCES`, and `TRIGGER` from `anon` and `authenticated` on all current public and Storage tables. `TRUNCATE` is outside RLS, and none of these structural privileges belong in the API data plane. Existing SELECT/INSERT/UPDATE/DELETE grants and RLS behavior are preserved. Default privileges prevent recurrence on future public tables.

The PR also adds:

- a rollback-only PostgreSQL rehearsal for existing and future tables;
- a repository security assertion suite;
- a high/critical dependency advisory gate;
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=()` in static, SSR, redirect, asset, and error responses;
- live Cloudflare verification of the new header.

## Residual owner/external actions

These are not safe to claim as code-complete:

1. **Branch protection:** GitHub currently reports `main` as unprotected. A repository administrator must require the established CI checks and restrict direct pushes.
2. **Leaked-password protection:** Supabase issue #277 records that this requires an owner-approved plan capability/change. No purchase or plan mutation was authorized.
3. **Security-alert inventory:** GitHub Dependabot, code-scanning, and secret-scanning alert APIs are unavailable through the current connector. The new CI dependency and plaintext-secret gates reduce this gap but do not substitute for enabling/reviewing GitHub Advanced Security.
4. **Backups and independent testing:** PITR/RPO/RTO evidence and an independent penetration test require provider/admin or third-party evidence.
5. **Upload content inspection:** private buckets enforce size and declared MIME controls. Certification imports intentionally allow ZIP/octet-stream for bulk intake; server-side magic-byte/archive inspection remains a defense-in-depth improvement and should be prioritized before accepting untrusted bulk archives at larger scale.
6. **Browser acceptance fixture:** the production browser run ends non-green because its test account lacks the paid entitlement needed for calculator persistence. The paid boundary is working; the fixture must be given explicitly controlled test entitlement rather than weakening billing enforcement.

## Production migration hold

The following reviewed migrations are not applied:

1. `20260910193000_enterprise_capability_architecture.sql`
2. `20260910194500_compliance_corpus_architecture.sql`
3. `20260910200500_revoke_client_structural_privileges.sql`

Apply them only after explicit owner approval, in that order, then rerun database rehearsals, privilege queries, advisors, deployment verification, and live headers.
