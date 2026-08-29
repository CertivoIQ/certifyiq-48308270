do $$
declare
  updated_packs integer;
begin
  update public.state_rule_pack_candidates pack
  set status = case
        when exists (
          select 1 from public.state_rule_source_candidates source
          where source.state_code = pack.state_code
            and source.agent_verification_status = 'blocked'
        ) then 'blocked'
        when exists (
          select 1 from public.state_rule_source_candidates source
          where source.state_code = pack.state_code
            and source.agent_verification_status not in ('verified', 'rejected')
        ) then 'agent_verification_in_progress'
        else 'verified'
      end,
      blocked_source_count = (
        select count(*) from public.state_rule_source_candidates source
        where source.state_code = pack.state_code
          and source.agent_verification_status = 'blocked'
      ),
      candidate_manifest = pack.candidate_manifest || jsonb_build_object(
        'aggregate_status_reconciled_at', now(),
        'aggregate_status_source', 'state_rule_source_candidates'
      ),
      compliance_activation_allowed = false,
      updated_at = now()
  where pack.state_code in ('AZ', 'FL');

  get diagnostics updated_packs = row_count;
  if updated_packs <> 2 then
    raise exception 'Expected to reconcile AZ and FL pack status, updated % rows', updated_packs;
  end if;

  if exists (
    select 1 from public.state_rule_pack_candidates
    where state_code in ('AZ', 'FL') and (status = 'blocked' or blocked_source_count <> 0)
  ) then
    raise exception 'AZ or FL remains blocked after source reconciliation';
  end if;
end
$$;
