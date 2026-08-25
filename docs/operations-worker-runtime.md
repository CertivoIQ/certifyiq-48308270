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
- authenticated internal Edge Function endpoint;
- health-check handler with no customer, billing, communication, or compliance side effect.

## Deployment requirements

- Apply both Batch 1 and Batch 2 migrations in order.
- Configure `OPERATIONS_WORKER_SECRET` as a random server-only production secret.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Invoke `POST /functions/v1/operations-worker` with
  `Authorization: Bearer <OPERATIONS_WORKER_SECRET>`.
- Begin at a conservative schedule only after a non-production smoke test.
- Do not enqueue unsupported job types. Unknown types fail into bounded retry and then
  quarantine rather than executing.

## Still inactive

Federal/state retrieval, parsing, compliance-rule activation, CRM publishing, user
email, billing, customer-access changes, and production deployment handlers remain
inactive. They require later batches and their applicable approval gates.


## Lovable Cloud deployment

The production frontend is static and does not expose TanStack server routes. Deploy
`supabase/functions/operations-worker/index.ts` as the `operations-worker` Edge Function.
The function authenticates with `OPERATIONS_WORKER_SECRET`; platform JWT verification is
disabled because this is a server-to-server endpoint with its own bearer secret.


## GitHub Actions fallback for Lovable Cloud

Lovable Cloud does not deploy backend functions merely because their source was merged
through GitHub. The manual `Operations Worker Dispatch` workflow calls the narrowly
scoped `operations_github_tick` RPC instead. Configure the production GitHub environment
with `CERTIVOIQ_SUPABASE_URL`, `CERTIVOIQ_SUPABASE_PUBLISHABLE_KEY`, and
`OPERATIONS_WORKER_SECRET`. Store only the SHA-256 hash of the worker secret in
`operations_runtime_secrets`. Keep the workflow manual until the production smoke test
passes and later batches activate supported handlers.
