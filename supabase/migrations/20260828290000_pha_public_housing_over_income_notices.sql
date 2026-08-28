-- Public Housing HOTMA Section 103 over-income notice and post-24-month controls.
-- Authority verified against eCFR 24 CFR 960.507 and 960.509, current through 2026-08-25.

create table if not exists public.pha_public_housing_over_income_notices (
  id uuid primary key default gen_random_uuid(),
  over_income_case_id uuid not null references public.pha_public_housing_over_income_cases(id) on delete cascade,
  notice_stage text not null check (notice_stage in ('initial','twelve_month','twenty_four_month')),
  income_examination_date date not null,
  notice_due_date date not null,
  notice_issued_at timestamptz,
  hearing_right_included boolean not null default false,
  alternative_rent_estimate numeric(12,2),
  post_24_action text check (post_24_action in ('terminate','alternative_non_public_housing_rent')),
  planned_termination_date date,
  state_local_termination_notice_reference text,
  lease_presented boolean not null default false,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(over_income_case_id, notice_stage)
);

create table if not exists public.pha_public_housing_non_public_leases (
  id uuid primary key default gen_random_uuid(),
  over_income_case_id uuid not null unique references public.pha_public_housing_over_income_cases(id) on delete cascade,
  twenty_four_month_notice_id uuid not null unique references public.pha_public_housing_over_income_notices(id) on delete cascade,
  lease_presented_at timestamptz not null,
  next_lease_renewal_date date,
  execution_due_date date not null,
  executed_at date,
  alternative_non_public_housing_rent numeric(12,2) not null check (alternative_non_public_housing_rent >= 0),
  prior_public_housing_rent numeric(12,2) not null check (prior_public_housing_rent >= 0),
  required_provisions_confirmed boolean not null default false,
  late_execution_allowed_by_policy boolean not null default false,
  retroactive_difference_due numeric(12,2) not null default 0 check (retroactive_difference_due >= 0),
  tenancy_termination_deadline date,
  status text not null default 'presented' check (status in ('presented','executed','late_execution_pending','termination_required','closed')),
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pha_public_housing_over_income_notices enable row level security;
alter table public.pha_public_housing_non_public_leases enable row level security;
grant select,insert,update on public.pha_public_housing_over_income_notices,public.pha_public_housing_non_public_leases to authenticated;
grant all on public.pha_public_housing_over_income_notices,public.pha_public_housing_non_public_leases to service_role;

create policy "PHA PH users read over income notices" on public.pha_public_housing_over_income_notices for select to authenticated using (
 exists(select 1 from public.pha_public_housing_over_income_cases c where c.id=over_income_case_id and public.pha_program_access(c.workspace_user_id,'public_housing',false))
);
create policy "PHA PH users manage over income notices" on public.pha_public_housing_over_income_notices for all to authenticated using (
 exists(select 1 from public.pha_public_housing_over_income_cases c where c.id=over_income_case_id and public.pha_program_access(c.workspace_user_id,'public_housing',true))
) with check (
 exists(select 1 from public.pha_public_housing_over_income_cases c where c.id=over_income_case_id and public.pha_program_access(c.workspace_user_id,'public_housing',true))
);
create policy "PHA PH users read non public leases" on public.pha_public_housing_non_public_leases for select to authenticated using (
 exists(select 1 from public.pha_public_housing_over_income_cases c where c.id=over_income_case_id and public.pha_program_access(c.workspace_user_id,'public_housing',false))
);
create policy "PHA PH users manage non public leases" on public.pha_public_housing_non_public_leases for all to authenticated using (
 exists(select 1 from public.pha_public_housing_over_income_cases c where c.id=over_income_case_id and public.pha_program_access(c.workspace_user_id,'public_housing',true))
) with check (
 exists(select 1 from public.pha_public_housing_over_income_cases c where c.id=over_income_case_id and public.pha_program_access(c.workspace_user_id,'public_housing',true))
);

create or replace function public.prepare_pha_ph_over_income_notice() returns trigger language plpgsql security invoker as $$
declare c public.pha_public_housing_over_income_cases%rowtype;
begin
 select * into c from public.pha_public_housing_over_income_cases where id=new.over_income_case_id;
 if not found then raise exception 'Public Housing over-income case not found'; end if;
 perform public.assert_pha_policy_overlay(c.acop_overlay_id,c.workspace_user_id,'public_housing','acop');
 new.notice_due_date:=new.income_examination_date + 30;
 new.hearing_right_included:=coalesce(new.hearing_right_included,false);
 if new.notice_issued_at is not null and new.notice_issued_at::date > new.notice_due_date then
   raise exception 'Public Housing over-income notice exceeds the 30-day federal notice deadline';
 end if;
 if new.notice_issued_at is not null and not new.hearing_right_included then
   raise exception 'Issued Public Housing over-income notice must include the Part 966 hearing right';
 end if;
 if new.notice_stage='twelve_month' and c.pha_post_24_policy='alternative_non_public_housing_rent' and new.alternative_rent_estimate is null then
   raise exception '12-month notice requires an alternative non-public housing rent estimate when applicable under PHA policy';
 end if;
 if new.notice_stage='twenty_four_month' then
   if c.pha_post_24_policy is null then raise exception '24-month notice requires the validated ACOP post-24-month action'; end if;
   new.post_24_action:=c.pha_post_24_policy;
   if new.post_24_action='terminate' then
     if new.planned_termination_date is null then raise exception 'Termination route requires the period before tenancy termination'; end if;
     if new.planned_termination_date > new.income_examination_date + interval '7 months' then raise exception 'Termination date cannot exceed six months after the 24-month notice window'; end if;
     if coalesce(trim(new.state_local_termination_notice_reference),'')='' then raise exception 'Termination route requires State/local notice-to-vacate authority reference'; end if;
   else
     if not new.lease_presented then raise exception 'Alternative-rent route requires the new non-public housing lease to be presented with the 24-month notice'; end if;
   end if;
 end if;
 new.source_snapshot:=jsonb_build_object('authority','24 CFR 960.507','notice_stage',new.notice_stage,'income_examination_date',new.income_examination_date,'notice_due_date',new.notice_due_date,'post_24_action',new.post_24_action);
 new.updated_at:=now(); return new;
end; $$;
drop trigger if exists pha_ph_over_income_notice_prepare on public.pha_public_housing_over_income_notices;
create trigger pha_ph_over_income_notice_prepare before insert or update on public.pha_public_housing_over_income_notices for each row execute function public.prepare_pha_ph_over_income_notice();

create or replace function public.prepare_pha_ph_non_public_lease() returns trigger language plpgsql security invoker as $$
declare c public.pha_public_housing_over_income_cases%rowtype; n public.pha_public_housing_over_income_notices%rowtype; federal_due date;
begin
 select * into c from public.pha_public_housing_over_income_cases where id=new.over_income_case_id;
 if not found then raise exception 'Public Housing over-income case not found'; end if;
 perform public.assert_pha_policy_overlay(c.acop_overlay_id,c.workspace_user_id,'public_housing','acop');
 if c.pha_post_24_policy<>'alternative_non_public_housing_rent' then raise exception 'Non-public housing lease is only valid for the ACOP alternative-rent route'; end if;
 select * into n from public.pha_public_housing_over_income_notices where id=new.twenty_four_month_notice_id and over_income_case_id=c.id and notice_stage='twenty_four_month';
 if not found or n.notice_issued_at is null then raise exception 'Issued 24-month over-income notice is required before the non-public housing lease'; end if;
 federal_due:=(n.notice_issued_at::date + 60);
 if new.next_lease_renewal_date is not null and new.next_lease_renewal_date < federal_due then federal_due:=new.next_lease_renewal_date; end if;
 new.execution_due_date:=federal_due;
 new.tenancy_termination_deadline:=n.notice_issued_at::date + interval '6 months';
 if not new.required_provisions_confirmed then raise exception '24 CFR 960.509 minimum lease provisions must be confirmed'; end if;
 if new.executed_at is not null then
   if new.executed_at <= new.execution_due_date then new.status:='executed';
   elsif new.late_execution_allowed_by_policy then
     if new.retroactive_difference_due <= 0 then raise exception 'Late lease execution requires the retroactive alternative-rent difference due'; end if;
     if new.executed_at > new.tenancy_termination_deadline then raise exception 'Late lease execution cannot occur after the federal tenancy-termination deadline'; end if;
     new.status:='executed';
   else raise exception 'Lease executed after federal deadline without validated PHA late-execution policy'; end if;
 elsif current_date > new.execution_due_date then
   new.status:=case when new.late_execution_allowed_by_policy then 'late_execution_pending' else 'termination_required' end;
 end if;
 new.source_snapshot:=jsonb_build_object('authority','24 CFR 960.509','notice_id',n.id,'notice_date',n.notice_issued_at::date,'execution_due_date',new.execution_due_date,'termination_deadline',new.tenancy_termination_deadline);
 new.updated_at:=now(); return new;
end; $$;
drop trigger if exists pha_ph_non_public_lease_prepare on public.pha_public_housing_non_public_leases;
create trigger pha_ph_non_public_lease_prepare before insert or update on public.pha_public_housing_non_public_leases for each row execute function public.prepare_pha_ph_non_public_lease();
