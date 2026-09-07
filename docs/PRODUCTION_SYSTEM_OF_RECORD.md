# CertivoIQ production system of record

Effective: 2026-09-07

## Canonical production identities

| Component | System of record |
|---|---|
| Source repository | `Watkin5/certifyiq-48308270` |
| Release branch | `main` |
| Supabase project | `emnkzxkcpnyvglwxraxm` (`ca-central-1`) |
| Public zone | `certivoiq.com` |
| Public hosts | `certivoiq.com`, `www.certivoiq.com` |
| Deployment identity | `releaseSha` from `/api/public/health` |

The repositories `Watkin5/CertivoIQ` and `Watkin5/compliance-compass` are not production release sources. A GitHub merge is not evidence of production deployment; production is current only when the live health endpoint reports the approved release SHA and the read-only Cloudflare diagnostic passes.

## Supabase migration baseline

Production and repository migration names diverged before this control was introduced. The captured production history is versioned in `supabase/production-baseline.json`.

- Do not bulk-replay repository-only historical migrations.
- Do not rewrite or mark historical migration records merely to make counts equal.
- All DDL after this baseline must be a reviewed, forward-only migration in this repository.
- Before applying DDL, compare the live migration list to the versioned baseline and investigate any unknown production entry.
- Update the baseline only after the migration is applied successfully and its repository file is merged.
- Treat removal, rename, destructive DDL, RLS changes, grants, auth changes, and compliance-rule activation as administrator approval points.

## Edge Function release rule

The repository source and `supabase/config.toml` are authoritative. Deployment parity means the active Supabase function source and `verify_jwt` setting match the reviewed repository version. Functions using `verify_jwt = false` must implement and retain explicit application-level authentication.

## Cloudflare release proof

The read-only diagnostic must establish all of the following:

1. Apex and `www` resolve and serve HTTPS.
2. Both custom domains map to the same non-empty Worker service.
3. The zone is active and TLS settings meet the workflow policy.
4. The live health endpoint reports the approved 40-character Git commit SHA.
5. No deployment mutation is performed by the diagnostic.

A failed or inconclusive diagnostic blocks release sign-off; it does not authorize an automated cutover.
