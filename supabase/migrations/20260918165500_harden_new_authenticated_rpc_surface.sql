-- Restore the hardened RPC boundary for authenticated customer-facing functions
-- introduced after the 2026-09-04 security-definer cleanup.
-- Public functions remain callable through SECURITY INVOKER wrappers; privileged
-- implementations live in private and retain their existing caller/tenant checks.

create schema if not exists private;

-- The prior private readiness implementation predates founder-only activation policy.
-- It has no dependents in production, so replace it with the current public implementation.
drop function if exists private.state_rule_pack_activation_readiness();

alter function public.auditor_workspace_snapshot(uuid) set schema private;
alter function public.calculate_compliance_impact(uuid,date) set schema private;
alter function public.compare_regulatory_source_versions(uuid,uuid,date) set schema private;
alter function public.compliance_corpus_governance_snapshot(timestamptz) set schema private;
alter function public.create_auditor_access_grant(
  uuid,text,uuid,text,text,text[],text[],date,date,timestamptz,boolean,boolean,boolean,boolean
) set schema private;
alter function public.enterprise_capability_matrix(timestamptz) set schema private;
alter function public.revoke_auditor_access_grant(uuid) set schema private;
alter function public.run_audit_simulation(text,text[],text[],date) set schema private;
alter function public.state_rule_pack_activation_readiness() set schema private;
alter function public.validated_regulatory_source_catalog() set schema private;

alter function private.auditor_workspace_snapshot(uuid) set search_path = '';
alter function private.calculate_compliance_impact(uuid,date) set search_path = '';
alter function private.compare_regulatory_source_versions(uuid,uuid,date) set search_path = '';
alter function private.compliance_corpus_governance_snapshot(timestamptz) set search_path = '';
alter function private.create_auditor_access_grant(
  uuid,text,uuid,text,text,text[],text[],date,date,timestamptz,boolean,boolean,boolean,boolean
) set search_path = '';
alter function private.enterprise_capability_matrix(timestamptz) set search_path = '';
alter function private.revoke_auditor_access_grant(uuid) set search_path = '';
alter function private.run_audit_simulation(text,text[],text[],date) set search_path = '';
alter function private.state_rule_pack_activation_readiness() set search_path = '';
alter function private.validated_regulatory_source_catalog() set search_path = '';

-- Existing private implementations from the earlier hardening pass.
alter function private.approve_certification_final(uuid,text,text,text) set search_path = '';
alter function private.resolve_certification_finding(uuid,text) set search_path = '';

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Private implementations are not Data API schema objects, but the invoker wrappers
-- need explicit execute permission on them.
revoke all on function private.approve_certification_final(uuid,text,text,text) from public,anon;
revoke all on function private.resolve_certification_finding(uuid,text) from public,anon;
revoke all on function private.auditor_workspace_snapshot(uuid) from public,anon;
revoke all on function private.calculate_compliance_impact(uuid,date) from public,anon;
revoke all on function private.compare_regulatory_source_versions(uuid,uuid,date) from public,anon;
revoke all on function private.compliance_corpus_governance_snapshot(timestamptz) from public,anon;
revoke all on function private.create_auditor_access_grant(
  uuid,text,uuid,text,text,text[],text[],date,date,timestamptz,boolean,boolean,boolean,boolean
) from public,anon;
revoke all on function private.enterprise_capability_matrix(timestamptz) from public,anon;
revoke all on function private.revoke_auditor_access_grant(uuid) from public,anon;
revoke all on function private.run_audit_simulation(text,text[],text[],date) from public,anon;
revoke all on function private.state_rule_pack_activation_readiness() from public,anon;
revoke all on function private.validated_regulatory_source_catalog() from public,anon;

grant execute on function private.approve_certification_final(uuid,text,text,text) to authenticated,service_role;
grant execute on function private.resolve_certification_finding(uuid,text) to authenticated,service_role;
grant execute on function private.auditor_workspace_snapshot(uuid) to authenticated,service_role;
grant execute on function private.calculate_compliance_impact(uuid,date) to authenticated,service_role;
grant execute on function private.compare_regulatory_source_versions(uuid,uuid,date) to authenticated,service_role;
grant execute on function private.compliance_corpus_governance_snapshot(timestamptz) to authenticated,service_role;
grant execute on function private.create_auditor_access_grant(
  uuid,text,uuid,text,text,text[],text[],date,date,timestamptz,boolean,boolean,boolean,boolean
) to authenticated,service_role;
grant execute on function private.enterprise_capability_matrix(timestamptz) to authenticated,service_role;
grant execute on function private.revoke_auditor_access_grant(uuid) to authenticated,service_role;
grant execute on function private.run_audit_simulation(text,text[],text[],date) to authenticated,service_role;
grant execute on function private.state_rule_pack_activation_readiness() to authenticated,service_role;
grant execute on function private.validated_regulatory_source_catalog() to authenticated,service_role;

create or replace function public.approve_certification_final(
  _case_id uuid,
  _responsible_party_name text,
  _responsible_party_position text,
  _signature text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.approve_certification_final(
  _case_id,_responsible_party_name,_responsible_party_position,_signature
); $$;

create or replace function public.resolve_certification_finding(
  _finding_id uuid,
  _resolution_notes text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.resolve_certification_finding(_finding_id,_resolution_notes); $$;

create or replace function public.auditor_workspace_snapshot(_grant_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.auditor_workspace_snapshot(_grant_id); $$;

create or replace function public.calculate_compliance_impact(
  _source_node_id uuid,
  _as_of date default current_date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.calculate_compliance_impact(_source_node_id,_as_of); $$;

create or replace function public.compare_regulatory_source_versions(
  _prior_source_node_id uuid,
  _current_source_node_id uuid,
  _as_of date default current_date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.compare_regulatory_source_versions(
  _prior_source_node_id,_current_source_node_id,_as_of
); $$;

create or replace function public.compliance_corpus_governance_snapshot(
  _as_of timestamptz default now()
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.compliance_corpus_governance_snapshot(_as_of); $$;

create or replace function public.create_auditor_access_grant(
  _owner_user_id uuid,
  _organization_id text,
  _auditor_user_id uuid,
  _scope_type text,
  _portfolio_ref text,
  _property_ids text[],
  _program_codes text[],
  _date_from date,
  _date_to date,
  _expires_at timestamptz,
  _include_approved_certifications boolean default true,
  _include_evidence_records boolean default true,
  _include_findings_remediation boolean default true,
  _include_regulatory_citations boolean default true
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.create_auditor_access_grant(
  _owner_user_id,_organization_id,_auditor_user_id,_scope_type,_portfolio_ref,
  _property_ids,_program_codes,_date_from,_date_to,_expires_at,
  _include_approved_certifications,_include_evidence_records,
  _include_findings_remediation,_include_regulatory_citations
); $$;

create or replace function public.enterprise_capability_matrix(
  _as_of timestamptz default now()
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.enterprise_capability_matrix(_as_of); $$;

create or replace function public.revoke_auditor_access_grant(_grant_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.revoke_auditor_access_grant(_grant_id); $$;

create or replace function public.run_audit_simulation(
  _mode text,
  _property_ids text[] default '{}'::text[],
  _program_codes text[] default '{}'::text[],
  _as_of date default current_date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.run_audit_simulation(_mode,_property_ids,_program_codes,_as_of); $$;

create or replace function public.state_rule_pack_activation_readiness()
returns table(
  pack_candidate_id uuid,
  state_code text,
  inventory_generated_at timestamptz,
  pack_status text,
  sources_ready boolean,
  activation_recorded boolean,
  first_reviewer_count integer,
  viewer_is_first_reviewer boolean,
  viewer_can_activate boolean,
  validated_on date,
  activated_on date
)
language sql
security invoker
set search_path = ''
as $$ select * from private.state_rule_pack_activation_readiness(); $$;

create or replace function public.validated_regulatory_source_catalog()
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.validated_regulatory_source_catalog(); $$;

revoke all on function public.approve_certification_final(uuid,text,text,text) from public,anon;
revoke all on function public.resolve_certification_finding(uuid,text) from public,anon;
revoke all on function public.auditor_workspace_snapshot(uuid) from public,anon;
revoke all on function public.calculate_compliance_impact(uuid,date) from public,anon;
revoke all on function public.compare_regulatory_source_versions(uuid,uuid,date) from public,anon;
revoke all on function public.compliance_corpus_governance_snapshot(timestamptz) from public,anon;
revoke all on function public.create_auditor_access_grant(
  uuid,text,uuid,text,text,text[],text[],date,date,timestamptz,boolean,boolean,boolean,boolean
) from public,anon;
revoke all on function public.enterprise_capability_matrix(timestamptz) from public,anon;
revoke all on function public.revoke_auditor_access_grant(uuid) from public,anon;
revoke all on function public.run_audit_simulation(text,text[],text[],date) from public,anon;
revoke all on function public.state_rule_pack_activation_readiness() from public,anon;
revoke all on function public.validated_regulatory_source_catalog() from public,anon;

grant execute on function public.approve_certification_final(uuid,text,text,text) to authenticated,service_role;
grant execute on function public.resolve_certification_finding(uuid,text) to authenticated,service_role;
grant execute on function public.auditor_workspace_snapshot(uuid) to authenticated,service_role;
grant execute on function public.calculate_compliance_impact(uuid,date) to authenticated,service_role;
grant execute on function public.compare_regulatory_source_versions(uuid,uuid,date) to authenticated,service_role;
grant execute on function public.compliance_corpus_governance_snapshot(timestamptz) to authenticated,service_role;
grant execute on function public.create_auditor_access_grant(
  uuid,text,uuid,text,text,text[],text[],date,date,timestamptz,boolean,boolean,boolean,boolean
) to authenticated,service_role;
grant execute on function public.enterprise_capability_matrix(timestamptz) to authenticated,service_role;
grant execute on function public.revoke_auditor_access_grant(uuid) to authenticated,service_role;
grant execute on function public.run_audit_simulation(text,text[],text[],date) to authenticated,service_role;
grant execute on function public.state_rule_pack_activation_readiness() to authenticated,service_role;
grant execute on function public.validated_regulatory_source_catalog() to authenticated,service_role;

comment on function public.auditor_workspace_snapshot(uuid) is
  'Invoker-safe Data API wrapper for scoped read-only auditor access.';
comment on function public.calculate_compliance_impact(uuid,date) is
  'Invoker-safe Data API wrapper for tenant-scoped validated-source impact analysis.';
comment on function public.compare_regulatory_source_versions(uuid,uuid,date) is
  'Invoker-safe Data API wrapper for tenant-scoped regulatory version comparison.';
comment on function public.enterprise_capability_matrix(timestamptz) is
  'Invoker-safe Data API wrapper for enterprise capability resolution.';

do $$
declare
  exposed_authenticated_definers integer;
  hardened_public_wrappers integer;
begin
  select count(*) into exposed_authenticated_definers
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.prosecdef
    and has_function_privilege('authenticated',p.oid,'execute');

  if exposed_authenticated_definers <> 0 then
    raise exception 'Authenticated SECURITY DEFINER functions remain in public: %',
      exposed_authenticated_definers;
  end if;

  select count(*) into hardened_public_wrappers
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname = any(array[
      'approve_certification_final','resolve_certification_finding',
      'auditor_workspace_snapshot','calculate_compliance_impact',
      'compare_regulatory_source_versions','compliance_corpus_governance_snapshot',
      'create_auditor_access_grant','enterprise_capability_matrix',
      'revoke_auditor_access_grant','run_audit_simulation',
      'state_rule_pack_activation_readiness','validated_regulatory_source_catalog'
    ])
    and not p.prosecdef
    and has_function_privilege('authenticated',p.oid,'execute')
    and not has_function_privilege('anon',p.oid,'execute');

  if hardened_public_wrappers <> 12 then
    raise exception 'Expected 12 hardened public wrappers, found %',hardened_public_wrappers;
  end if;
end
$$;

notify pgrst, 'reload schema';
