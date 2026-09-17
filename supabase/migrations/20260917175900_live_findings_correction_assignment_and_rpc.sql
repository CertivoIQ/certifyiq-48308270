-- Every actionable certification finding should surface as an assigned correction task,
-- including FAIL and UNABLE_TO_DETERMINE outcomes. Resolution remains explicit and
-- auditable; nothing is closed automatically.
create or replace function private.ensure_certification_finding_assignment_for_row()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_case public.certification_workflow_cases%rowtype;
  v_review_state text:=lower(coalesce(new.review_state,''));
  v_status text:=upper(coalesce(new.status,''));
begin
  if new.item_id is null then return new; end if;
  if v_review_state in ('approved','resolved','closed','accepted') then return new; end if;
  if v_status not in ('FAIL','UNABLE_TO_DETERMINE','UNABLE TO DETERMINE') then return new; end if;

  select * into v_case
  from public.certification_workflow_cases c
  where c.certification_item_id=new.item_id
  order by c.created_at desc,c.id desc
  limit 1;

  if v_case.id is not null then
    insert into public.certification_finding_assignments(
      finding_id,case_id,assigned_to,status,assigned_at,updated_at
    ) values(
      new.id,v_case.id,v_case.workspace_user_id,'assigned',now(),now()
    ) on conflict (finding_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.ensure_case_findings_assigned()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.certification_finding_assignments(
    finding_id,case_id,assigned_to,status,assigned_at,updated_at
  )
  select f.id,new.id,new.workspace_user_id,'assigned',now(),now()
  from public.compliance_findings f
  where f.item_id=new.certification_item_id
    and lower(coalesce(f.review_state,'')) not in ('approved','resolved','closed','accepted')
    and upper(coalesce(f.status,'')) in ('FAIL','UNABLE_TO_DETERMINE','UNABLE TO DETERMINE')
  on conflict (finding_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_certification_finding_assignment on public.compliance_findings;
create trigger ensure_certification_finding_assignment
after insert or update of status,review_state,item_id on public.compliance_findings
for each row execute function private.ensure_certification_finding_assignment_for_row();

drop trigger if exists ensure_case_findings_assigned on public.certification_workflow_cases;
create trigger ensure_case_findings_assigned
after insert or update of certification_item_id,workspace_user_id on public.certification_workflow_cases
for each row execute function private.ensure_case_findings_assigned();

-- Backfill actionable findings created before these triggers existed.
insert into public.certification_finding_assignments(
  finding_id,case_id,assigned_to,status,assigned_at,updated_at
)
select f.id,c.id,c.workspace_user_id,'assigned',now(),now()
from public.compliance_findings f
join lateral (
  select c1.*
  from public.certification_workflow_cases c1
  where c1.certification_item_id=f.item_id
  order by c1.created_at desc,c1.id desc
  limit 1
) c on true
where lower(coalesce(f.review_state,'')) not in ('approved','resolved','closed','accepted')
  and upper(coalesce(f.status,'')) in ('FAIL','UNABLE_TO_DETERMINE','UNABLE TO DETERMINE')
on conflict (finding_id) do nothing;

-- Authenticated users call the public wrapper; the private implementation still
-- enforces assignment/manager authority, review history, and controlled rerun logic.
alter function public.resolve_certification_finding(uuid,text) security definer;
revoke all on function public.resolve_certification_finding(uuid,text) from public,anon;
grant execute on function public.resolve_certification_finding(uuid,text) to authenticated;

comment on function public.resolve_certification_finding(uuid,text) is
'Authenticated correction-resolution entrypoint. The private implementation continues to enforce auth.uid(), assignment/manager authority, review audit history, and rerun workflow controls.';
