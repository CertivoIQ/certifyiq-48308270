-- Approved CertivoIQ workspace architecture: organization type, layered programs,
-- and derived regulatory overlays. HOTMA is derived; it is never selected as a program.

create table if not exists public.customer_workspace_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_type text not null default 'multifamily_owner_agent'
    check (organization_type in (
      'multifamily_owner_agent', 'pha', 'developer_owner',
      'compliance_asset_management', 'housing_agency', 'other'
    )),
  selected_programs text[] not null default '{}',
  pha_programs text[] not null default '{}',
  derived_overlays text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customer_workspace_profiles is
  'Controls role-appropriate CertivoIQ workspace routing. Regulatory overlays such as HOTMA are derived from selected programs.';

create table if not exists public.property_program_applicability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id text not null,
  program_code text not null,
  coverage_level text not null default 'property'
    check (coverage_level in ('property', 'building', 'unit')),
  building_id text,
  unit_id text,
  effective_from date,
  effective_to date,
  source_note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (coverage_level = 'property' and building_id is null and unit_id is null) or
    (coverage_level = 'building' and building_id is not null and unit_id is null) or
    (coverage_level = 'unit' and unit_id is not null)
  )
);

create index if not exists property_program_applicability_user_idx
  on public.property_program_applicability(user_id);
create index if not exists property_program_applicability_property_idx
  on public.property_program_applicability(user_id, property_id);
create index if not exists property_program_applicability_program_idx
  on public.property_program_applicability(user_id, program_code);

alter table public.customer_workspace_profiles enable row level security;
alter table public.property_program_applicability enable row level security;

grant select, insert, update on public.customer_workspace_profiles to authenticated;
grant select, insert, update, delete on public.property_program_applicability to authenticated;
grant all on public.customer_workspace_profiles to service_role;
grant all on public.property_program_applicability to service_role;

drop policy if exists "Users manage own workspace profile" on public.customer_workspace_profiles;
create policy "Users manage own workspace profile"
  on public.customer_workspace_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Staff view workspace profiles" on public.customer_workspace_profiles;
create policy "Staff view workspace profiles"
  on public.customer_workspace_profiles for select to authenticated
  using (public.has_role(auth.uid(), 'staff'));

drop policy if exists "Users manage own property program applicability" on public.property_program_applicability;
create policy "Users manage own property program applicability"
  on public.property_program_applicability for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and created_by = auth.uid());

drop policy if exists "Staff view property program applicability" on public.property_program_applicability;
create policy "Staff view property program applicability"
  on public.property_program_applicability for select to authenticated
  using (public.has_role(auth.uid(), 'staff'));

create or replace function public.derive_workspace_overlays(programs text[], pha_programs text[] default '{}')
returns text[] language sql immutable as $$
  select array_remove(array[
    case when programs && array['section8_pbra','section202_8','section202_811_prac','section811_pra','sprac']::text[]
           or pha_programs && array['hcv','pbv','public_housing','mod_rehab']::text[]
      then 'hotma_102_104' end,
    case when pha_programs && array['public_housing']::text[] then 'hotma_103' end,
    case when programs && array['section8_pbra','section202_8','section202_811_prac','section811_pra','sprac']::text[]
      then 'hud_multifamily' end,
    case when programs && array['section8_pbra','section202_8','section202_811_prac','section811_pra','sprac']::text[]
      then 'tracs' end,
    case when programs && array['lihtc']::text[] then 'state_lihtc' end
  ], null);
$$;

create or replace function public.sync_workspace_overlays()
returns trigger language plpgsql as $$
begin
  new.derived_overlays := public.derive_workspace_overlays(new.selected_programs, new.pha_programs);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_workspace_profiles_derive_overlays on public.customer_workspace_profiles;
create trigger customer_workspace_profiles_derive_overlays
before insert or update of selected_programs, pha_programs, organization_type
on public.customer_workspace_profiles
for each row execute function public.sync_workspace_overlays();
