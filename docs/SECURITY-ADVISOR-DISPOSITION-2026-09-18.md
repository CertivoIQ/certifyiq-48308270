# Supabase Security Advisor Disposition — 2026-09-18

## Scope

Production project: `emnkzxkcpnyvglwxraxm`

This record documents the launch-readiness review of the Supabase Security Advisor findings observed on 2026-09-18.

## Authenticated SECURITY DEFINER findings

The advisor identified authenticated-callable `SECURITY DEFINER` functions in the exposed `public` schema that were added after the prior 2026-09-04 hardening pass.

Resolution: migration `20260918165500_harden_new_authenticated_rpc_surface.sql` restores the established CertivoIQ boundary:

- exposed Data API functions are `SECURITY INVOKER`;
- privileged implementations live in the `private` schema;
- private implementations retain their existing authentication, tenant, role, scope, and fail-closed checks;
- anonymous execution remains revoked;
- public wrapper signatures remain stable for the application;
- the migration fails if any authenticated-callable `SECURITY DEFINER` function remains in `public`.

Production sign-off requires a post-migration Security Advisor rerun confirming the authenticated public-definer warning is cleared.

## pg_net extension-in-public warning

Production reports `pg_net` as non-relocatable. Supabase also installs the platform-managed `extensions.grant_pg_net_access()` event trigger, which grants `net` schema usage to Supabase runtime roles. CertivoIQ uses `pg_net` for internal scheduled dispatch, including the support notification and Merlin workers.

The extension therefore will not be moved or rewritten as part of application launch hardening. Doing so would modify a Supabase-managed platform extension and could break database webhooks or scheduled dispatch.

Compensating controls:

- customer application code does not call `net.*` directly;
- CertivoIQ scheduler dispatch functions that use `net.http_post` are private and require the database scheduler/postgres context;
- external worker endpoints enforce their own worker-secret or authenticated staff authorization;
- regulatory source staging cannot activate compliance rules as a side effect;
- the public authenticated RPC surface is independently hardened to invoker-safe wrappers.

Disposition: **platform-managed infrastructure warning — documented, not treated as an application launch blocker**, subject to future Supabase platform guidance/support if relocation becomes supported.

## RLS-without-policy informational findings

The remaining `rls_enabled_no_policy` entries are reviewed as informational where the table is intentionally service-only/private and client table privileges are revoked. They are not evidence that RLS is bypassed; no-policy RLS denies client row access by default when no broader privilege path exists.

Any future client exposure of one of these tables requires an explicit policy and a new access review.
