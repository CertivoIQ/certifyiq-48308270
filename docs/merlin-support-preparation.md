# CertivoIQ Merlin and support automation — September 8, 2026

## Live operation
- Merlin source capture and Groq draft extraction: hourly at minute 7, under certivoiq-merlin-preparation.
- Support preparation: every five minutes.
- Absence watchdog: every fifteen minutes.
- The previous separate source-only schedule was replaced, preventing duplicate scheduling.

Merlin runs in Supabase without this chat or the founder's computer remaining open. It processes one document section per invocation, with one active native worker and at most 24 native attempts per rolling 24 hours. Provider quotas may reduce throughput further. At the final check, pilot/source testing had used 20 native attempts in the last 24 hours; the worker will wait automatically when that cap is reached.

## Verified live results
The Groq key passed real inference. A complete one-section Idaho sample notice produced three cited draft procedures. All three were verified in the database as pending_independent_validation and unusable for compliance determinations.
The longer KHC utility policy was split into eight sections. Two sections have been saved, containing five checkpointed draft procedures. A failed citation attempt did not lose section one; the next invocation resumed section two successfully. The document remains queued until all eight sections are processed. Its next eligible time at the final check was September 9, 00:53 UTC; the hourly scheduler can pick it up after that, subject to the shared attempt limit.
The active cron configuration was verified. Its first naturally scheduled AI invocation has not yet been observed; the same dispatch path passed the direct live pilots.

## How extraction works
Pinned unpdf 1.8.1 parses the verified PDF. Text is partitioned into bounded sections while preserving every extracted word and its PDF page. The model selects IDs for actual source spans; Merlin constructs quotations and page citations from those spans. Application and database checks reject missing or invented references.
Groq openai/gpt-oss-120b processes one section per request, with a strict schema, at most three draft procedures and 2,400 completion tokens. Draft fields stay concise. Checkpoints persist in a private RLS-protected table. A successful section releases the lease and schedules continuation one hour later without consuming a failure retry. No partial procedure rows are exposed as a completed document.
Only the final section triggers atomic document/procedure/event/job completion. Duplicate or out-of-order sections, expired leases, or changed source hashes cannot advance progress.

## Boundaries and exceptions
All results remain research drafts. Matching quotations prove the quoted text occurs in the source; they do not prove the model's interpretation or legal completeness. Table layout, images, cross-page context, sample-form applicability, and full procedural coverage still require independent validation. No automated compliance approvals are enabled.
The source cap remains 5 MB. Parser limits are 250 pages, one million extracted characters, 150,000 words, and 100 sections. More than 100 accumulated procedures requires review. Pages with insufficient extractable text are held for OCR; source access denials, missing files, changed hashes, and oversized files are routed to review.
Provider credential/quota failures pause AI work for an hour, preserve document retries and create one operations incident. Successful inference clears the provider incident. There is no paid-provider fallback or automatic credit purchase. Groq account billing settings remain the user's responsibility; worker caps are not a dollar-denominated budget.

## Support and founder absence
Support preparation writes internal suggested replies and investigation checklists from deterministic templates, deduplicated against changed case inputs. It does not send replies, assign or close cases, or make compliance decisions.
The watchdog records operational exceptions. Because no human backup has been appointed, compliance approvals and support exceptions requiring judgment still wait for an authorized person.

## Verification and operations
Ten Node tests passed, covering source boundaries, PDF validation, extraction structure, word/page preservation, source-ID grounding, scanned-page rejection, and empty sections.
Rollback-isolated SQL tests passed for checkpoint recovery, duplicate prevention, invented-quotation rejection, changed-source rejection, atomic finalization, restricted access and non-authoritative results. Live tests verified complete extraction plus saved-progress recovery. Security advisors show expected service-only private-table RLS notices and the existing pg_net placement warning.
Pause Merlin: select cron.unschedule('certivoiq-merlin-preparation');
Pause support: select cron.unschedule('certivoiq-support-preparation');
Inspect private.merlin_segment_progress, operations_jobs, merlin_procedure_documents, merlin_procedures, merlin_procedure_extraction_events, operations_incidents, and staff-only support_case_notes.
Restore schedules using scripts/schedule-merlin-support-preparation.sql.

Implementation and operating scripts: https://github.com/Watkin5/certifyiq-48308270/pull/430 (draft; deployed runtime/database changes are recorded here). No frontend deployment or merge was performed.
