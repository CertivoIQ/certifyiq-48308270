# CertivoIQ Supervised Autonomous Operations

## Purpose

CertivoIQ may automate observation, preparation, validation, and predefined reversible
operations. It must not allow a language model or unattended worker to become the
compliance authority, approve its own consequential action, or bypass deterministic
tests.

This document covers Batch 1: the control plane. Autonomous workers are not activated
by this batch.

## Risk tiers

| Tier | Meaning | Default execution |
| --- | --- | --- |
| 1 | Observe and report | Automatic |
| 2 | Prepare drafts, comparisons, tests, and pull requests | Automatic |
| 3 | Predefined reversible action | Automatic only when allowlisted |
| 4 | Compliance, customer, money, access, bulk communication, or production impact | Separate human approval |

Tier 4 includes compliance-rule activation, authority changes, property-figure
publication, bulk platform-user email, billing changes, customer-access changes, and
production deployments.

The requester may not approve the same Tier 4 action. Approvals expire and bind to an
immutable action snapshot hash. A changed action requires a new approval.

## Control-plane records

- `operations_jobs`: idempotent jobs, bounded retries, leases, heartbeats, and results.
- `operations_approvals`: separate decision record and immutable action snapshot.
- `operations_audit_events`: append-only evidence and action history.
- `operations_incidents`: quarantines, rollbacks, resolution, and recurring failures.
- `operations_source_versions`: official source identity, hash, dates, and validation state.
- `operations_cost_events` and `operations_budget_limits`: provider spend and hard stops.
- `operations_notification_preferences`: authenticated platform-user preferences.
- `operations_communications`: draft-to-send lifecycle with approval and idempotency.

CRM prospects are not platform-user recipients. Bulk platform email must use the
verified CertivoIQ mail service, honor suppressions and preferences, and remain in
draft until approved.

## Compliance boundary

A compliance rule cannot advance unless:

1. the exact official source URL and SHA-256 are recorded;
2. parsing succeeds;
3. evidence is validated and not conflicting;
4. deterministic tests pass;
5. property and layered-program authority is resolved;
6. required independent and enterprise VP Compliance approvals exist; and
7. the production activation receives a separate Tier 4 approval.

The deterministic engine supplies findings. A language model may explain or prepare
work, but it cannot create or override the compliance determination.

## Failure and rollback

Workers use bounded exponential backoff. Reaching the retry cap quarantines the job
and opens an incident. Tier 3 actions must have a documented reversal. Tier 4 action
snapshots must contain rollback data before approval. Source and rule versions are
immutable; rollback activates a prior approved version rather than overwriting history.

## Cost controls

Every paid provider call records a cost event and correlation ID. Daily and monthly
limits may stop new work. Compliance correctness and audit preservation are never
degraded to save cost; work pauses instead.

## Planned batches

1. **Control plane:** schema, policy gates, audit, approvals, incidents, costs, preferences.
2. **Operations UI and worker runtime:** staff dashboard, queues, leasing, alerts, health.
3. **Federal/state source pipeline:** retrieve, hash, compare, parse, validate, stage.
4. **Communications:** owner alert, CRM news, approved platform-user campaigns.
5. **Customer and revenue operations:** onboarding, support triage, failed-payment workflows.
6. **Reliability:** backups, restore tests, canaries, rollback exercises, budget and security alerts.

No batch may weaken existing compliance tests or activate candidate state packs.
