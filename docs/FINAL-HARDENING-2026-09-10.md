# CertivoIQ Final Hardening Report — 2026-09-10

Status: COMPLETE FOR AUTHORIZED CODE, DATABASE, AND APPLICATION DEPLOYMENT SCOPE; OWNER/EXTERNAL ITEMS REMAIN BELOW.

Scope: full regression suite, Supabase posture and tenant isolation, production authentication evidence, role escalation, uploads, deletion/export, Stripe boundaries, audit history, secrets/logging, Cloudflare release boundary, and CI/CD.

## Verified controls

- **Database/RLS:** production has 175 public tables and zero public tables without RLS after the approved Phase 17 and Phase 18 migrations.
- **Tenant and role boundaries:** `user_roles` has no client write policy; recovery codes have no client write policy or write grants; no client role memberships or schema-create privileges exist.
- **Privileged functions:** no public SECURITY DEFINER function is executable by `anon`; no SECURITY DEFINER function is missing a fixed `search_path`. Six authenticated functions remain deliberately exposed and are covered by caller/scope rehearsals.
- **Storage:** all four production buckets are private. Session/MFA assurance is a RESTRICTIVE policy, so it composes with owner/bucket rules. Bucket size and MIME allowlists are present.
- **Stripe:** the processed-event ledger has no client grants. Signature verification, idempotency, environment separation, paid-license integrity, and fail-closed behavior remain in the full CI suite.
- **Audit/deletion:** Audit Replay has an immutable BEFORE trigger. Retention purge receipts are service-only; the supervised worker inventories tenant-owned import/evidence paths, removes them in bounded batches, and records completion/failure.
- **Export:** Evidence Record and audit-package exports use the existing tenant-scoped records and preserve final-review labeling.
- **Cloudflare:** both `certivoiq.com` and `www.certivoiq.com` are enabled on the production Worker. The deployment uses secret bindings, private runtime credentials are not returned, HTML is non-cacheable, and the live response passed HSTS, CSP frame isolation, MIME sniffing, referrer, clickjacking, and Permissions-Policy controls.
- **Production authentication evidence:** release acceptance verified deployment identity, anonymous calculator rejection, real browser sign-in, onboarding state enforcement, profile save/reload, and tenant-scoped CSV onboarding. The final calculator persistence step correctly rejected the unlicensed fixture.
- **CI/CD:** key workflows use read-only `contents` permission; repository-wide regression rejects `pull_request_target`; the release suite uses frozen dependencies and fails on high/critical production dependency advisories.
- **Internal tracker:** repository issue search found no open issue containing “critical” or “vulnerability.” Issue #277 is an external owner work order, described below.

## Final hardening deployment

PR #469 merged at `dc16bad526cc4d3fa533ee208d231b64881d0c73`. All five workflows passed, including the complete security suite and final database rehearsal. The production Cloudflare release succeeded as deployment `03110982-c8fe-4fc0-96e2-bd3d1c49edc9`, version `4ce5ae95-88bd-49fb-9892-bd37ad6a9a5e`.

The release also:

- upgraded the vulnerable transitive `nanoid` and `js-yaml` versions;
- added a rollback-only PostgreSQL rehearsal for existing and future tables;
- added a repository security assertion suite;
- added a high/critical dependency advisory gate;
- added `Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=()` across static, SSR, redirect, asset, and error responses;
- added live Cloudflare verification of the new header.

## Production migration receipts

The owner-approved migrations were applied in order and recorded by Supabase:

1. `20260910190845 enterprise_capability_architecture`
2. `20260910190849 compliance_corpus_architecture`
3. `20260910190853 revoke_client_structural_privileges`

Production verification found:

- all six expected enterprise capability keys;
- anonymous callers cannot execute enterprise/corpus functions;
- authenticated functions use SECURITY INVOKER;
- no invalid raw/training corpus rows;
- a minimum anonymized aggregate threshold of five contributing tenants;
- seven corpus immutability triggers;
- no client structural privileges on public tables;
- no anonymous grants on the new Phase 17/18 tables;
- safe disabled/empty results for an authenticated caller without an enterprise subject.

### Managed Storage privilege boundary

Migration `20260910200500_revoke_client_structural_privileges.sql` removes `TRUNCATE`, `REFERENCES`, and `TRIGGER` from `anon` and `authenticated` on current and future public tables while preserving ordinary data-operation grants and RLS.

Production retains 18 structural grants across `storage.buckets`, `storage.buckets_analytics`, and `storage.objects` (three privileges for each of two client roles on each relation). Those relations are owned by the Supabase-managed `supabase_storage_admin` role; the migration executor is not a member of that role, so the attempted Storage-schema revocation cannot alter them. This is a platform-managed ownership boundary, not an unrecorded successful revocation.

The supported Storage object path remains constrained by private buckets, Storage API operations, RLS owner/bucket policies, and the production RESTRICTIVE session/MFA policy. No role escalation into Supabase's internal Storage owner was attempted. Revisit this only through an officially supported Supabase platform change or support guidance.

## Supabase advisor review

The post-migration security advisor reported no new Phase 17/18 warning. Remaining results are known:

- informational RLS-without-policy notices for intentionally service-only relations, including the private corpus aggregate;
- the existing `pg_net` extension in `public`, required by the current Merlin integration and not relocatable in this deployment;
- six intentional authenticated SECURITY DEFINER functions already covered by caller and scope rehearsals.

## Residual owner/external actions

These are not safe to claim as code-complete:

1. **Branch protection:** GitHub currently reports `main` as unprotected. A repository administrator must require the established CI checks and restrict direct pushes.
2. **Leaked-password protection:** Supabase issue #277 records that this requires an owner-approved plan capability/change. No purchase or plan mutation was authorized.
3. **Security-alert inventory:** GitHub Dependabot, code-scanning, and secret-scanning alert APIs are unavailable through the current connector. The CI dependency and plaintext-secret gates reduce this gap but do not substitute for enabling/reviewing GitHub Advanced Security.
4. **Backups and independent testing:** PITR/RPO/RTO evidence and an independent penetration test require provider/admin or third-party evidence.
5. **Upload content inspection:** private buckets enforce size and declared MIME controls. Certification imports intentionally allow ZIP/octet-stream for bulk intake; server-side magic-byte/archive inspection remains a defense-in-depth improvement and should be prioritized before accepting untrusted bulk archives at larger scale.
6. **Browser acceptance fixture:** the production browser run ends non-green because its test account lacks the paid entitlement needed for calculator persistence. The paid boundary is working; the fixture must be given explicitly controlled test entitlement rather than weakening billing enforcement.
