# Customer-file recovery drill

This procedure restores a customer file without overwriting or deleting the source.

## Preconditions

- Confirm the requestor owns the source object and record the authenticated user ID.
- Record the source bucket, exact object path, byte size, and SHA-256 digest.
- Create a unique recovery request UUID.
- Use only `certification-imports` or `correction-evidence`.

## Copy and verification

1. Generate the target with `buildCustomerFileRecoveryPlan`.
2. Confirm the target does not already exist. Never enable overwrite.
3. Copy the source to the generated owner-prefixed recovery path. Never move it.
4. Re-read the copied object and calculate its SHA-256 digest and byte size.
5. Call `verifyCustomerFileRecoveryCopy`; a mismatch fails closed.
6. Ask the authenticated owner to open the recovered copy and explicitly confirm it.
7. Record owner confirmation with `confirmCustomerFileRecovery`.

The source remains intact throughout the drill. Any collision, tenant mismatch, invalid identity, checksum mismatch, size mismatch, or missing owner confirmation stops recovery.

## Evidence

- Automated control tests: `scripts/test-customer-file-recovery.mjs`
- Rollback-only production isolation UAT: `supabase/tests/customer_file_storage_uat.sql`
- Storage hardening: `supabase/migrations/20260829060000_harden_customer_file_storage.sql`
- Import-job subscription gate: `supabase/migrations/20260829061000_harden_certification_import_jobs.sql`

On 2026-08-29, the rollback-only production UAT passed one-tenant visibility, rejected cross-tenant and unbacked uploads, blocked an unsubscribed multi-file job, and allowed a single-file job. The synthetic records were rolled back. A representative customer-object copy remains required to close the launch gate because production storage currently has no suitable customer object.

## Production synthetic recovery evidence - 2026-09-04

Because the pre-launch production buckets contained zero customer objects, the drill used a generated one-page PDF containing no customer data and an owner-prefixed staff path in the real private `certification-imports` bucket.

- GitHub Actions run: `33902511219`
- Recovery request: `52a480e4-feae-42dc-9a32-906bde65d814`
- Source and recovered size: `1,108 bytes`
- Source and recovered SHA-256: `1782d8eeb3f2cd88cc85e856f4334ca7f443bdb68bb3bf5dc5c2dfd1a707dd42`
- Destination collision before copy: false
- Source remained intact after copy: true
- Production catalog verification: two private PDF objects exist at the unique source and recovery paths
- Artifact: `customer-file-recovery-drill-33902511219` (14-day retention)

The copy, size, checksum, source-preservation, and visual-render checks passed. Founder visual confirmation of the recovered artifact remains required before the launch gate is closed.
