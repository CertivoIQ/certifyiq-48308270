-- Keep production parity migrations safe under Supabase's exposed public schema.
-- Explicit PUBLIC revokes are required because revoking anon alone does not
-- remove privileges inherited from PostgreSQL's PUBLIC pseudo-role.

alter view public.operations_health set (security_invoker = true);

revoke all on function public.operations_claim_job(text, integer) from public;
revoke all on function public.operations_heartbeat(uuid, text, integer) from public;
revoke all on function public.operations_complete_job(uuid, text, jsonb) from public;
revoke all on function public.operations_fail_job(uuid, text, jsonb) from public;
revoke all on function public.operations_reap_stale_leases() from public;
revoke all on function public.operations_approve(uuid, text) from public;
revoke all on function public.operations_reject(uuid, text) from public;
revoke all on function public.claim_crm_staff_invitation() from public;
revoke all on function public.crm_staff_can_manage(uuid) from public;
revoke all on function public.crm_staff_is_admin(uuid) from public;
revoke all on function public.prevent_operations_audit_mutation() from public;
revoke all on function public.prevent_crm_staff_access_event_mutation() from public;

grant execute on function public.operations_claim_job(text, integer) to service_role;
grant execute on function public.operations_heartbeat(uuid, text, integer) to service_role;
grant execute on function public.operations_complete_job(uuid, text, jsonb) to service_role;
grant execute on function public.operations_fail_job(uuid, text, jsonb) to service_role;
grant execute on function public.operations_reap_stale_leases() to service_role;
grant execute on function public.operations_approve(uuid, text) to authenticated, service_role;
grant execute on function public.operations_reject(uuid, text) to authenticated, service_role;
grant execute on function public.claim_crm_staff_invitation() to authenticated, service_role;
grant execute on function public.crm_staff_can_manage(uuid) to authenticated, service_role;
grant execute on function public.crm_staff_is_admin(uuid) to authenticated, service_role;

-- Webhook idempotency ledger is service-role only and intentionally has no
-- authenticated policy.
revoke all on table public.stripe_processed_events from anon, authenticated;
