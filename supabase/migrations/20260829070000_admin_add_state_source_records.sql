-- Allow active CRM administrators to split mutable landing-page candidates into
-- exact-file child records. New records remain fail-closed and require normal
-- independent source review before any rule-pack release.

create table if not exists public.state_rule_source_creation_events (
  id uuid primary key default gen_random_uuid(),
  source_candidate_id uuid not null references public.state_rule_source_candidates(id) on delete restrict,
  creator_id uuid not null references auth.users(id) on delete restrict,
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  source_url text not null,
  source_type text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists state_rule_source_creation_events_candidate_idx
  on public.state_rule_source_creation_events(source_candidate_id, created_at desc);
create index if not exists state_rule_source_creation_events_creator_idx
  on public.state_rule_source_creation_events(creator_id, created_at desc);

alter table public.state_rule_source_creation_events enable row level security;

revoke all on table public.state_rule_source_creation_events from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_source_creation_events from authenticated;
grant select on table public.state_rule_source_creation_events to authenticated;
grant all on table public.state_rule_source_creation_events to service_role;

drop policy if exists "Managers can view state source creation events"
  on public.state_rule_source_creation_events;
create policy "Managers can view state source creation events"
on public.state_rule_source_creation_events for select to authenticated
using (
  exists (
    select 1 from public.crm_staff_access access
    where access.user_id = (select auth.uid())
      and access.status = 'active'
      and access.access_level in ('manager', 'admin')
  )
);

create or replace function public.create_state_rule_source_candidate(
  p_state_code text,
  p_scope text,
  p_authority_name text,
  p_official_domain text,
  p_program text,
  p_source_type text,
  p_source_url text,
  p_candidate_status text default 'PENDING_EXACT_BYTES_AND_HASHES'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_pack public.state_rule_pack_candidates%rowtype;
  v_candidate_id uuid;
  v_state_code text := upper(trim(coalesce(p_state_code, '')));
  v_scope text := upper(trim(coalesce(p_scope, '')));
  v_authority_name text := trim(coalesce(p_authority_name, ''));
  v_official_domain text := lower(trim(coalesce(p_official_domain, '')));
  v_program text := upper(trim(coalesce(p_program, '')));
  v_source_type text := upper(trim(coalesce(p_source_type, '')));
  v_source_url text := trim(coalesce(p_source_url, ''));
  v_candidate_status text := upper(trim(coalesce(p_candidate_status, '')));
  v_source_count integer;
  v_blocked_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.crm_staff_access access
    where access.user_id = v_user_id
      and access.status = 'active'
      and access.access_level = 'admin'
  ) then
    raise exception 'Active Administrator authority required';
  end if;

  if v_state_code !~ '^[A-Z]{2}$' then
    raise exception 'A two-letter state code is required';
  end if;
  if char_length(v_scope) < 2 or char_length(v_scope) > 100 then
    raise exception 'Scope must contain 2 to 100 characters';
  end if;
  if char_length(v_authority_name) < 3 or char_length(v_authority_name) > 250 then
    raise exception 'Authority name must contain 3 to 250 characters';
  end if;
  if v_official_domain !~ '^[a-z0-9.-]+[.][a-z]{2,}$' then
    raise exception 'A valid official domain is required';
  end if;
  if char_length(v_program) < 2 or char_length(v_program) > 100 then
    raise exception 'Program must contain 2 to 100 characters';
  end if;
  if v_source_type !~ '^[A-Z0-9]+(_[A-Z0-9]+)*$' or char_length(v_source_type) > 150 then
    raise exception 'Source type must use uppercase letters, numbers, and underscores';
  end if;
  if v_candidate_status !~ '^[A-Z0-9]+(_[A-Z0-9]+)*$' or char_length(v_candidate_status) > 150 then
    raise exception 'Intake condition must use uppercase letters, numbers, and underscores';
  end if;
  if v_source_url !~ '^https://[^[:space:]]+$' then
    raise exception 'An HTTPS official source URL is required';
  end if;
  if not (
    lower(v_source_url) like 'https://' || v_official_domain || '/%'
    or lower(v_source_url) like 'https://' || v_official_domain || '?%'
    or lower(v_source_url) = 'https://' || v_official_domain
    or lower(v_source_url) like 'https://%.' || v_official_domain || '/%'
    or lower(v_source_url) like 'https://%.' || v_official_domain || '?%'
    or lower(v_source_url) like 'https://%.' || v_official_domain
  ) then
    raise exception 'Official source URL must match the official domain';
  end if;

  select * into v_pack
  from public.state_rule_pack_candidates
  where state_code = v_state_code
  order by inventory_generated_at desc
  limit 1
  for update;

  if not found then
    raise exception 'State rule pack not found';
  end if;

  insert into public.state_rule_source_candidates (
    state_code,
    inventory_generated_at,
    scope,
    authority_name,
    official_domain,
    origin_file,
    program,
    source_type,
    source_url,
    candidate_status,
    agent_verification_status,
    exact_bytes_captured,
    compliance_activation_allowed,
    verification_evidence
  ) values (
    v_state_code,
    v_pack.inventory_generated_at,
    v_scope,
    v_authority_name,
    v_official_domain,
    'admin_state_rule_validation_workspace',
    v_program,
    v_source_type,
    v_source_url,
    v_candidate_status,
    'queued_for_agent_verification',
    false,
    false,
    jsonb_build_object(
      'created_manually', true,
      'created_by', v_user_id,
      'created_at', now(),
      'parent_collection_split', true,
      'independent_validation_complete', false
    )
  )
  returning id into v_candidate_id;

  insert into public.state_rule_source_creation_events (
    source_candidate_id,
    creator_id,
    state_code,
    source_url,
    source_type,
    evidence
  ) values (
    v_candidate_id,
    v_user_id,
    v_state_code,
    v_source_url,
    v_source_type,
    jsonb_build_object(
      'authority_name', v_authority_name,
      'official_domain', v_official_domain,
      'program', v_program,
      'scope', v_scope,
      'candidate_status', v_candidate_status,
      'inventory_generated_at', v_pack.inventory_generated_at,
      'compliance_activation_allowed', false
    )
  );

  select
    count(*)::integer,
    count(*) filter (
      where candidate_status like 'BLOCKED%'
         or agent_verification_status in ('blocked', 'rejected')
    )::integer
  into v_source_count, v_blocked_count
  from public.state_rule_source_candidates
  where state_code = v_state_code
    and inventory_generated_at = v_pack.inventory_generated_at;

  update public.state_rule_pack_candidates
  set source_candidate_count = v_source_count,
      blocked_source_count = v_blocked_count,
      candidate_manifest = coalesce(candidate_manifest, '{}'::jsonb)
        || jsonb_build_object('source_count', v_source_count),
      status = case
        when v_blocked_count > 0 then 'blocked'
        else 'agent_verification_in_progress'
      end,
      compliance_activation_allowed = false,
      updated_at = now()
  where id = v_pack.id;

  return jsonb_build_object(
    'candidate_id', v_candidate_id,
    'state_code', v_state_code,
    'source_status', 'queued_for_agent_verification',
    'pack_status', case
      when v_blocked_count > 0 then 'blocked'
      else 'agent_verification_in_progress'
    end,
    'source_candidate_count', v_source_count,
    'compliance_activation_allowed', false
  );
exception
  when unique_violation then
    raise exception 'This official source URL already exists for the selected state pack';
end;
$$;

revoke all on function public.create_state_rule_source_candidate(text, text, text, text, text, text, text, text)
  from public;
revoke all on function public.create_state_rule_source_candidate(text, text, text, text, text, text, text, text)
  from anon;
grant execute on function public.create_state_rule_source_candidate(text, text, text, text, text, text, text, text)
  to authenticated;

comment on function public.create_state_rule_source_candidate(text, text, text, text, text, text, text, text) is
  'Creates an audited, fail-closed exact-file source candidate. Active CRM Administrator authority is required.';
