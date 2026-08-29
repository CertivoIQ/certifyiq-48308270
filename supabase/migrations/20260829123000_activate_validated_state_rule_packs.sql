-- Activate a state rule pack automatically when its entire controlled source set is validated.
-- Reviewer identity remains an internal audit reference. Operational records expose only
-- the calendar date of validation; no email signature or validation time is required.

alter table public.state_rule_pack_candidates
  drop constraint if exists state_rule_pack_candidates_compliance_activation_allowed_check;
alter table public.state_rule_source_candidates
  drop constraint if exists state_rule_source_candidates_compliance_activation_allowe_check;

alter table public.state_rule_pack_candidates
  drop constraint if exists state_rule_pack_candidates_status_check;
alter table public.state_rule_pack_candidates
  add constraint state_rule_pack_candidates_status_check
  check (
    status in (
      'queued_for_agent_verification',
      'agent_verification_in_progress',
      'blocked',
      'verified',
      'active',
      'rejected'
    )
  );

alter table public.state_rule_pack_candidates
  add column if not exists validated_on date;

create or replace function public.normalize_state_rule_pack_activation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $
begin
  if new.status = 'active' then
    if not new.compliance_activation_allowed or new.validated_on is null then
      raise exception 'An active state rule pack requires controlled validation';
    end if;
    new.agent_verification_required := false;
  else
    new.compliance_activation_allowed := false;
    new.agent_verification_required := true;
    new.validated_on := null;
  end if;
  return new;
end;
$;

drop trigger if exists normalize_state_rule_pack_activation
  on public.state_rule_pack_candidates;
create trigger normalize_state_rule_pack_activation
before insert or update of status, compliance_activation_allowed, agent_verification_required, validated_on
on public.state_rule_pack_candidates
for each row execute function public.normalize_state_rule_pack_activation();

revoke all on function public.normalize_state_rule_pack_activation() from public;
revoke all on function public.normalize_state_rule_pack_activation() from anon;
revoke all on function public.normalize_state_rule_pack_activation() from authenticated;

alter table public.state_rule_pack_candidates
  drop constraint if exists state_rule_pack_candidates_activation_state_check;
alter table public.state_rule_pack_candidates
  add constraint state_rule_pack_candidates_activation_state_check
  check (
    (
      status = 'active'
      and compliance_activation_allowed
      and validated_on is not null
      and agent_verification_required = false
    )
    or
    (
      status <> 'active'
      and compliance_activation_allowed = false
      and agent_verification_required
    )
  ) not valid;

create or replace function public.refresh_state_rule_pack_activation(
  p_state_code text,
  p_inventory_generated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_state_code text := upper(trim(coalesce(p_state_code, '')));
  v_own_ready boolean := false;
  v_federal_ready boolean := false;
  v_has_blocker boolean := false;
  v_has_progress boolean := false;
  v_active boolean := false;
  v_status text;
  v_validated_on date;
begin
  if v_state_code !~ '^[A-Z]{2}$' then
    raise exception 'A two-letter jurisdiction code is required';
  end if;

  if not exists (
    select 1
    from public.state_rule_pack_candidates pack
    where pack.state_code = v_state_code
      and pack.inventory_generated_at = p_inventory_generated_at
  ) then
    raise exception 'State rule pack candidate not found';
  end if;

  select
    count(*) > 0
      and bool_and(
        source.agent_verification_status = 'verified'
        and source.exact_bytes_captured
        and source.source_sha256 is not null
        and source.retrieved_at is not null
      ),
    coalesce(bool_or(source.agent_verification_status in ('blocked', 'rejected')), false),
    coalesce(bool_or(source.agent_verification_status <> 'queued_for_agent_verification'), false)
  into v_own_ready, v_has_blocker, v_has_progress
  from public.state_rule_source_candidates source
  where source.state_code = v_state_code
    and source.inventory_generated_at = p_inventory_generated_at;

  if v_state_code = 'US' then
    v_federal_ready := true;
  else
    select
      count(*) > 0
        and bool_and(
          source.agent_verification_status = 'verified'
          and source.exact_bytes_captured
          and source.source_sha256 is not null
          and source.retrieved_at is not null
        ),
      v_has_blocker
        or coalesce(bool_or(source.agent_verification_status in ('blocked', 'rejected')), false),
      v_has_progress
        or coalesce(bool_or(source.agent_verification_status <> 'queued_for_agent_verification'), false)
    into v_federal_ready, v_has_blocker, v_has_progress
    from public.state_rule_source_candidates source
    where source.state_code = 'US'
      and source.inventory_generated_at = (
        select max(federal_pack.inventory_generated_at)
        from public.state_rule_pack_candidates federal_pack
        where federal_pack.state_code = 'US'
      );
  end if;

  v_active := v_own_ready and v_federal_ready;
  v_status := case
    when v_active then 'active'
    when v_has_blocker then 'blocked'
    when v_has_progress then 'agent_verification_in_progress'
    else 'queued_for_agent_verification'
  end;

  update public.state_rule_pack_candidates pack
  set status = v_status,
      compliance_activation_allowed = v_active,
      agent_verification_required = not v_active,
      validated_on = case
        when v_active then coalesce(pack.validated_on, current_date)
        else null
      end,
      blocked_source_count = (
        select count(*)::integer
        from public.state_rule_source_candidates source
        where source.state_code = v_state_code
          and source.inventory_generated_at = p_inventory_generated_at
          and source.agent_verification_status in ('blocked', 'rejected')
      ),
      updated_at = now()
  where pack.state_code = v_state_code
    and pack.inventory_generated_at = p_inventory_generated_at
  returning pack.validated_on into v_validated_on;

  return jsonb_build_object(
    'state_code', v_state_code,
    'pack_status', v_status,
    'compliance_activation_allowed', v_active,
    'validated_on', v_validated_on
  );
end;
$$;

revoke all on function public.refresh_state_rule_pack_activation(text, timestamptz) from public;
revoke all on function public.refresh_state_rule_pack_activation(text, timestamptz) from anon;
revoke all on function public.refresh_state_rule_pack_activation(text, timestamptz) from authenticated;
grant execute on function public.refresh_state_rule_pack_activation(text, timestamptz) to service_role;

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
  v_activation jsonb;
  v_latest_federal_inventory timestamptz;
  v_pack record;
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

  update public.state_rule_source_candidates
  set agent_verification_status = v_decision,
      exact_bytes_captured = case
        when v_decision in ('captured_unvalidated', 'verified') then true
        else exact_bytes_captured
      end,
      source_sha256 = case when v_hash = '' then source_sha256 else v_hash end,
      retrieved_at = coalesce(p_retrieved_at, retrieved_at),
      verification_evidence = coalesce(verification_evidence, '{}'::jsonb)
        - 'reviewer_email'
        - 'approver_email'
        - 'reviewed_at'
        || jsonb_build_object(
          'last_decision', v_decision,
          'reviewer_id', v_user_id,
          'validated_on', case when v_decision = 'verified' then current_date else null end,
          'notes', v_notes,
          'effective_date', p_effective_date,
          'supersession_notes', nullif(trim(coalesce(p_supersession_notes, '')), '')
        ),
      compliance_activation_allowed = (v_decision = 'verified'),
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
      'validated_on', case when v_decision = 'verified' then current_date else null end,
      'effective_date', p_effective_date,
      'supersession_notes', nullif(trim(coalesce(p_supersession_notes, '')), '')
    )
  );

  if v_candidate.state_code = 'US' then
    select max(inventory_generated_at)
    into v_latest_federal_inventory
    from public.state_rule_pack_candidates
    where state_code = 'US';

    if v_candidate.inventory_generated_at = v_latest_federal_inventory then
      for v_pack in
        select state_code, inventory_generated_at
        from public.state_rule_pack_candidates
      loop
        v_activation := public.refresh_state_rule_pack_activation(
          v_pack.state_code,
          v_pack.inventory_generated_at
        );
      end loop;
    else
      v_activation := public.refresh_state_rule_pack_activation(
        v_candidate.state_code,
        v_candidate.inventory_generated_at
      );
    end if;
  else
    v_activation := public.refresh_state_rule_pack_activation(
      v_candidate.state_code,
      v_candidate.inventory_generated_at
    );
  end if;

  return jsonb_build_object(
    'candidate_id', v_candidate.id,
    'source_status', v_decision,
    'pack_status', v_activation ->> 'pack_status',
    'compliance_activation_allowed',
      coalesce((v_activation ->> 'compliance_activation_allowed')::boolean, false),
    'validated_on', v_activation ->> 'validated_on'
  );
end;
$$;

revoke all on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) from public;
revoke all on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) from anon;
grant execute on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) to authenticated;

comment on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) is
  'Records controlled Manager/Admin source decisions and activates the pack automatically after every required state and federal source is verified. Operational records retain reviewer IDs, not reviewer or approver email addresses.';

-- Remove any legacy email values from operational evidence. Identity remains resolvable
-- through the immutable reviewer_id in controlled audit reporting.
update public.state_rule_source_candidates
set verification_evidence = verification_evidence
  - 'reviewer_email'
  - 'approver_email'
  - 'reviewed_at'
  || case
       when agent_verification_status = 'verified'
       then jsonb_build_object('validated_on', coalesce((verification_evidence ->> 'validated_on')::date, updated_at::date))
       else '{}'::jsonb
     end,
    compliance_activation_allowed = (agent_verification_status = 'verified');

do $$
declare
  v_pack record;
begin
  for v_pack in
    select state_code, inventory_generated_at
    from public.state_rule_pack_candidates
  loop
    perform public.refresh_state_rule_pack_activation(v_pack.state_code, v_pack.inventory_generated_at);
  end loop;
end;
$$;

alter table public.state_rule_pack_candidates
  validate constraint state_rule_pack_candidates_activation_state_check;

alter table public.state_rule_source_candidates
  drop constraint if exists state_rule_source_candidates_activation_state_check;
alter table public.state_rule_source_candidates
  add constraint state_rule_source_candidates_activation_state_check
  check (
    compliance_activation_allowed
      = (agent_verification_status = 'verified')
  );

comment on column public.state_rule_pack_candidates.validated_on is
  'Calendar date the complete pack most recently passed controlled validation and became active. No email signature or time-of-day is required.';
comment on column public.state_rule_pack_candidates.compliance_activation_allowed is
  'True only while the complete state pack and inherited federal baseline satisfy controlled source validation.';
