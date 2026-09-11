# Certification Storage Privacy Audit — 2026-09-10

Status: ACTION REQUIRED. This is a focused audit of uploaded certification evidence, storage access, signed previews, OCR sidecars, and retention. It is not a SOC 2 report or an independent penetration test.

## Scope

- Supabase Storage bucket `certification-imports`
- `certification_import_jobs` and `certification_import_items`
- certification upload and TIC intake server functions
- OCR sidecar storage
- signed preview URLs
- retention purge worker
- repository/runtime authorization relevant to deletion

## Confirmed controls

### Private bucket

Production bucket `certification-imports` is private (`public=false`) with a 50 MiB object limit. Current allowed MIME types are PDF, PNG, JPEG, WebP, ZIP, and octet-stream.

### Direct storage isolation

The production Storage RLS policy requires authenticated users and restricts paths to a first folder segment equal to `auth.uid()`. Writes additionally require the second folder segment to refer to a certification import job owned by the same user. The corresponding import job/item tables also enforce `user_id = auth.uid()`.

This is a strong per-user boundary for direct browser Storage access. It is not yet a complete enterprise tenant boundary because organization membership is not part of the Storage path/policy.

### Source binding and evidence integrity

Certification paths are formed under `{userId}/{jobId}/...`. Server intake re-checks that path ownership, downloads the source from the private bucket, recomputes SHA-256, verifies byte length/hash, and rejects mismatches. OCR sidecars are source-bound by filename, SHA-256, byte size, and page count.

### Signed previews

Certification source previews use time-limited signed URLs rather than public object URLs. Current TIC preview URLs are valid for 20 minutes.

### Cleanup on cancelled/failed intake

Cancelled and failed certification intakes remove both the original source and its `.certivoiq-ocr.json` sidecar.

### Current production inventory

At audit time the bucket contained 43 objects: 26 non-sidecar objects and 17 OCR sidecars. No orphan OCR sidecars were found. No account was overdue for an already-scheduled file purge.

## Findings

### CRITICAL — retention worker authorization still references the pre-transfer repository owner

The live source repository is now `CertivoIQ/certifyiq-48308270`, but `supabase/functions/operations-worker/index.ts` still validates GitHub OIDC claims against `Watkin5/certifyiq-48308270` and the old workflow reference. GitHub OIDC claims from the organization repository therefore cannot satisfy the worker's authorization predicate after the transfer.

Impact: the hourly retention workflow may reach the Edge Function but be rejected as unauthorized, preventing future scheduled customer-file purges until corrected.

Remediation in this branch: update the OIDC repository/workflow claims to `CertivoIQ/certifyiq-48308270` while retaining the immutable repository ID, `main` ref, approved event types, GitHub-hosted runner requirement, and audience verification.

### HIGH — retention purge omitted OCR sidecars

The retention worker inventories `certification_import_items.storage_path` and removes the original certification object, but OCR sidecars live at `${storage_path}.certivoiq-ocr.json` and are not represented by a separate import-item storage row.

Impact: after a scheduled retention purge, extracted page text could remain in Storage after the source certification was deleted. OCR text can contain the same sensitive household information as the uploaded certification.

Remediation in this branch: for every certification storage path, add the matching OCR sidecar path to the purge set. Supabase Storage remove is safe when a listed path does not exist, so this also covers files without sidecars.

### HIGH — Storage isolation is user-scoped, not organization-scoped

Current Storage RLS isolates by `auth.uid()`. Several certification data records similarly use `user_id`, and some downstream evidence rows construct an `organization_id` from the user ID rather than a durable customer organization identifier.

Impact: direct cross-user leakage is constrained, but the model does not yet prove correct enterprise tenant isolation or controlled document sharing among multiple users in the same customer organization. It also makes organization-level deletion/export semantics harder to guarantee.

Required next architecture step: introduce a canonical organization/tenant ID on certification jobs/items and Storage authorization, derive membership server-side, and add negative tests proving users from Organization A cannot enumerate/read/write Organization B objects while authorized members of the same organization receive only the permissions their role requires. Do not weaken the existing user boundary until those tests exist.

### MEDIUM — broad upload MIME types need content validation

The private bucket allows `application/zip` and `application/octet-stream` in addition to PDF/images. Bucket MIME allowlists rely on declared metadata and are not a substitute for file-signature validation, archive traversal/expansion limits, or malware scanning.

Required next step: determine whether ZIP remains necessary for the supported certification workflow. If it is not required, remove ZIP/octet-stream from this bucket. If ZIP is required for mass intake, unpack only in a server-side quarantined path with magic-byte validation, entry-count and decompressed-size ceilings, path traversal rejection, and malware scanning before any content becomes reviewable evidence.

### MEDIUM — 20-minute certification preview signed URLs

Signed URLs are correctly used instead of public URLs, but 20 minutes is longer than necessary for highly sensitive certification documents in most review screens.

Required next step: reduce source-preview TTL where UX permits (target 5 minutes), regenerate on demand, and never persist signed URLs in logs, analytics, database records, or client storage.

### MEDIUM — service-role pathways require continuing inventory

Server and Edge Function code legitimately uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. The credential is read from server/runtime environment variables rather than embedded as a literal secret in the inspected code. Because service-role access bypasses tenant policies, every such pathway capable of touching certification records or Storage must independently enforce user/organization authorization.

Required next step: maintain a service-role call inventory and regression-test every customer-data pathway for explicit tenant checks.

### EXTERNAL VERIFICATION REQUIRED — backups, PITR, encryption/key governance, deletion from backups

Repository/database inspection cannot prove Supabase project backup/PITR settings, backup retention, encryption key governance, or how customer deletion propagates to backups. These must be verified from the production Supabase project/account controls and reflected accurately in CertivoIQ's retention policy and DPA.

## Current retention state

Production `account_access` currently has 7 rows: 6 with a scheduled `files_purge_at`, 1 without a purge date, and 0 overdue/unpurged at the audit instant. This is only a point-in-time observation. The OIDC defect above must be released before relying on the hourly worker for future deadlines.

## Launch gate recommendation

Do not represent CertivoIQ as having completed enterprise privacy/security assurance yet. For real customer certification PII, the minimum gate should be:

1. merge/deploy the retention-worker OIDC and sidecar-purge correction;
2. run an authorized production operations tick and record a successful retention result;
3. add organization-level tenant-isolation design/tests before multi-user enterprise collaboration is enabled for customer documents;
4. complete upload content-validation decisions for ZIP/octet-stream;
5. verify Supabase backup/PITR/encryption/key and deletion behavior from the production control plane;
6. complete the broader Phase 16 security audit and independent penetration testing before making assurance claims.

No customer files were opened, downloaded, or inspected during this audit. Production queries were limited to configuration, policy definitions, and aggregate counts.