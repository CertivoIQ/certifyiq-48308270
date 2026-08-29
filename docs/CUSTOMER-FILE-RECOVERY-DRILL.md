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

On 2026-08-29, the rollback-only production UAT passed one-tenant visibility and rejected cross-tenant and unbacked uploads. The synthetic objects were rolled back. A representative customer-object copy remains required to close the launch gate because production storage currently has no suitable customer object.
