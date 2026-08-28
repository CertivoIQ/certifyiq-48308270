-- Replace user-trusted PHA transaction booleans with derived snapshots from authoritative workspace and control state.

create table if not exists public.pha_authoritative_control_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_code text not null check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  source_release_status text not null default 'pending' check (source_release_status in ('pending','approved','blocked')),
  rule_version_status text not null default 'pending' check (rule_version_status in ('pending','current','stale','blocked')),
  hotma_policy_status text not null default 'pending' check (hotma_policy_status in ('pending','validated','blocked','not_applicable')),
  reporting_path_status text not null default 'pending' check (reporting_path_status in ('pending','validated','blocked')),
  software_compatibility_status text not null default 'pending' check (software_compatibility_status in ('pending','validated','blocked')),
  source_status_conflict boolean not null default false,
  source_authority_key text,
  rule_version text,
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, program_code)
);

alter table public.pha_authoritative_control_state enable row level security;

drop policy if exists "PHA users read own authoritative controls" on public.pha_authoritative_control_state;
create policy "PHA users read own authoritative controls"
on public.pha_authoritative_control_state for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Staff manage PHA authoritative controls" on public.pha_authoritative_control_state;
create policy "Staff manage PHA authoritative controls"
on public.pha_authoritative_control_state for all to authenticated
using (public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'staff'));

grant select on public.pha_authoritative_control_state to authenticated;
grant all on public.pha_authoritative_control_state to service_role;

create or replace function public.apply_pha_authoritative_controls()
returns trigger language plpgsql security invoker as $$
declare
  workspace public.customer_workspace_profiles%rowtype;
  control public.pha_authoritative_control_state%rowtype;
  profile_found boolean := false;
  control_found boolean := false;
begin
  select * into workspace
    from public.customer_workspace_profiles
   where user_id = new.user_id;
  profile_found := found;

  select * into control
    from public.pha_authoritative_control_state
   where user_id = new.user_id
     and program_code = new.program_code;
  control_found := found;

  -- Applicability is authoritative only when the account is a PHA and the program is on its workspace profile.
  new.program_applicability_validated := profile_found
    and workspace.organization_type = 'pha'
    and new.program_code = any(workspace.pha_programs);

  -- Source/rule/policy/software flags fail closed when no staff-governed control record exists.
  new.controlled_source_release_approved := control_found and control.source_release_status = 'approved';
  new.current_rule_version_validated := control_found and control.rule_version_status = 'current';
  new.source_status_conflict := control_found and control.source_status_conflict;
  new.full_hotma_policy_set_validated := control_found and control.hotma_policy_status in ('validated','not_applicable');
  new.reporting_path_validated := profile_found
    and workspace.hud_50058_reporting_path is not null
    and control_found
    and control.reporting_path_status = 'validated';
  new.software_compatibility_validated := control_found and control.software_compatibility_status = 'validated';
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pha_family_action_authoritative_controls_before_write on public.pha_family_actions;
create trigger pha_family_action_authoritative_controls_before_write
before insert or update on public.pha_family_actions
for each row execute function public.apply_pha_authoritative_controls();

drop trigger if exists pha_50058_authoritative_controls_before_write on public.pha_50058_transactions;
create trigger pha_50058_authoritative_controls_before_write
before insert or update on public.pha_50058_transactions
for each row execute function public.apply_pha_authoritative_controls();

create or replace function public.refresh_pha_authoritative_control_snapshots(
  target_user_id uuid,
  target_program_code text default null
)
returns void language plpgsql security invoker as $$
begin
  update public.pha_family_actions
     set updated_at = now()
   where user_id = target_user_id
     and (target_program_code is null or program_code = target_program_code);

  update public.pha_50058_transactions
     set updated_at = now()
   where user_id = target_user_id
     and (target_program_code is null or program_code = target_program_code);
end;
$$;

create or replace function public.refresh_pha_authoritative_controls_from_control()
returns trigger language plpgsql security invoker as $$
begin
  perform public.refresh_pha_authoritative_control_snapshots(
    coalesce(new.user_id, old.user_id),
    coalesce(new.program_code, old.program_code)
  );
  return null;
end;
$$;

drop trigger if exists pha_authoritative_control_refresh_after_write on public.pha_authoritative_control_state;
create trigger pha_authoritative_control_refresh_after_write
after insert or update or delete on public.pha_authoritative_control_state
for each row execute function public.refresh_pha_authoritative_controls_from_control();

create or replace function public.refresh_pha_authoritative_controls_from_workspace()
returns trigger language plpgsql security invoker as $$
begin
  perform public.refresh_pha_authoritative_control_snapshots(new.user_id, null);
  return null;
end;
$$;

drop trigger if exists pha_workspace_control_refresh_after_write on public.customer_workspace_profiles;
create trigger pha_workspace_control_refresh_after_write
after insert or update of organization_type, pha_programs, hud_50058_reporting_path on public.customer_workspace_profiles
for each row execute function public.refresh_pha_authoritative_controls_from_workspace();

-- Recompute all existing PHA family and HUD-50058 snapshots. Missing control records intentionally fail closed.
do $$
declare r record;
begin
  for r in select distinct user_id from public.pha_family_actions
           union
           select distinct user_id from public.pha_50058_transactions loop
    perform public.refresh_pha_authoritative_control_snapshots(r.user_id, null);
  end loop;
end;
$$;
