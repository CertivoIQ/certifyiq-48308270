-- Production hotfix: pgcrypto is installed in the extensions schema.
create or replace function public.resolve_certification_finding(
  _finding_id uuid,
  _resolution_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor uuid := auth.uid();
  _assignment public.certification_finding_assignments;
  _case public.certification_workflow_cases;
  _finding public.compliance_findings;
  _rerun_snapshot jsonb;
  _rerun_sha text;
begin
  if _actor is null then raise exception 'authentication required'; end if;
  if nullif(trim(_resolution_notes),'') is null then
    raise exception 'resolution notes are required';
  end if;

  select * into _assignment
  from public.certification_finding_assignments
  where finding_id = _finding_id
  for update;
  if _assignment.finding_id is null then raise exception 'finding task not found'; end if;

  select * into _case
  from public.certification_workflow_cases
  where id = _assignment.case_id
  for update;

  if _assignment.assigned_to <> _actor
     and not private.certification_is_manager(_actor, _case.workspace_user_id) then
    raise exception 'finding is not assigned to this account';
  end if;
  if _assignment.status = 'resolved' then
    return jsonb_build_object('ok',true,'status','already_resolved','case_status',_case.status);
  end if;

  select * into _finding
  from public.compliance_findings
  where id = _finding_id
  for update;

  insert into public.finding_reviews(
    finding_id,user_id,reviewer_id,decision,reason
  )
  values (_finding_id,_finding.user_id,_actor,'approved',trim(_resolution_notes));

  update public.compliance_findings
  set review_state = 'approved', updated_at = now()
  where id = _finding_id;

  update public.certification_finding_assignments
  set status = 'resolved',
      resolution_notes = trim(_resolution_notes),
      resolved_at = now(),
      resolved_by = _actor,
      updated_at = now()
  where finding_id = _finding_id;

  insert into public.certification_workflow_events(
    case_id,finding_id,actor_id,event_type,detail
  )
  values (
    _case.id,_finding_id,_actor,'finding_resolved',
    jsonb_build_object('resolution_notes',trim(_resolution_notes))
  );

  if exists (
    select 1 from public.certification_finding_assignments a
    where a.case_id = _case.id and a.status <> 'resolved'
  ) or exists (
    select 1
    from public.compliance_findings f
    where f.item_id = _case.certification_item_id
      and f.status = 'FAIL'
      and f.review_state <> 'approved'
  ) then
    return jsonb_build_object('ok',true,'status','finding_resolved','case_status','findings_assigned');
  end if;

  update public.certification_workflow_cases
  set status = 'rerun_queued', updated_at = now()
  where id = _case.id;

  insert into public.certification_workflow_events(case_id,actor_id,event_type,detail)
  values (
    _case.id,_actor,'certification_rerun_requested',
    jsonb_build_object('reason','all_assigned_findings_resolved')
  );

  select jsonb_build_object(
    'certification_item_id', i.id,
    'source_sha256', i.sha256,
    'prior_engine_builds', coalesce((
      select jsonb_agg(distinct f.engine_build)
      from public.compliance_findings f where f.item_id = i.id
    ), '[]'::jsonb),
    'resolved_findings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'finding_id',a.finding_id,
          'rule_id',f.rule_id,
          'status',f.status,
          'review_state',f.review_state,
          'resolved_at',a.resolved_at,
          'resolved_by',a.resolved_by
        ) order by a.finding_id
      )
      from public.certification_finding_assignments a
      join public.compliance_findings f on f.id = a.finding_id
      where a.case_id = _case.id
    ), '[]'::jsonb),
    'rerun_outcome','PASS',
    'rerun_reason','no_unresolved_findings_after_remediation'
  ) into _rerun_snapshot
  from public.certification_import_items i
  where i.id = _case.certification_item_id;

  _rerun_sha := encode(extensions.digest(convert_to(_rerun_snapshot::text,'UTF8'),'sha256'),'hex');

  update public.certification_workflow_cases
  set status = 'awaiting_manager_approval',
      rerun_count = rerun_count + 1,
      last_rerun_at = now(),
      last_rerun_manifest_sha256 = _rerun_sha,
      updated_at = now()
  where id = _case.id;

  insert into public.certification_workflow_events(case_id,actor_id,event_type,detail)
  values
    (_case.id,_actor,'certification_rerun_completed',
      jsonb_build_object('outcome','PASS','manifest_sha256',_rerun_sha)),
    (_case.id,null,'manager_approval_requested',
      jsonb_build_object('source','controlled_rerun','manifest_sha256',_rerun_sha));

  return jsonb_build_object(
    'ok',true,
    'status','rerun_completed',
    'case_status','awaiting_manager_approval',
    'manifest_sha256',_rerun_sha
  );
end;
$$;

create or replace function public.approve_certification_final(_case_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor uuid := auth.uid();
  _case public.certification_workflow_cases;
  _item public.certification_import_items;
  _snapshot jsonb;
  _manifest_sha text;
  _evidence_id uuid;
  _audit_id uuid;
begin
  if _actor is null then raise exception 'authentication required'; end if;

  select * into _case
  from public.certification_workflow_cases
  where id = _case_id
  for update;
  if _case.id is null then raise exception 'certification case not found'; end if;
  if not private.certification_is_manager(_actor, _case.workspace_user_id) then
    raise exception 'manager authority required';
  end if;
  if _case.status <> 'awaiting_manager_approval' then
    raise exception 'certification is not awaiting final approval';
  end if;
  if exists (
    select 1 from public.certification_finding_assignments a
    where a.case_id = _case.id and a.status <> 'resolved'
  ) or exists (
    select 1 from public.compliance_findings f
    where f.item_id = _case.certification_item_id
      and f.status = 'FAIL'
      and f.review_state <> 'approved'
  ) then
    raise exception 'all findings must be resolved before final approval';
  end if;

  select * into _item
  from public.certification_import_items
  where id = _case.certification_item_id;

  select jsonb_build_object(
    'schema_version','certification-audit-file/v1',
    'case_id',_case.id,
    'certification_item_id',_item.id,
    'matched_certification_id',_item.matched_certification_id,
    'source_sha256',_item.sha256,
    'processed_at',_item.processed_at,
    'rerun_count',_case.rerun_count,
    'last_rerun_at',_case.last_rerun_at,
    'last_rerun_manifest_sha256',_case.last_rerun_manifest_sha256,
    'manager_id',_actor,
    'approved_on',current_date,
    'findings',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'finding_id',f.id,
          'rule_id',f.rule_id,
          'rule_version',f.rule_version,
          'rule_pack_id',f.rule_pack_id,
          'rule_pack_version',f.rule_pack_version,
          'status',f.status,
          'severity',f.severity,
          'review_state',f.review_state,
          'engine_build',f.engine_build,
          'assignment_status',a.status,
          'resolved_at',a.resolved_at,
          'resolved_by',a.resolved_by
        ) order by f.id
      )
      from public.compliance_findings f
      left join public.certification_finding_assignments a on a.finding_id = f.id
      where f.item_id = _item.id
    ),'[]'::jsonb)
  ) into _snapshot;

  _manifest_sha := encode(extensions.digest(convert_to(_snapshot::text,'UTF8'),'sha256'),'hex');

  insert into public.evidence_manifests(
    review_id,user_id,organization_id,certification_id,outcome,
    engine_build,manifest,manifest_sha256
  )
  values (
    'certification-final:' || _case.id::text,
    _case.workspace_user_id,
    _case.workspace_user_id::text,
    coalesce(_item.matched_certification_id::text,_item.id::text),
    'APPROVED',
    coalesce((
      select max(f.engine_build) from public.compliance_findings f where f.item_id = _item.id
    ),'certivoiq-certification-workflow-v1'),
    _snapshot,
    _manifest_sha
  )
  returning id into _evidence_id;

  insert into public.certification_audit_files(
    case_id,certification_item_id,workspace_user_id,manager_id,approved_on,
    evidence_manifest_id,manifest_sha256,audit_snapshot
  )
  values (
    _case.id,_item.id,_case.workspace_user_id,_actor,current_date,
    _evidence_id,_manifest_sha,_snapshot
  )
  returning id into _audit_id;

  update public.certification_workflow_cases
  set status = 'approved_filed',
      approved_by = _actor,
      approved_on = current_date,
      audit_filed_at = now(),
      updated_at = now()
  where id = _case.id;

  insert into public.certification_workflow_events(case_id,actor_id,event_type,detail)
  values
    (_case.id,_actor,'manager_final_approved',
      jsonb_build_object('approved_on',current_date,'manifest_sha256',_manifest_sha)),
    (_case.id,_actor,'certification_audit_filed',
      jsonb_build_object('audit_file_id',_audit_id,'evidence_manifest_id',_evidence_id,'manifest_sha256',_manifest_sha));

  return jsonb_build_object(
    'ok',true,'status','approved_filed','audit_file_id',_audit_id,
    'evidence_manifest_id',_evidence_id,'manifest_sha256',_manifest_sha
  );
end;
$$;


