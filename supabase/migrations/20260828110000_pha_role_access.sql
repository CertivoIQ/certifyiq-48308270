-- PHA agency membership and role-based access. This extends tenant isolation from a single account owner
-- to authorized agency staff while keeping write capabilities program-scoped.

create table if not exists public.pha_workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  agency_role text not null check (agency_role in (
    'executive','agency_admin','compliance_admin','hcv_pbv_specialist','public_housing_specialist','inspection_staff'
  )),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_user_id, member_user_id)
);

alter table public.pha_workspace_memberships enable row level security;
grant select, insert, update, delete on public.pha_workspace_memberships to authenticated;
grant all on public.pha_workspace_memberships to service_role;

drop policy if exists "PHA owners manage memberships" on public.pha_workspace_memberships;
create policy "PHA owners manage memberships" on public.pha_workspace_memberships
for all to authenticated
using (workspace_user_id = auth.uid())
with check (
  workspace_user_id = auth.uid()
  and exists (
    select 1 from public.customer_workspace_profiles p
    where p.user_id = auth.uid() and p.organization_type = 'pha'
  )
);

drop policy if exists "PHA members read own membership" on public.pha_workspace_memberships;
create policy "PHA members read own membership" on public.pha_workspace_memberships
for select to authenticated using (member_user_id = auth.uid());

drop policy if exists "Staff manage PHA memberships" on public.pha_workspace_memberships;
create policy "Staff manage PHA memberships" on public.pha_workspace_memberships
for all to authenticated
using (public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'staff'));

create or replace function public.current_pha_workspace_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.user_id from public.customer_workspace_profiles p
      where p.user_id = auth.uid() and p.organization_type = 'pha' limit 1),
    (select m.workspace_user_id from public.pha_workspace_memberships m
      where m.member_user_id = auth.uid() and m.active = true
      order by m.created_at asc limit 1),
    auth.uid()
  )
$$;

create or replace function public.pha_program_access(
  target_workspace_user_id uuid,
  target_program_code text,
  write_access boolean default false
)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() = target_workspace_user_id then true
    when public.has_role(auth.uid(), 'staff') then true
    else exists (
      select 1 from public.pha_workspace_memberships m
       where m.workspace_user_id = target_workspace_user_id
         and m.member_user_id = auth.uid()
         and m.active = true
         and (
           (m.agency_role in ('agency_admin','compliance_admin'))
           or (write_access = false and m.agency_role = 'executive')
           or (m.agency_role = 'hcv_pbv_specialist' and target_program_code in ('hcv','pbv','mod_rehab'))
           or (m.agency_role = 'public_housing_specialist' and target_program_code = 'public_housing')
         )
    )
  end
$$;

create or replace function public.pha_family_access(target_family_action_id uuid, write_access boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pha_family_actions a
     where a.id = target_family_action_id
       and public.pha_program_access(a.user_id, a.program_code, write_access)
  )
$$;

-- PHA members may resolve their agency's workspace profile without owning the profile row.
drop policy if exists "PHA members view workspace profile" on public.customer_workspace_profiles;
create policy "PHA members view workspace profile" on public.customer_workspace_profiles
for select to authenticated
using (
  exists (
    select 1 from public.pha_workspace_memberships m
     where m.workspace_user_id = customer_workspace_profiles.user_id
       and m.member_user_id = auth.uid()
       and m.active = true
  )
);

-- New PHA records automatically bind to the effective agency workspace rather than the signed-in member.
alter table public.pha_family_actions alter column user_id set default public.current_pha_workspace_user_id();
alter table public.pha_family_evidence alter column user_id set default public.current_pha_workspace_user_id();
alter table public.pha_family_notices alter column user_id set default public.current_pha_workspace_user_id();
alter table public.pha_family_calculations alter column user_id set default public.current_pha_workspace_user_id();
alter table public.pha_family_eiv_exceptions alter column user_id set default public.current_pha_workspace_user_id();
alter table public.pha_50058_transactions alter column user_id set default public.current_pha_workspace_user_id();

-- Family actions: executives are read-only; specialists are scoped to their administered program families.
drop policy if exists "Users manage own PHA family actions" on public.pha_family_actions;
drop policy if exists "PHA family actions read" on public.pha_family_actions;
drop policy if exists "PHA family actions insert" on public.pha_family_actions;
drop policy if exists "PHA family actions update" on public.pha_family_actions;
drop policy if exists "PHA family actions delete" on public.pha_family_actions;
create policy "PHA family actions read" on public.pha_family_actions for select to authenticated
using (public.pha_program_access(user_id, program_code, false));
create policy "PHA family actions insert" on public.pha_family_actions for insert to authenticated
with check (public.pha_program_access(user_id, program_code, true));
create policy "PHA family actions update" on public.pha_family_actions for update to authenticated
using (public.pha_program_access(user_id, program_code, true)) with check (public.pha_program_access(user_id, program_code, true));
create policy "PHA family actions delete" on public.pha_family_actions for delete to authenticated
using (public.pha_program_access(user_id, program_code, true));

-- Evidence and notices inherit access from their family action.
drop policy if exists "Users manage own PHA family evidence" on public.pha_family_evidence;
drop policy if exists "PHA family evidence read" on public.pha_family_evidence;
drop policy if exists "PHA family evidence write" on public.pha_family_evidence;
create policy "PHA family evidence read" on public.pha_family_evidence for select to authenticated
using (public.pha_family_access(family_action_id, false));
create policy "PHA family evidence write" on public.pha_family_evidence for all to authenticated
using (public.pha_family_access(family_action_id, true)) with check (public.pha_family_access(family_action_id, true));

drop policy if exists "Users manage own PHA family notices" on public.pha_family_notices;
drop policy if exists "PHA family notices read" on public.pha_family_notices;
drop policy if exists "PHA family notices write" on public.pha_family_notices;
create policy "PHA family notices read" on public.pha_family_notices for select to authenticated
using (public.pha_family_access(family_action_id, false));
create policy "PHA family notices write" on public.pha_family_notices for all to authenticated
using (public.pha_family_access(family_action_id, true)) with check (public.pha_family_access(family_action_id, true));

-- Calculations and HUD-50058 transactions are program-scoped.
drop policy if exists "Users manage own PHA family calculations" on public.pha_family_calculations;
drop policy if exists "PHA family calculations read" on public.pha_family_calculations;
drop policy if exists "PHA family calculations write" on public.pha_family_calculations;
create policy "PHA family calculations read" on public.pha_family_calculations for select to authenticated
using (public.pha_program_access(user_id, program_code, false));
create policy "PHA family calculations write" on public.pha_family_calculations for all to authenticated
using (public.pha_program_access(user_id, program_code, true)) with check (public.pha_program_access(user_id, program_code, true));

drop policy if exists "Users manage own PHA 50058 transactions" on public.pha_50058_transactions;
drop policy if exists "PHA 50058 transactions read" on public.pha_50058_transactions;
drop policy if exists "PHA 50058 transactions write" on public.pha_50058_transactions;
create policy "PHA 50058 transactions read" on public.pha_50058_transactions for select to authenticated
using (public.pha_program_access(user_id, program_code, false));
create policy "PHA 50058 transactions write" on public.pha_50058_transactions for all to authenticated
using (public.pha_program_access(user_id, program_code, true)) with check (public.pha_program_access(user_id, program_code, true));

-- EIV exceptions inherit family access. Inspection staff intentionally receive no family/EIV access here.
drop policy if exists "Users manage own PHA EIV exceptions" on public.pha_family_eiv_exceptions;
drop policy if exists "PHA EIV exceptions read" on public.pha_family_eiv_exceptions;
drop policy if exists "PHA EIV exceptions write" on public.pha_family_eiv_exceptions;
create policy "PHA EIV exceptions read" on public.pha_family_eiv_exceptions for select to authenticated
using (public.pha_family_access(family_action_id, false));
create policy "PHA EIV exceptions write" on public.pha_family_eiv_exceptions for all to authenticated
using (public.pha_family_access(family_action_id, true)) with check (public.pha_family_access(family_action_id, true));
