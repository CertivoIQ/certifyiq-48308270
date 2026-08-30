-- Certification-only Final Review Confirmation.
-- This control is intentionally separate from state/federal rule-pack validation.

alter table public.certification_workflow_cases drop constraint if exists certification_workflow_cases_status_check;
alter table public.certification_workflow_cases add constraint certification_workflow_cases_status_check check (status in (
  'processing','findings_assigned','rerun_queued','awaiting_manager_approval','pending_final_review',
  'approved_filed','returned_for_correction','blocked'
));

create table if not exists public.certification_final_review_confirmations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.certification_workflow_cases(id) on delete restrict,
  certification_item_id uuid not null references public.certification_import_items(id) on delete restrict,
  workspace_user_id uuid not null references auth.users(id) on delete restrict,
  responsible_party_id uuid not null references auth.users(id) on delete restrict,
  responsible_party_name text not null check (char_length(btrim(responsible_party_name)) between 2 and 200),
  responsible_party_position text not null check (char_length(btrim(responsible_party_position)) between 2 and 200),
  signature_text text not null check (char_length(btrim(signature_text)) between 2 and 200),
  attestation text not null,
  confirmation_sha256 text not null unique check (confirmation_sha256 ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (lower(btrim(signature_text)) = lower(btrim(responsible_party_name)))
);

alter table public.certification_audit_files
  add column if not exists final_review_confirmation_id uuid
  references public.certification_final_review_confirmations(id) on delete restrict;

create index if not exists certification_final_review_confirmations_workspace_signed_idx
  on public.certification_final_review_confirmations(workspace_user_id, signed_at desc);

alter table public.certification_final_review_confirmations enable row level security;
revoke all on table public.certification_final_review_confirmations from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.certification_final_review_confirmations from authenticated;
grant select on table public.certification_final_review_confirmations to authenticated;
grant all on table public.certification_final_review_confirmations to service_role;

drop policy if exists "Managers can view certification final review confirmations"
  on public.certification_final_review_confirmations;
create policy "Managers can view certification final review confirmations"
on public.certification_final_review_confirmations
for select to authenticated
using (
  exists (
    select 1 from public.certification_workflow_cases c
    where c.id = certification_final_review_confirmations.case_id
      and private.certification_is_manager((select auth.uid()), c.workspace_user_id)
  )
);

create or replace function public.block_certification_final_review_confirmation_mutation()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  raise exception 'Certification final review confirmations are immutable';
end;
$$;
revoke all on function public.block_certification_final_review_confirmation_mutation() from public, anon, authenticated;
grant execute on function public.block_certification_final_review_confirmation_mutation() to service_role;
drop trigger if exists block_certification_final_review_confirmation_mutation on public.certification_final_review_confirmations;
create trigger block_certification_final_review_confirmation_mutation
before update or delete on public.certification_final_review_confirmations
for each row execute function public.block_certification_final_review_confirmation_mutation();

update public.certification_workflow_cases c
set status='pending_final_review', updated_at=now()
where c.status='awaiting_manager_approval'
  and c.approved_by is null
  and c.audit_filed_at is null
  and not exists (
    select 1 from public.certification_finding_assignments a
    where a.case_id=c.id and a.status<>'resolved'
  )
  and not exists (
    select 1 from public.compliance_findings f
    where f.item_id=c.certification_item_id
      and f.status='FAIL'
      and f.review_state<>'approved'
  );

create or replace function private.certification_sync_completed_item()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  _case_id uuid;
  _prior_status text;
begin
  if new.status <> 'completed' then return new; end if;

  insert into public.certification_workflow_cases(
    certification_item_id, workspace_user_id, status, rerun_count, last_rerun_at
  )
  values (
    new.id,
    new.user_id,
    case when exists (
      select 1 from public.compliance_findings f
      where f.item_id=new.id and f.status='FAIL' and f.review_state<>'approved'
    ) then 'findings_assigned' else 'pending_final_review' end,
    1,
    coalesce(new.processed_at,now())
  )
  on conflict(certification_item_id) do nothing
  returning id into _case_id;

  if _case_id is null then
    select id,status into _case_id,_prior_status
    from public.certification_workflow_cases
    where certification_item_id=new.id
    for update;

    if not exists (
      select 1 from public.compliance_findings f
      where f.item_id=new.id and f.status='FAIL' and f.review_state<>'approved'
    ) and _prior_status in ('processing','rerun_queued') then
      update public.certification_workflow_cases
      set status='pending_final_review',
          rerun_count=rerun_count+1,
          last_rerun_at=coalesce(new.processed_at,now()),
          updated_at=now()
      where id=_case_id;
    else
      return new;
    end if;
  end if;

  insert into public.certification_workflow_events(case_id,event_type,detail)
  values (
    _case_id,
    'manager_approval_requested',
    jsonb_build_object(
      'source','certification_processing',
      'item_status',new.status,
      'workflow_status','pending_final_review'
    )
  );
  return new;
end;
$$;

create or replace function public.resolve_certification_finding(
  _finding_id uuid,
  _resolution_notes text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  _actor uuid:=auth.uid();
  _assignment public.certification_finding_assignments;
  _case public.certification_workflow_cases;
  _finding public.compliance_findings;
  _rerun_snapshot jsonb;
  _rerun_sha text;
begin
  if _actor is null then raise exception 'authentication required'; end if;
  if nullif(trim(_resolution_notes),'') is null then raise exception 'resolution notes are required'; end if;

  select * into _assignment
  from public.certification_finding_assignments
  where finding_id=_finding_id
  for update;
  if _assignment.finding_id is null then raise exception 'finding task not found'; end if;

  select * into _case
  from public.certification_workflow_cases
  where id=_assignment.case_id
  for update;

  if _assignment.assigned_to<>_actor
     and not private.certification_is_manager(_actor,_case.workspace_user_id) then
    raise exception 'finding is not assigned to this account';
  end if;
  if _assignment.status='resolved' then
    return jsonb_build_object('ok',true,'status','already_resolved','case_status',_case.status);
  end if;

  select * into _finding
  from public.compliance_findings
  where id=_finding_id
  for update;

  insert into public.finding_reviews(finding_id,user_id,reviewer_id,decision,reason)
  values(_finding_id,_finding.user_id,_actor,'approved',trim(_resolution_notes));

  update public.compliance_findings
  set review_state='approved',updated_at=now()
  where id=_finding_id;

  update public.certification_finding_assignments
  set status='resolved',resolution_notes=trim(_resolution_notes),resolved_at=now(),resolved_by=_actor,updated_at=now()
  where finding_id=_finding_id;

  insert into public.certification_workflow_events(case_id,finding_id,actor_id,event_type,detail)
  values(_case.id,_finding_id,_actor,'finding_resolved',jsonb_build_object('resolution_notes',trim(_resolution_notes)));

  if exists (
    select 1 from public.certification_finding_assignments a
    where a.case_id=_case.id and a.status<>'resolved'
  ) or exists (
    select 1 from public.compliance_findings f
    where f.item_id=_case.certification_item_id
      and f.status='FAIL'
      and f.review_state<>'approved'
  ) then
    return jsonb_build_object('ok',true,'status','finding_resolved','case_status','findings_assigned');
  end if;

  update public.certification_workflow_cases set status='rerun_queued',updated_at=now() where id=_case.id;
  insert into public.certification_workflow_events(case_id,actor_id,event_type,detail)
  values(_case.id,_actor,'certification_rerun_requested',jsonb_build_object('reason','all_assigned_findings_resolved'));

  select jsonb_build_object(
    'certification_item_id',i.id,
    'source_sha256',i.sha256,
    'prior_engine_builds',coalesce((
      select jsonb_agg(distinct f.engine_build)
      from public.compliance_findings f where f.item_id=i.id
    ),'[]'::jsonb),
    'resolved_findings',coalesce((
      select jsonb_agg(jsonb_build_object(
        'finding_id',a.finding_id,
        'rule_id',f.rule_id,
        'status',f.status,
        'review_state',f.review_state,
        'resolved_at',a.resolved_at,
        'resolved_by',a.resolved_by
      ) order by a.finding_id)
      from public.certification_finding_assignments a
      join public.compliance_findings f on f.id=a.finding_id
      where a.case_id=_case.id
    ),'[]'::jsonb),
    'rerun_outcome','PASS',
    'rerun_reason','no_unresolved_findings_after_remediation'
  ) into _rerun_snapshot
  from public.certification_import_items i
  where i.id=_case.certification_item_id;

  _rerun_sha:=encode(extensions.digest(convert_to(_rerun_snapshot::text,'UTF8'),'sha256'),'hex');

  update public.certification_workflow_cases
  set status='pending_final_review',
      rerun_count=rerun_count+1,
      last_rerun_at=now(),
      last_rerun_manifest_sha256=_rerun_sha,
      updated_at=now()
  where id=_case.id;

  insert into public.certification_workflow_events(case_id,actor_id,event_type,detail)
  values
    (_case.id,_actor,'certification_rerun_completed',jsonb_build_object('outcome','PASS','manifest_sha256',_rerun_sha)),
    (_case.id,null,'manager_approval_requested',jsonb_build_object(
      'source','controlled_rerun',
      'manifest_sha256',_rerun_sha,
      'workflow_status','pending_final_review'
    ));

  return jsonb_build_object(
    'ok',true,
    'status','rerun_completed',
    'case_status','pending_final_review',
    'manifest_sha256',_rerun_sha
  );
end;
$$;

create or replace function public.approve_certification_final(_case_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Final review confirmation requires responsible party name, position, and signature';
end;
$$;

create or replace function public.approve_certification_final(
  _case_id uuid,
  _responsible_party_name text,
  _responsible_party_position text,
  _signature text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  _actor uuid:=auth.uid();
  _case public.certification_workflow_cases;
  _item public.certification_import_items;
  _snapshot jsonb;
  _manifest_sha text;
  _evidence_id uuid;
  _audit_id uuid;
  _confirmation_id uuid;
  _confirmation jsonb;
  _confirmation_sha text;
  _name text:=btrim(coalesce(_responsible_party_name,''));
  _position text:=btrim(coalesce(_responsible_party_position,''));
  _signed text:=btrim(coalesce(_signature,''));
  _signed_at timestamptz:=clock_timestamp();
  _attestation constant text:='I confirm that all certification findings have been resolved and that I am the responsible party completing final review.';
begin
  if _actor is null then raise exception 'authentication required'; end if;
  if char_length(_name)<2 then raise exception 'responsible party name is required'; end if;
  if char_length(_position)<2 then raise exception 'responsible party position is required'; end if;
  if char_length(_signed)<2 then raise exception 'responsible party signature is required'; end if;
  if lower(_signed)<>lower(_name) then raise exception 'typed signature must match the responsible party name'; end if;

  select * into _case
  from public.certification_workflow_cases
  where id=_case_id
  for update;
  if _case.id is null then raise exception 'certification case not found'; end if;
  if not private.certification_is_manager(_actor,_case.workspace_user_id) then raise exception 'manager authority required'; end if;
  if _case.status<>'pending_final_review' then raise exception 'certification is not pending final review'; end if;

  if exists (
    select 1 from public.certification_finding_assignments a
    where a.case_id=_case.id and a.status<>'resolved'
  ) or exists (
    select 1 from public.compliance_findings f
    where f.item_id=_case.certification_item_id
      and f.status='FAIL'
      and f.review_state<>'approved'
  ) then
    raise exception 'all findings must be resolved before final review confirmation';
  end if;

  select * into _item
  from public.certification_import_items
  where id=_case.certification_item_id;

  _confirmation:=jsonb_build_object(
    'schema_version','certification-final-review-confirmation/v1',
    'case_id',_case.id,
    'certification_item_id',_item.id,
    'responsible_party_id',_actor,
    'responsible_party_name',_name,
    'responsible_party_position',_position,
    'signature_text',_signed,
    'attestation',_attestation,
    'signed_at',_signed_at
  );
  _confirmation_sha:=encode(extensions.digest(convert_to(_confirmation::text,'UTF8'),'sha256'),'hex');

  insert into public.certification_final_review_confirmations(
    case_id,certification_item_id,workspace_user_id,responsible_party_id,
    responsible_party_name,responsible_party_position,signature_text,attestation,
    confirmation_sha256,signed_at
  )
  values(
    _case.id,_item.id,_case.workspace_user_id,_actor,
    _name,_position,_signed,_attestation,_confirmation_sha,_signed_at
  )
  returning id into _confirmation_id;

  select jsonb_build_object(
    'schema_version','certification-audit-file/v2',
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
    'final_review_confirmation',_confirmation||jsonb_build_object(
      'confirmation_id',_confirmation_id,
      'confirmation_sha256',_confirmation_sha
    ),
    'findings',coalesce((
      select jsonb_agg(jsonb_build_object(
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
      ) order by f.id)
      from public.compliance_findings f
      left join public.certification_finding_assignments a on a.finding_id=f.id
      where f.item_id=_item.id
    ),'[]'::jsonb)
  ) into _snapshot;

  _manifest_sha:=encode(extensions.digest(convert_to(_snapshot::text,'UTF8'),'sha256'),'hex');

  insert into public.evidence_manifests(
    review_id,user_id,organization_id,certification_id,outcome,
    engine_build,manifest,manifest_sha256
  )
  values(
    'certification-final:'||_case.id::text,
    _case.workspace_user_id,
    _case.workspace_user_id::text,
    coalesce(_item.matched_certification_id::text,_item.id::text),
    'APPROVED',
    coalesce((
      select max(f.engine_build)
      from public.compliance_findings f
      where f.item_id=_item.id
    ),'certivoiq-certification-workflow-v2'),
    _snapshot,
    _manifest_sha
  )
  returning id into _evidence_id;

  insert into public.certification_audit_files(
    case_id,certification_item_id,workspace_user_id,manager_id,approved_on,
    evidence_manifest_id,manifest_sha256,audit_snapshot,final_review_confirmation_id
  )
  values(
    _case.id,_item.id,_case.workspace_user_id,_actor,current_date,
    _evidence_id,_manifest_sha,_snapshot,_confirmation_id
  )
  returning id into _audit_id;

  update public.certification_workflow_cases
  set status='approved_filed',approved_by=_actor,approved_on=current_date,audit_filed_at=now(),updated_at=now()
  where id=_case.id;

  insert into public.certification_workflow_events(case_id,actor_id,event_type,detail)
  values
    (_case.id,_actor,'manager_final_approved',jsonb_build_object(
      'approved_on',current_date,
      'manifest_sha256',_manifest_sha,
      'final_review_confirmation_id',_confirmation_id,
      'confirmation_sha256',_confirmation_sha
    )),
    (_case.id,_actor,'certification_audit_filed',jsonb_build_object(
      'audit_file_id',_audit_id,
      'evidence_manifest_id',_evidence_id,
      'manifest_sha256',_manifest_sha,
      'final_review_confirmation_id',_confirmation_id
    ));

  return jsonb_build_object(
    'ok',true,
    'status','approved_filed',
    'audit_file_id',_audit_id,
    'evidence_manifest_id',_evidence_id,
    'manifest_sha256',_manifest_sha,
    'final_review_confirmation_id',_confirmation_id,
    'confirmation_sha256',_confirmation_sha
  );
end;
$$;

revoke all on function public.approve_certification_final(uuid,text,text,text) from public,anon;
grant execute on function public.approve_certification_final(uuid,text,text,text) to authenticated;

create or replace function public.certification_task_queue()
returns table(
  id text,task_type text,title text,description text,status text,active boolean,
  occurred_at timestamptz,destination text,action_label text,finding_id uuid,
  case_id uuid,workflow_role text,attention boolean
)
language sql stable security definer set search_path='' as $$
with actor as (
  select auth.uid() as id
), finding_tasks as (
  select
    'certification-finding:'||a.finding_id::text,
    'finding_remediation'::text,
    'Resolve certification finding · '||f.rule_id,
    f.severity||' · '||f.explanation,
    a.status,
    a.status='assigned',
    coalesce(a.updated_at,a.assigned_at),
    '/findings'::text,
    case when a.status='assigned' then 'Resolve finding' else 'View finding' end,
    a.finding_id,
    a.case_id,
    case when private.certification_is_manager(actor.id,c.workspace_user_id) then 'manager' else 'employee' end,
    f.severity in('critical','major')
  from public.certification_finding_assignments a
  join public.certification_workflow_cases c on c.id=a.case_id
  join public.compliance_findings f on f.id=a.finding_id
  cross join actor
  where a.assigned_to=actor.id
), manager_tasks as (
  select
    'certification-approval:'||c.id::text,
    'certification_approval'::text,
    'Pending final review · '||i.original_file_name,
    case when c.rerun_count>1
      then 'Controlled rerun passed after all findings were resolved. Responsible party confirmation, position, and signature are required before audit filing.'
      else 'Certification passed processing. Responsible party confirmation, position, and signature are required before audit filing.'
    end,
    c.status,
    c.status='pending_final_review',
    c.updated_at,
    '/files'::text,
    case when c.status='pending_final_review' then 'Complete final review' else 'View audit record' end,
    null::uuid,
    c.id,
    'manager'::text,
    false
  from public.certification_workflow_cases c
  join public.certification_import_items i on i.id=c.certification_item_id
  cross join actor
  where private.certification_is_manager(actor.id,c.workspace_user_id)
    and c.status in('pending_final_review','approved_filed')
)
select * from finding_tasks
union all
select * from manager_tasks
order by 6 desc, 7 desc;
$$;

revoke all on function public.certification_task_queue() from public,anon;
grant execute on function public.certification_task_queue() to authenticated;
