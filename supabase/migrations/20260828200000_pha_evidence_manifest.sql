-- Auditable PHA family evidence manifest export.
create or replace function public.build_pha_family_evidence_manifest(target_family_action_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  action_row public.pha_family_actions%rowtype;
  calculation jsonb;
  evidence jsonb;
  notices jsonb;
  tx jsonb;
  controls jsonb;
begin
  select * into action_row from public.pha_family_actions where id=target_family_action_id;
  if not found then raise exception 'PHA family action not found'; end if;
  if not public.pha_program_access(action_row.user_id,action_row.program_code,false) then raise exception 'Not authorized to export this PHA family record'; end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at),'[]'::jsonb) into evidence from public.pha_family_evidence e where e.family_action_id=target_family_action_id;
  select coalesce(to_jsonb(c),'null'::jsonb) into calculation from public.pha_family_calculations c where c.family_action_id=target_family_action_id limit 1;
  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at),'[]'::jsonb) into notices from public.pha_family_notices n where n.family_action_id=target_family_action_id;
  select coalesce(to_jsonb(t),'null'::jsonb) into tx from public.pha_50058_transactions t where t.source_family_action_id=target_family_action_id limit 1;
  select coalesce(to_jsonb(c),'null'::jsonb) into controls from public.pha_authoritative_control_state c where c.user_id=action_row.user_id and c.program_code=action_row.program_code limit 1;

  return jsonb_build_object(
    'manifest_version','2026.08.1',
    'generated_at',now(),
    'family_action',to_jsonb(action_row),
    'evidence',evidence,
    'calculation',calculation,
    'notices',notices,
    'hud_50058_transaction',tx,
    'authoritative_controls',controls,
    'integrity',jsonb_build_object(
      'verification_complete',action_row.verification_complete,
      'eiv_review_complete',action_row.eiv_review_complete,
      'calculation_complete',action_row.calculation_complete,
      'notice_complete',action_row.notice_complete,
      'controlled_source_release_approved',action_row.controlled_source_release_approved,
      'current_rule_version_validated',action_row.current_rule_version_validated,
      'source_status_conflict',action_row.source_status_conflict,
      'reporting_path_validated',action_row.reporting_path_validated,
      'software_compatibility_validated',action_row.software_compatibility_validated
    )
  );
end;
$$;
grant execute on function public.build_pha_family_evidence_manifest(uuid) to authenticated;
