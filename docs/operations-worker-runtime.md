# Batch 2 — Operations Worker Runtime

Batch 2 activates the supervised runtime mechanics, not regulatory source ingestion or
customer communications.

## Active capability

- atomic job claim using `FOR UPDATE SKIP LOCKED`;
- exclusive worker lease and heartbeat;
- bounded retry with exponential backoff;
- quarantine and incident creation at the retry cap;
- stale-lease recovery;
- Tier 4 completion blocked without a valid separate approval;
- staff approve/reject actions with a required written reason;
- authenticated internal tick endpoint;
- health-check handler with no customer, billing, communication, or compliance side effect.

## Deployment requirements

- Apply both Batch 1 and Batch 2 migrations in order.
- Configure `OPERATIONS_WORKER_SECRET` as a random server-only production secret.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Invoke `POST /api/internal/operations/tick` with
  `Authorization: Bearer <OPERATIONS_WORKER_SECRET>`.
- Begin at a conservative schedule only after a non-production smoke test.
- Do not enqueue unsupported job types. Unknown types fail into bounded retry and then
  quarantine rather than executing.

## Still inactive

Federal/state retrieval, parsing, compliance-rule activation, CRM publishing, user
email, billing, customer-access changes, and production deployment handlers remain
inactive. They require later batches and their applicable approval gates.
