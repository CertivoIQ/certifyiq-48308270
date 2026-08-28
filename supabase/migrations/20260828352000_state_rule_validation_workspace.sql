-- Staff-only review workflow for the fail-closed nationwide state-source queue.
-- Source verification never activates a rule pack for compliance determinations.

create table if not exists public.state_rule_source_verification_events (
  id uuid primary key default gen_random_uuid(),
  source_candidate_id uuid not null references public.state_rule_source_candidates(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('captured_unvalidated', 'verified', 'blocked', 'rejected')),
  prior_status text not null,
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  retrieved_at timestamptz,
  notes text not null check (char_length(notes) between 10 and 4000),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists state_rule_source_verification_events_candidate_idx
  on public.state_rule_source_verification_events(source_candidate_id, created_at desc);
create index if not exists state_rule_source_verification_events_reviewer_idx
  on public.state_rule_source_verification_events(reviewer_id, created_at desc);

alter table public.state_rule_source_verification_events enable row level security;

revoke all on table public.state_rule_pack_candidates from anon;
revoke all on table public.state_rule_source_candidates from anon;
revoke all on table public.state_rule_source_verification_events from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_pack_candidates from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_source_candidates from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_source_verification_events from authenticated;
grant select on table public.state_rule_pack_candidates to authenticated;
grant select on table public.state_rule_source_candidates to authenticated;
grant select on table public.state_rule_source_verification_events to authenticated;

drop policy if exists "Staff can view state pack candidates" on public.state_rule_pack_candidates;
drop policy if exists "Staff can view state source candidates" on public.state_rule_source_candidates;
drop policy if exists "Managers can view state pack candidates" on public.state_rule_pack_candidates;
drop policy if exists "Managers can view state source candidates" on public.state_rule_source_candidates;
drop policy if exists "Managers can view state source verification events" on public.state_rule_source_verification_events;

create policy "Managers can view state pack candidates"
on public.state_rule_pack_candidates for select to authenticated
using (
  exists (
    select 1 from public.crm_staff_access access
    where access.user_id = (select auth.uid())
      and access.status = 'active'
      and access.access_level in ('manager', 'admin')
  )
);

create policy "Managers can view state source candidates"
on public.state_rule_source_candidates for select to authenticated
using (
  exists (
    select 1 from public.crm_staff_access access
    where access.user_id = (select auth.uid())
      and access.status = 'active'
      and access.access_level in ('manager', 'admin')
  )
);

create policy "Managers can view state source verification events"
on public.state_rule_source_verification_events for select to authenticated
using (
  exists (
    select 1 from public.crm_staff_access access
    where access.user_id = (select auth.uid())
      and access.status = 'active'
      and access.access_level in ('manager', 'admin')
  )
);

create or replace function public.review_state_rule_source_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_source_sha256 text default null,
  p_retrieved_at timestamptz default null,
  p_notes text default null,
  p_effective_date date default null,
  p_supersession_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_candidate public.state_rule_source_candidates%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_hash text := lower(trim(coalesce(p_source_sha256, '')));
  v_notes text := trim(coalesce(p_notes, ''));
  v_next_status text;
  v_pack_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.crm_staff_access access
    where access.user_id = v_user_id
      and access.status = 'active'
      and access.access_level in ('manager', 'admin')
  ) then
    raise exception 'Active Manager or Administrator authority required';
  end if;

  if v_decision not in ('captured_unvalidated', 'verified', 'blocked', 'rejected') then
    raise exception 'Unsupported source-review decision';
  end if;
  if char_length(v_notes) < 10 or char_length(v_notes) > 4000 then
    raise exception 'Review notes must contain 10 to 4000 characters';
  end if;
  if p_retrieved_at is not null and p_retrieved_at > now() + interval '5 minutes' then
    raise exception 'Retrieved time cannot be in the future';
  end if;
  if v_decision in ('captured_unvalidated', 'verified') then
    if v_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'A lowercase 64-character SHA-256 is required';
    end if;
    if p_retrieved_at is null then
      raise exception 'Retrieved time is required';
    end if;
  elsif v_hash <> '' and v_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'SHA-256 must be blank or a lowercase 64-character value';
  end if;

  select * into v_candidate
  from public.state_rule_source_candidates
  where id = p_candidate_id
  for update;
  if not found then
    raise exception 'State source candidate not found';
  end if;

  v_next_status := v_decision;
  update public.state_rule_source_candidates
  set agent_verification_status = v_next_status,
      exact_bytes_captured = case
        when v_decision in ('captured_unvalidated', 'verified') then true
        else exact_bytes_captured
      end,
      source_sha256 = case when v_hash = '' then source_sha256 else v_hash end,
      retrieved_at = coalesce(p_retrieved_at, retrieved_at),
      verification_evidence = coalesce(verification_evidence, '{}'::jsonb) || jsonb_build_object(
        'last_decision', v_decision,
        'reviewer_id', v_user_id,
        'reviewed_at', now(),
        'notes', v_notes,
        'effective_date', p_effective_date,
        'supersession_notes', nullif(trim(coalesce(p_supersession_notes, '')), '')
      ),
      compliance_activation_allowed = false,
      updated_at = now()
  where id = v_candidate.id;

  insert into public.state_rule_source_verification_events (
    source_candidate_id, reviewer_id, decision, prior_status,
    source_sha256, retrieved_at, notes, evidence
  ) values (
    v_candidate.id, v_user_id, v_decision, v_candidate.agent_verification_status,
    nullif(v_hash, ''), p_retrieved_at, v_notes,
    jsonb_build_object(
      'state_code', v_candidate.state_code,
      'authority_name', v_candidate.authority_name,
      'source_type', v_candidate.source_type,
      'source_url', v_candidate.source_url,
      'effective_date', p_effective_date,
      'supersession_notes', nullif(trim(coalesce(p_supersession_notes, '')), '')
    )
  );

  select case
    when bool_and(agent_verification_status = 'verified') then 'verified'
    when bool_or(agent_verification_status in ('blocked', 'rejected')) then 'blocked'
    when bool_or(agent_verification_status <> 'queued_for_agent_verification') then 'agent_verification_in_progress'
    else 'queued_for_agent_verification'
  end into v_pack_status
  from public.state_rule_source_candidates
  where state_code = v_candidate.state_code
    and inventory_generated_at = v_candidate.inventory_generated_at;

  update public.state_rule_pack_candidates
  set status = v_pack_status,
      compliance_activation_allowed = false,
      updated_at = now()
  where state_code = v_candidate.state_code
    and inventory_generated_at = v_candidate.inventory_generated_at;

  return jsonb_build_object(
    'candidate_id', v_candidate.id,
    'source_status', v_next_status,
    'pack_status', v_pack_status,
    'compliance_activation_allowed', false
  );
end;
$$;

revoke all on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) from public;
revoke all on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) from anon;
grant execute on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) to authenticated;

comment on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) is
  'Records controlled Manager/Admin source-review decisions. Never activates compliance rules.';

