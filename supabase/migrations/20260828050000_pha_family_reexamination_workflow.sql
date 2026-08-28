-- PHA family/reexamination operational workflow feeding HUD-50058 routing.

create table if not exists public.pha_family_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  family_reference text not null,
  program_code text not null check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  action_type text not null check (action_type in ('admission','annual_reexamination','interim_reexamination','portability','other')),
  effective_date date not null,
  due_date date,
  workflow_status text not null default 'intake' check (workflow_status in ('intake','verification','calculation','notice','ready_to_route','routed','blocked')),
  verification_complete boolean not null default false,
  eiv_review_complete boolean not null default false,
  calculation_complete boolean not null default false,
  notice_complete boolean not null default false,
  program_applicability_validated boolean not null default false,
  controlled_source_release_approved boolean not null default false,
  current_rule_version_validated boolean not null default false,
  source_status_conflict boolean not null default false,
  full_hotma_policy_set_validated boolean not null default false,
  reporting_path_validated boolean not null default false,
  software_compatibility_validated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pha_family_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  family_action_id uuid not null references public.pha_family_actions(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('eiv','income','assets','deductions','identity','citizenship','other')),
  source_label text not null,
  verified boolean not null default false,
  conflict_detected boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.pha_family_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  family_action_id uuid not null references public.pha_family_actions(id) on delete cascade,
  notice_type text not null,
  status text not null default 'draft' check (status in ('draft','ready','issued')),
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.pha_50058_transactions
  add column if not exists source_family_action_id uuid references public.pha_family_actions(id) on delete set null;
create unique index if not exists pha_50058_transactions_source_family_action_uidx
  on public.pha_50058_transactions(source_family_action_id)
  where source_family_action_id is not null;

alter table public.pha_family_actions enable row level security;
alter table public.pha_family_evidence enable row level security;
alter table public.pha_family_notices enable row level security;

create policy "Users manage own PHA family actions" on public.pha_family_actions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own PHA family evidence" on public.pha_family_evidence
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own PHA family notices" on public.pha_family_notices
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.sync_pha_family_action_readiness()
returns trigger language plpgsql security invoker as $$
begin
  if new.workflow_status not in ('routed','blocked') then
    if new.verification_complete
       and new.eiv_review_complete
       and new.calculation_complete
       and new.notice_complete then
      new.workflow_status := 'ready_to_route';
    elsif new.calculation_complete then
      new.workflow_status := 'notice';
    elsif new.verification_complete and new.eiv_review_complete then
      new.workflow_status := 'calculation';
    elsif new.workflow_status <> 'intake' then
      new.workflow_status := 'verification';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger pha_family_action_readiness_before_write
before insert or update on public.pha_family_actions
for each row execute function public.sync_pha_family_action_readiness();

create or replace function public.enqueue_pha_50058_from_family_action()
returns trigger language plpgsql security invoker as $$
begin
  if new.workflow_status = 'ready_to_route' and old.workflow_status is distinct from 'ready_to_route' then
    insert into public.pha_50058_transactions (
      user_id, family_reference, program_code, transaction_type, effective_date,
      program_applicability_validated, controlled_source_release_approved,
      current_rule_version_validated, source_status_conflict,
      full_hotma_policy_set_validated, reporting_path_validated,
      software_compatibility_validated, source_family_action_id
    ) values (
      new.user_id, new.family_reference, new.program_code, new.action_type, new.effective_date,
      new.program_applicability_validated, new.controlled_source_release_approved,
      new.current_rule_version_validated, new.source_status_conflict,
      new.full_hotma_policy_set_validated, new.reporting_path_validated,
      new.software_compatibility_validated, new.id
    ) on conflict (source_family_action_id) where source_family_action_id is not null do nothing;
    new.workflow_status := 'routed';
  end if;
  return new;
end;
$$;

create trigger pha_family_action_enqueue_after_readiness
after insert or update on public.pha_family_actions
for each row when (new.workflow_status = 'ready_to_route')
execute function public.enqueue_pha_50058_from_family_action();
