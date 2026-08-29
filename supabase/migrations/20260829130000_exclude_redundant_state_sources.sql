-- Preserve redundant/superseded validation candidates in reporting history without
-- allowing them to block a fully validated state pack.

update public.state_rule_source_candidates
set candidate_status = 'EXCLUDED_REDUNDANT_SOURCE',
    updated_at = now()
where agent_verification_status = 'rejected'
  and (
    candidate_status like 'SUPERSEDED_REDUNDANT%'
    or lower(coalesce(verification_evidence ->> 'notes', '')) like '%already recorded and validated%'
  );

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
    and source.inventory_generated_at = p_inventory_generated_at
    and not (
      source.agent_verification_status = 'rejected'
      and source.candidate_status = 'EXCLUDED_REDUNDANT_SOURCE'
    );

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
      and not (
        source.agent_verification_status = 'rejected'
        and source.candidate_status = 'EXCLUDED_REDUNDANT_SOURCE'
      )
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
          and source.candidate_status <> 'EXCLUDED_REDUNDANT_SOURCE'
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

comment on function public.refresh_state_rule_pack_activation(text, timestamptz) is
  'Activates complete packs while excluding controlled redundant-source rejections from required-source counts. Excluded rows remain immutable reporting history.';
