# CertivoIQ Merlin and support preparation — September 8, 2026

## Current state
Groq is connected: the saved GROQ_API_KEY successfully generated a response from openai/gpt-oss-20b (HTTP 200). No OpenAI credit purchase or Google project repair is required for this connection. No paid-provider fallback is configured.

Source preparation runs hourly at minute 7. Support preparation runs every five minutes. The absence watchdog remains active. AI extraction scheduling remains disabled pending a successful full PDF pilot.

## Groq pilot scope
The deployed worker preserves official-domain checks, redirect checks, exact SHA-256 matching, a private PDF snapshot bucket, single-use scheduler credentials, one active native worker, and a 24-attempt rolling daily cap.
PDF text is parsed with pinned unpdf 1.8.1. Single-request extraction accepts up to 25 pages and 12,000 extracted characters; pages with insufficient text require OCR. Longer documents require a segmented processing path and are held for review rather than silently truncated.
Each inference uses at most 3,500 completion tokens, low reasoning effort, a strict JSON schema, and a 120-second timeout. At most five concise procedures are requested. Every citation must contain a 5–20-word excerpt found verbatim in the cited PDF page's normalized text.
Results can only become pending_independent_validation and remain unusable for compliance determinations. Text parsing does not verify table layout or images. Draft coverage is explicitly partial.
Attempt and token caps do not guarantee a dollar spending limit if the Groq account is upgraded later.

## Live findings
- Groq credential and inference preflight passed.
- The archived Delaware income-limit PDF reached inference but produced no acceptable cited procedure extraction. No procedures were saved from those failed attempts.
- Source download timeouts, source HTTP 403, and oversized files were surfaced without bypassing access restrictions.
- The short Idaho sample notice reached extraction, but its citations failed validation; no draft was committed. Full document extraction has not yet passed, so scheduled AI processing is not enabled.
- The KHC utility policy exceeded the text budget and was routed to segmentation review.
- A PDF cleanup compatibility defect was fixed; the attempt consumed by that implementation defect was restored with an audit event.
- Explicitly scheduled jobs now take priority over the held backlog within each retry class.
- Empty procedure results, OCR-required documents, and documents requiring segmentation are routed to review.
- Six Node source/structure tests passed. A rollback-isolated SQL test confirmed segmentation-required failure quarantines the job and rejects duplicate failure updates. An initial test attempt could not claim while a live worker held the concurrency slot; it passed after the worker finished.
- Security advisor findings remain the existing private-table RLS notices and pg_net placement warning.

## Support preparation
Internal suggested replies and investigation checklists use deterministic templates; no model API is needed. They are deduplicated against changed open-case inputs and do not send messages, assign cases, close cases, or make compliance decisions. A protected exclusion table excludes the verified system-test ticket. No real open support cases existed in the audited population.

## Operations
Secrets stay in Supabase; never put their values in source files or chat.
Preflight: select private.dispatch_merlin_preparation(true);
Single AI pilot: select private.dispatch_merlin_preparation(false);
Source-only dispatch: select private.dispatch_merlin_source_preparation();
Pause source schedule: select cron.unschedule('certivoiq-merlin-source-preparation');
Pause support schedule: select cron.unschedule('certivoiq-support-preparation');
Provider quota/credential failures defer work for one hour and preserve document retries. A successful preflight clears the provider incident.
Inspect operations_jobs, merlin_procedure_documents.source_snapshot, merlin_procedure_extraction_events, operations_incidents, and staff-only support_case_notes. Cron dispatch success alone is not proof that a worker completed.

Source and review code is recorded in draft PR https://github.com/Watkin5/certifyiq-48308270/pull/430. No frontend deployment or PR merge was performed.
