-- Close a public-API exposure in the state rule document requirement gate.
--
-- This table controls which exact source families must exist before a state
-- rule pack can advance. It is platform-owned configuration, not customer
-- data and not a client-writable resource. Anonymous and authenticated clients
-- must not be able to alter it.
begin;

alter table public.state_rule_document_requirements enable row level security;

revoke all privileges
  on table public.state_rule_document_requirements
  from anon, authenticated;

-- The readiness view was created with owner privileges. Use invoker rights so
-- it cannot bypass base-table RLS, and keep the internal view off PostgREST's
-- anonymous/authenticated surface.
alter view public.state_rule_document_requirement_readiness
  set (security_invoker = true);

revoke all privileges
  on table public.state_rule_document_requirement_readiness
  from anon, authenticated;

-- This is a trigger enforcement function, not a public RPC endpoint.
revoke execute
  on function public.enforce_state_rule_pack_activation_actor()
  from public, anon, authenticated;

do $$
begin
  if not (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'state_rule_document_requirements'
  ) then
    raise exception 'state_rule_document_requirements RLS must remain enabled';
  end if;

  if has_table_privilege('anon', 'public.state_rule_document_requirements', 'select')
     or has_table_privilege('anon', 'public.state_rule_document_requirements', 'insert')
     or has_table_privilege('anon', 'public.state_rule_document_requirements', 'update')
     or has_table_privilege('anon', 'public.state_rule_document_requirements', 'delete')
     or has_table_privilege('authenticated', 'public.state_rule_document_requirements', 'select')
     or has_table_privilege('authenticated', 'public.state_rule_document_requirements', 'insert')
     or has_table_privilege('authenticated', 'public.state_rule_document_requirements', 'update')
     or has_table_privilege('authenticated', 'public.state_rule_document_requirements', 'delete') then
    raise exception 'client roles must not access state_rule_document_requirements';
  end if;

  if has_table_privilege('anon', 'public.state_rule_document_requirement_readiness', 'select')
     or has_table_privilege('authenticated', 'public.state_rule_document_requirement_readiness', 'select') then
    raise exception 'client roles must not access internal document requirement readiness';
  end if;
end;
$$;

comment on table public.state_rule_document_requirements is
  'Service-role-only configuration for fail-closed state-rule document requirements.';

commit;
