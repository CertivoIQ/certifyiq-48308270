# CertivoIQ founder-dependency audit
Verified September 8, 2026 against production Supabase, current GitHub source, and recent task history.

## What depends on the founder
| Process | Evidence | Absence behavior / next implementation |
|---|---|---|
| Discovering operational exceptions | Existing incident table had no records; 454 held jobs and one unassigned human-required case were present. | Automated now: database watchdog records six classes of exceptions every 15 minutes. |
| Regulatory research backlog | 454 Merlin jobs are queued with scheduled_at=infinity. Four crawl jobs are completed. | Keep held jobs held. Inspect why they were deferred, then add a tested crawler handler and bounded dispatch. The deployed general worker supports only health-check jobs, plus retention processing. |
| Support exceptions | One in-progress, human-required case has no assignee. Founder confirmed no backup exists. | Watchdog records missing ownership. AI may prepare a response; a queue label is not a staffed team. No customer-resolution promise is justified until coverage is assigned. |
| Routine support | Current source includes deterministic triage and nine canned navigation/workflow replies. | Existing code, not a newly deployed AI support service; end-to-end live behavior still needs verification. |
| Support notification transport | Native cron runs each minute; both previously stuck outbox records now say sent. | Existing transport recovered. Watchdog detects any non-sent/non-cancelled records older than 30 minutes. This does not prove inbox receipt. |
| State-pack activation | Live private.activate_state_rule_pack requires an authenticated active CRM administrator and verified source snapshot. | Still administrator-operated. Preparation can be automated; no backup administrator has been designated. |
| Release supervision | Recent tasks repeatedly request checking PRs, CI and deployment. | Inferred founder dependency; current runner availability has not been reverified. Add verified canary/release policy after reconciling concurrent Multifamily launch work. |
| Sales, contracts, billing decisions | Prior launch audit and founder-led tasks show manual follow-up. | Historical evidence only; current commercial workflows and exception authority need a separate audit before automatic actions. |

## Live implementation
private.certivoiq_absence_watchdog() is a SECURITY INVOKER function restricted to the postgres scheduler.
Native cron job certivoiq-absence-watchdog runs every 15 minutes, independent of GitHub runners and this computer.
It records aggregate exceptions in the existing staff operations_incidents table:
- Due queued/retry work older than two hours.
- Running leases expired for more than five minutes.
- Explicitly held queued/retry work older than one day.
- Unsent support notifications older than 30 minutes.
- Human-required support without an assignee for more than one hour.
- Failed or quarantined jobs.

It uses a transaction advisory lock, updates existing open/acknowledged incidents, and automatically resolves only its own incidents once the observed condition disappears. It stores counts and timestamps, not resident documents or message bodies. Queue labels are descriptive metadata; they do not assign a person.

First production invocation detected held_backlog=454 and unassigned_support=1. No overdue-job alert was raised for the held jobs.

## Validation and limits
Rollback-isolated SQL checks passed: repeat-run deduplication, infinity versus overdue classification, automatic recovery resolution, and denial of execution privileges to anon/authenticated/service_role. Temporary fixture changes were rolled back.
The function ran successfully in production and the schedule is active. A naturally scheduled invocation still requires observation.
No jobs were executed, holds lifted, customer messages sent, approvals changed, or cases closed by this implementation.
This is exception detection, not autonomous resolution or a full absence operating system. It does not yet monitor GitHub, external uptime, backups, regulatory source freshness, or watchdog downtime from outside Supabase.
Existing security advisor warning: pg_net remains in public; unrelated to this function. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public

## Priority order
1. Give every human-required workflow a real coverage decision: authorized backup or explicitly deferred service.
2. Audit held Merlin payloads and crawler history, then implement bounded source retrieval and draft impact assessments.
3. Verify routine support live, expand grounded help coverage, and prepare exception response drafts without pretending they are resolved.
4. Add onboarding acceptance and release canaries, recovery runbooks, and an independent outage monitor.
5. Run a 72-hour absence exercise measuring completed routine work, unresolved exceptions, costs and founder intervention.

## Operating and rollback
Staff incident location in source: /crm/operations, Incidents and quarantine.
Inspect schedule and cron.job_run_details to confirm repeated successful runs.
Pause: select cron.unschedule('certivoiq-absence-watchdog');
Preserve existing incidents for audit. Restart using the scheduling SQL in the companion file.
Supabase native scheduling documentation: https://supabase.com/docs/guides/cron
