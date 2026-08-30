-- Role-aware certification task workflow with manager-only approval and immutable audit filing.

create table if not exists public.certification_workflow_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  workflow_role text not null check (workflow_role in ('manager','employee')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_user_id, member_user_id)
);

create table if not exists public.certification_workflow_cases (
  id uuid primary key default gen_random_uuid(),
  certification_item_id uuid not null unique references public.certification_import_items(id) on delete restrict,
  workspace_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'processing' check (status in (
    'processing','findings_assigned','rerun_queued','awaiting_manager_approval',
    'approved_filed','returned_for_correction','blocked'
  )),
  rerun_count integer not null default 0 check (rerun_count >= 0),
  last_rerun_at timestamptz,
  last_rerun_manifest_sha256 text,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_on date,
  audit_filed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'approved_filed') or
    (approved_by is not null and approved_on is not null and audit_filed_at is not null))
);

create table if not exists public.certification_finding_assignments (
  finding_id uuid primary key references public.compliance_findings(id) on delete restrict,
  case_id uuid not null references public.certification_workflow_cases(id) on delete restrict,
  assigned_to uuid not null references auth.users(id) on delete restrict,
  status text not null default 'assigned' check (status in ('assigned','resolved')),
  resolution_notes text,
  assigned_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check ((status <> 'resolved') or
    (resolved_at is not null and resolved_by is not null and length(trim(resolution_notes)) > 0))
);

create table if not exists public.certification_workflow_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.certification_workflow_cases(id) on delete restrict,
  finding_id uuid references public.compliance_findings(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  occurred_at timestamptz not null default now()
);

create table if not exists public.certification_audit_files (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.certification_workflow_cases(id) on delete restrict,
  certification_item_id uuid not null references public.certification_import_items(id) on delete restrict,
  workspace_user_id uuid not null references auth.users(id) on delete restrict,
  manager_id uuid not null references auth.users(id) on delete restrict,
  approved_on date not null,
  evidence_manifest_id uuid not null references public.evidence_manifests(id) on delete restrict,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  audit_snapshot jsonb not null check (jsonb_typeof(audit_snapshot) = 'object'),
  filed_at timestamptz not null default now()
);

create index if not exists certification_workflow_memberships_member_idx
  on public.certification_workflow_memberships(member_user_id, active, workflow_role);
create index if not exists certification_workflow_cases_workspace_status_idx
  on public.certification_workflow_cases(workspace_user_id, status, updated_at desc);
create index if not exists certification_finding_assignments_assignee_idx
  on public.certification_finding_assignments(assigned_to, status, updated_at desc);
create index if not exists certification_workflow_events_case_idx
  on public.certification_workflow_events(case_id, occurred_at desc);
create index if not exists certification_audit_files_workspace_idx
  on public.certification_audit_files(workspace_user_id, filed_at desc);

create or replace function private.certification_is_manager(_actor uuid, _workspace_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _actor is not null and (
    _actor = _workspace_user_id
    or exists (
      select 1
      from public.certification_workflow_memberships m
      where m.workspace_user_id = _workspace_user_id
        and m.member_user_id = _actor
        and m.workflow_role = 'manager'
        and m.active
    )
    or exists (
      select 1
      from public.pha_workspace_memberships m
      where m.workspace_user_id = _workspace_user_id
        and m.member_user_id = _actor
        and m.active
        and m.agency_role in ('workspace_owner','agency_admin','compliance_admin','executive')
    )
  );
$$;

create or replace function private.certification_is_participant(_actor uuid, _workspace_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _actor is not null and (
    private.certification_is_manager(_actor, _workspace_user_id)
    or exists (
      select 1
      from public.certification_workflow_memberships m
      where m.workspace_user_id = _workspace_user_id
        and m.member_user_id = _actor
        and m.active
    )
    or exists (
      select 1
      from public.pha_workspace_memberships m
      where m.workspace_user_id = _workspace_user_id
        and m.member_user_id = _actor
        and m.active
    )
  );
$$;

create or replace function private.certification_pick_employee(_workspace_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select candidate.member_user_id
  from (
    select m.member_user_id, 1 as priority
    from public.certification_workflow_memberships m
    where m.workspace_user_id = _workspace_user_id
      and m.workflow_role = 'employee'
      and m.active
    union all
    select m.member_user_id, 2 as priority
    from public.pha_workspace_memberships m
    where m.workspace_user_id = _workspace_user_id
      and m.active
      and m.agency_role not in ('workspace_owner','agency_admin','compliance_admin','executive')
  ) candidate
  order by candidate.priority, candidate.member_user_id
  limit 1;
$$;

revoke all on function private.certification_is_manager(uuid,uuid) from public, anon, authenticated;
revoke all on function private.certification_is_participant(uuid,uuid) from public, anon, authenticated;
revoke all on function private.certification_pick_employee(uuid) from public, anon, authenticated;

create or replace function public.prevent_certification_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'certification audit records are append-only';
end;
$$;

drop trigger if exists certification_workflow_events_immutable on public.certification_workflow_events;
create trigger certification_workflow_events_immutable
before update or delete on public.certification_workflow_events
for each row execute function public.prevent_certification_audit_mutation();

drop trigger if exists certification_audit_files_immutable on public.certification_audit_files;
create trigger certification_audit_files_immutable
before update or delete on public.certification_audit_files
for each row execute function public.prevent_certification_audit_mutation();

create or replace function private.certification_sync_completed_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _case_id uuid;
  _prior_status text;
begin
  if new.status <> 'completed' then
    return new;
  end if;

  insert into public.certification_workflow_cases(
    certification_item_id, workspace_user_id, status, rerun_count, last_rerun_at
  )
  values (
    new.id, new.user_id,
    case when exists (
      select 1 from public.compliance_findings f
      where f.item_id = new.id and f.status = 'FAIL' and f.review_state <> 'approved'
    ) then 'findings_assigned' else 'awaiting_manager_approval' end,
    1, coalesce(new.processed_at, now())
  )
  on conflict (certification_item_id) do nothing
  returning id into _case_id;

  if _case_id is null then
    select id, status into _case_id, _prior_status
    from public.certification_workflow_cases
    where certification_item_id = new.id
    for update;

    if not exists (
      select 1 from public.compliance_findings f
      where f.item_id = new.id and f.status = 'FAIL' and f.review_state <> 'approved'
    ) and _prior_status in ('processing','rerun_queued') then
      update public.certification_workflow_cases
      set status = 'awaiting_manager_approval',
          rerun_count = rerun_count + 1,
          last_rerun_at = coalesce(new.processed_at, now()),
          updated_at = now()
      where id = _case_id;
    else
      return new;
    end if;
  end if;

  insert into public.certification_workflow_events(case_id,event_type,detail)
  values (
    _case_id,
    'manager_approval_requested',
    jsonb_build_object('source','certification_processing','item_status',new.status)
  );
  return new;
end;
$$;

drop trigger if exists certification_item_workflow_sync on public.certification_import_items;
create trigger certification_item_workflow_sync
after insert or update of status on public.certification_import_items
for each row execute function private.certification_sync_completed_item();

create or replace function private.certification_assign_finding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _case_id uuid;
  _workspace_user_id uuid;
  _assignee uuid;
begin
  if new.status <> 'FAIL' then
    return new;
  end if;

  select i.user_id into _workspace_user_id
  from public.certification_import_items i
  where i.id = new.item_id;

  insert into public.certification_workflow_cases(
    certification_item_id, workspace_user_id, status
  )
  values (new.item_id, _workspace_user_id, 'findings_assigned')
  on conflict (certification_item_id) do update
    set status = 'findings_assigned',
        approved_by = null,
        approved_on = null,
        audit_filed_at = null,
        updated_at = now()
  returning id into _case_id;

  _assignee := coalesce(
    private.certification_pick_employee(_workspace_user_id),
    _workspace_user_id
  );

  insert into public.certification_finding_assignments(
    finding_id, case_id, assigned_to, status
  )
  values (new.id, _case_id, _assignee, 'assigned')
  on conflict (finding_id) do update
    set case_id = excluded.case_id,
        assigned_to = case
          when public.certification_finding_assignments.status = 'resolved'
          then public.certification_finding_assignments.assigned_to
          else excluded.assigned_to
        end,
        updated_at = now();

  insert into public.certification_workflow_events(
    case_id, finding_id, event_type, detail
  )
  values (
    _case_id, new.id, 'finding_assigned',
    jsonb_build_object(
      'assigned_to', _assignee,
      'assignment_basis',
      case when _assignee = _workspace_user_id then 'workspace_owner_fallback' else 'employee_role' end,
      'severity', new.severity,
      'rule_id', new.rule_id
    )
  );
  return new;
end;
$$;

drop trigger if exists certification_finding_assignment_sync on public.compliance_findings;
create trigger certification_finding_assignment_sync
after insert or update of status on public.compliance_findings
for each row execute function private.certification_assign_finding();

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

  _rerun_sha := encode(digest(convert_to(_rerun_snapshot::text,'UTF8'),'sha256'),'hex');

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

  _manifest_sha := encode(digest(convert_to(_snapshot::text,'UTF8'),'sha256'),'hex');

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

create or replace function public.certification_task_queue()
returns table (
  id text,
  task_type text,
  title text,
  description text,
  status text,
  active boolean,
  occurred_at timestamptz,
  destination text,
  action_label text,
  finding_id uuid,
  case_id uuid,
  workflow_role text,
  attention boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select auth.uid() as id
  ),
  finding_tasks as (
    select
      'certification-finding:' || a.finding_id::text as id,
      'finding_remediation'::text as task_type,
      'Resolve certification finding · ' || f.rule_id as title,
      f.severity || ' · ' || f.explanation as description,
      a.status,
      a.status = 'assigned' as active,
      coalesce(a.updated_at,a.assigned_at) as occurred_at,
      '/findings'::text as destination,
      case when a.status = 'assigned' then 'Resolve finding' else 'View finding' end as action_label,
      a.finding_id,
      a.case_id,
      case when private.certification_is_manager(actor.id,c.workspace_user_id)
        then 'manager' else 'employee' end as workflow_role,
      f.severity in ('critical','major') as attention
    from public.certification_finding_assignments a
    join public.certification_workflow_cases c on c.id = a.case_id
    join public.compliance_findings f on f.id = a.finding_id
    cross join actor
    where a.assigned_to = actor.id
  ),
  manager_tasks as (
    select
      'certification-approval:' || c.id::text as id,
      'certification_approval'::text as task_type,
      'Final certification approval · ' || i.original_file_name as title,
      case when c.rerun_count > 1
        then 'Controlled rerun passed after all findings were resolved. Manager approval will file the immutable audit record.'
        else 'Certification passed processing and requires manager final approval before audit filing.'
      end as description,
      c.status,
      c.status = 'awaiting_manager_approval' as active,
      c.updated_at as occurred_at,
      '/files'::text as destination,
      case when c.status = 'awaiting_manager_approval' then 'Approve and file' else 'View audit record' end as action_label,
      null::uuid as finding_id,
      c.id as case_id,
      'manager'::text as workflow_role,
      false as attention
    from public.certification_workflow_cases c
    join public.certification_import_items i on i.id = c.certification_item_id
    cross join actor
    where private.certification_is_manager(actor.id,c.workspace_user_id)
      and c.status in ('awaiting_manager_approval','approved_filed')
  )
  select * from finding_tasks
  union all
  select * from manager_tasks
  order by active desc, occurred_at desc;
$$;

revoke all on function public.resolve_certification_finding(uuid,text) from public, anon;
revoke all on function public.approve_certification_final(uuid) from public, anon;
revoke all on function public.certification_task_queue() from public, anon;
grant execute on function public.resolve_certification_finding(uuid,text) to authenticated;
grant execute on function public.approve_certification_final(uuid) to authenticated;
grant execute on function public.certification_task_queue() to authenticated;

alter table public.certification_workflow_memberships enable row level security;
alter table public.certification_workflow_cases enable row level security;
alter table public.certification_finding_assignments enable row level security;
alter table public.certification_workflow_events enable row level security;
alter table public.certification_audit_files enable row level security;

revoke all on public.certification_workflow_memberships from anon, authenticated;
revoke all on public.certification_workflow_cases from anon, authenticated;
revoke all on public.certification_finding_assignments from anon, authenticated;
revoke all on public.certification_workflow_events from anon, authenticated;
revoke all on public.certification_audit_files from anon, authenticated;

grant select on public.certification_workflow_memberships to authenticated;
grant select on public.certification_workflow_cases to authenticated;
grant select on public.certification_finding_assignments to authenticated;
grant select on public.certification_workflow_events to authenticated;
grant select on public.certification_audit_files to authenticated;

create policy "participants read certification memberships"
on public.certification_workflow_memberships
for select to authenticated
using (
  workspace_user_id = (select auth.uid())
  or member_user_id = (select auth.uid())
);

create policy "participants read certification cases"
on public.certification_workflow_cases
for select to authenticated
using (private.certification_is_participant((select auth.uid()),workspace_user_id));

create policy "participants read certification finding assignments"
on public.certification_finding_assignments
for select to authenticated
using (
  assigned_to = (select auth.uid())
  or exists (
    select 1 from public.certification_workflow_cases c
    where c.id = certification_finding_assignments.case_id
      and private.certification_is_manager((select auth.uid()),c.workspace_user_id)
  )
);

create policy "participants read certification workflow events"
on public.certification_workflow_events
for select to authenticated
using (
  exists (
    select 1 from public.certification_workflow_cases c
    where c.id = certification_workflow_events.case_id
      and private.certification_is_participant((select auth.uid()),c.workspace_user_id)
  )
);

create policy "participants read certification audit files"
on public.certification_audit_files
for select to authenticated
using (private.certification_is_participant((select auth.uid()),workspace_user_id));

insert into public.certification_workflow_cases(
  certification_item_id,workspace_user_id,status,rerun_count,last_rerun_at
)
select
  i.id,i.user_id,
  case when exists (
    select 1 from public.compliance_findings f
    where f.item_id=i.id and f.status='FAIL' and f.review_state<>'approved'
  ) then 'findings_assigned' else 'awaiting_manager_approval' end,
  1,i.processed_at
from public.certification_import_items i
where i.status='completed'
on conflict (certification_item_id) do nothing;

insert into public.certification_finding_assignments(
  finding_id,case_id,assigned_to,status,resolution_notes,resolved_at,resolved_by
)
select
  f.id,c.id,
  coalesce(private.certification_pick_employee(c.workspace_user_id),c.workspace_user_id),
  case when f.review_state='approved' then 'resolved' else 'assigned' end,
  case when f.review_state='approved' then 'Backfilled from approved finding review' else null end,
  case when f.review_state='approved' then f.updated_at else null end,
  case when f.review_state='approved' then c.workspace_user_id else null end
from public.compliance_findings f
join public.certification_workflow_cases c on c.certification_item_id=f.item_id
where f.status='FAIL'
on conflict (finding_id) do nothing;
