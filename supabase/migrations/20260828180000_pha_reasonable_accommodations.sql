-- Cross-cutting reasonable-accommodation controls for PHA operations.
-- Grounded in Section 504 / Fair Housing / ADA duties reflected in HUD's HCV Fair Housing guidance.

create table if not exists public.pha_reasonable_accommodation_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  program_code text not null check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  requester_reference text not null,
  family_action_id uuid references public.pha_family_actions(id) on delete set null,
  waiting_list_applicant_id uuid references public.pha_waiting_list_applicants(id) on delete set null,
  inspection_id uuid references public.pha_inspections(id) on delete set null,
  request_context text not null check (request_context in ('application','waiting_list','eligibility','briefing','inspection','leasing','reexamination','termination','hearing','communication','other')),
  requested_accommodation text not null,
  requested_at timestamptz not null default now(),
  status text not null default 'received' check (status in ('received','interactive_process','approved','approved_alternative','denied','withdrawn','completed')),
  disability_verification_required boolean not null default false,
  disability_verification_status text not null default 'not_required' check (disability_verification_status in ('not_required','pending','verified','insufficient')),
  nexus_verification_required boolean not null default false,
  nexus_verification_status text not null default 'not_required' check (nexus_verification_status in ('not_required','pending','verified','insufficient')),
  interactive_process_notes text,
  decision_reason text,
  alternative_accommodation text,
  undue_burden_or_fundamental_alteration boolean not null default false,
  effective_communication_required boolean not null default false,
  communication_format text,
  decision_by uuid references auth.users(id),
  decision_at timestamptz,
  completed_at timestamptz,
  source_authority text not null default 'Section 504 / FHA / ADA; HUD HCV Fair Housing Guidebook',
  source_status text not null default 'current' check (source_status in ('current','pending_source','superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pha_reasonable_accommodation_requests enable row level security;
grant select,insert,update,delete on public.pha_reasonable_accommodation_requests to authenticated;
grant all on public.pha_reasonable_accommodation_requests to service_role;

create policy "PHA users read reasonable accommodations" on public.pha_reasonable_accommodation_requests
for select to authenticated using (public.pha_program_access(workspace_user_id, program_code, false));
create policy "PHA users write reasonable accommodations" on public.pha_reasonable_accommodation_requests
for all to authenticated using (public.pha_program_access(workspace_user_id, program_code, true)) with check (public.pha_program_access(workspace_user_id, program_code, true));

create or replace function public.prepare_pha_reasonable_accommodation()
returns trigger language plpgsql security invoker as $$
begin
  if new.source_status <> 'current' then raise exception 'Current controlled reasonable-accommodation authority is required'; end if;
  if new.status in ('approved','approved_alternative','denied') then
    if new.decision_by is null then new.decision_by := auth.uid(); end if;
    if new.decision_at is null then new.decision_at := now(); end if;
    if new.status='denied' and coalesce(trim(new.decision_reason),'')='' then raise exception 'Denied accommodation requires a documented reason'; end if;
    if new.undue_burden_or_fundamental_alteration and new.status='denied' and coalesce(trim(new.alternative_accommodation),'')='' then raise exception 'Denial based on undue burden or fundamental alteration requires consideration of an effective alternative accommodation'; end if;
  end if;
  if new.effective_communication_required and coalesce(trim(new.communication_format),'')='' then raise exception 'Effective communication format is required'; end if;
  if new.status='completed' and new.completed_at is null then new.completed_at:=now(); end if;
  new.updated_at:=now(); return new;
end;
$$;
create trigger pha_reasonable_accommodation_prepare_before_write before insert or update on public.pha_reasonable_accommodation_requests for each row execute function public.prepare_pha_reasonable_accommodation();

create or replace function public.sync_pha_waiting_list_accommodation_hold()
returns trigger language plpgsql security invoker as $$
begin
  if new.waiting_list_applicant_id is not null then
    update public.pha_waiting_list_applicants
       set reasonable_accommodation_review_required = new.status in ('received','interactive_process'), updated_at=now()
     where id=new.waiting_list_applicant_id;
  end if;
  return null;
end;
$$;
create trigger pha_reasonable_accommodation_waiting_hold_after_write after insert or update on public.pha_reasonable_accommodation_requests for each row execute function public.sync_pha_waiting_list_accommodation_hold();
