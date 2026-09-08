# Merlin and support preparation — September 8, 2026

## Live now
- Support preparation: every five minutes, at most 100 changed open cases per run.
- Merlin source preparation: hourly at minute 7, one job at a time; 24 total native attempts per rolling 24 hours, three attempts per job.
- Existing absence watchdog remains active; its scheduled runs have succeeded.

Support creates an internal suggested reply and investigation checklist from deterministic templates. It never sends a message, changes assignment, or closes a case. The templates prioritize security, billing, compliance, technical, and general requests; they do not claim that the issue was resolved. Repeated inputs are deduplicated; changes generate a new internal draft.
The existing system-test ticket is explicitly excluded through a protected table. Customer-supplied titles cannot create exclusions.
There are no open real customer cases in the audited population, so production preparation correctly produced zero drafts. Synthetic rollback-isolated tests verified draft generation and change handling.

## Merlin scope
223 queued PDF jobs met initial database eligibility checks. The worker rechecks the candidate and SHA-256 before preparation. It accepts only configured official HTTPS domains, validates every redirect, checks PDF magic, limits each source to 5 MB, and uses a 30-second source-download timeout.
Source-only mode archives matching bytes in a private merlin-source-snapshots bucket and records source_ready_not_extracted. The extraction job stays queued. It does not fabricate a completed extraction or change rule authority.
One live source was archived successfully (92,038 bytes). A second source exceeded 5 MB; the job was quarantined as a permanent source failure. Oversize, invalid, changed, and unsupported sources require a later processing path or review.
HTML discovery pages, invalidated candidates, non-PDF formats and mismatched snapshots stay outside this pilot.

## AI extraction
Gemini adapter deployed, but AI extraction is NOT scheduled and no model extraction has succeeded. The saved Gemini key is detected and can list models. A live gemini-3.1-flash-lite inference probe returns PERMISSION_DENIED: "Your project has been denied access. Please contact support." Google must resolve project access before a live PDF pilot can pass. The earlier OpenAI credential was accepted, but inference returned credit_balance_exhausted. There is no automatic paid-provider fallback.
The new worker uses gemini-3.1-flash-lite for draft extraction, with at most 8,000 output tokens and a 120-second model timeout. It extracts up to 20 explicitly stated procedures; coverage may be partial. Citations, keys, arrays and confidence values are validated. Results stay pending_independent_validation and unusable for compliance determinations.
Document state, procedure rows, extraction event and job completion commit in one database transaction. Changed source authority, lost leases, and duplicate completions cannot commit.
Archived matching bytes can be reused so an original source does not need to be fetched again for extraction.
Usage is recorded with extraction evidence. Attempt/file/token limits constrain usage; they are not a dollar-denominated spending guarantee.

## Connection and recovery
The worker reads GEMINI_API_KEY (or GOOGLE_API_KEY) from Supabase Edge Function Secrets. No re-entry is required: configured=true was verified. The provider's response explicitly directs the project owner to contact Google support. Do not rotate through projects or keys to bypass that denial.
After Google restores access, run preflight, verify inference, run one PDF extraction pilot, then replace the source-only schedule with extraction scheduling. Keep AI scheduling disabled until the full pilot succeeds.
Quota/credential failures defer affected work for an hour without consuming a document retry, and create a deduplicated operations incident. A successful preflight clears that incident. The current project denial is recorded as PERMISSION_DENIED. Google free-tier quotas and project eligibility remain external constraints.
Only the existing verified public regulatory source pipeline is connected to Gemini. Customer/support data is not sent. Google's free-tier data treatment: https://ai.google.dev/gemini-api/docs/pricing
Model secrets are never stored in the repository. Official instructions: https://supabase.com/docs/guides/functions/secrets

## Verification
Passed:
- Six Node tests: allowed-domain boundary, redirect rejection, HTML rejection, valid PDF, advertised/streamed size limits, extraction validation.
- SQL checks: one-time and expired-token rejection, one active worker, Tier 2 scope, lease-bound atomic completion, duplicate completion rejection, authority remains false.
- SQL checks: source-only capture does not complete extraction or create procedures; repeat captures are skipped.
- SQL checks: expired leases quarantine at retry cap; rolling daily attempt cap prevents claims; permanent failures quarantine; provider failures preserve document retries and deduplicate/recover incidents.
- SQL checks: internal drafts, deduplication, revisions, no draft email, closed-case exclusion, security priority, restricted execution, spoofed test-title handling.
- Live worker: Gemini key detection and model listing; inference denial observed. Six source/validation tests rerun after adapter change and passed. Full Gemini PDF extraction remains unverified.
- Live worker: private-bucket preflight, successful source archive, oversize-file rejection, 401 without scheduler credential.
All synthetic database fixtures were rolled back.
Source cron is active; its first naturally scheduled invocation has not yet been observed.
Security advisors show intentional RLS-without-policy notices for private scheduler tables (no customer access) and the pre-existing pg_net-in-public warning. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public

## Pause and operate
Pause source preparation:
select cron.unschedule('certivoiq-merlin-source-preparation');

Pause support preparation:
select cron.unschedule('certivoiq-support-preparation');

Native worker credentials are random, single-use and expire after two minutes. Only the postgres scheduler creates them. The service-role worker consumes them through a restricted function.
Inspect operations_jobs results, merlin_procedure_documents.source_snapshot, merlin_procedure_extraction_events, and staff-only support_case_notes. Cron scheduler success only confirms dispatch; inspect the HTTP response/job result for actual worker success.
Restore normal operation using scripts/schedule-merlin-support-preparation.sql.
No PHA functionality, compliance activation rules, billing, customer communications or frontend deployment was changed.
