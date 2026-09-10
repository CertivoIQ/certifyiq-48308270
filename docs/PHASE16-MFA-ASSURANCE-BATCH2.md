# Phase 16 — enrolled MFA assurance, batch 2

Existing enrolled-user routing required MFA, but ordinary server middleware and the REST session hook only checked login lifetime. Storage did not execute that REST hook. This batch enforces the existing opt-in MFA requirement across those paths without making enrollment mandatory for all users.

- `private.mfa_satisfied()` checks only the authenticated user's verified factors and signed AAL claim. It is not anonymously executable, uses an empty search path and does not accept a target user ID.
- `get_session_window` adds `mfa_satisfied` while preserving its existing lifetime fields. The REST pre-request hook rejects enrolled AAL1 access; the session-inspection RPC remains available for recovery.
- A restrictive Storage policy adds lifetime and MFA requirements to existing owner/role policies. It cannot independently grant an object access. Previously issued signed URLs are not revoked by this policy; their TTL still matters.
- Ordinary server middleware requires explicit `valid: true` and `mfa_satisfied: true`. Only recovery-code verification uses the separately exported lifetime-only middleware; recovery still requires the single-use code and cannot generate codes at AAL1.
- Non-enrolled users and abandoned/unverified enrollment remain compatible. Service-role background workers retain their existing path.

Validation: actual middleware/handler tests plus PostgreSQL rehearsal using the previous lifetime migration and the new additive migration. Tests cover AAL1 rejection, AAL2 success, abandoned enrollment, lifetime expiry, narrow recovery inspection, Storage read/write restrictions and retained owner isolation. Production verification must follow deployment; no end-to-end MFA/browser assurance is claimed solely from unit tests.

Rollout: after CI passes, apply the additive database migration FIRST, then merge/deploy application code. Existing clients ignore the additional response field. Deploying the stricter middleware without the database response would fail closed for normal sessions. Record the Supabase connector-generated history version alongside the repository migration version; do not blindly bulk-replay migrations.

Remaining Phase 16 work includes user-triggered privileged Edge Functions that authenticate through service clients (notably CRM staff and support notification tooling), signed URL TTLs, rate limiting, recovery-event logs and all other open areas in the original gap matrix. This batch does not claim Phase 16 complete.
