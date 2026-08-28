-- PHA agency-level operational settings and external integration registry.

create table if not exists public.pha_agency_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null unique references auth.users(id) on delete cascade,
  agency_name text,
  agency_code text,
  timezone text not null default 'America/Chicago',
  default_language text not null default 'en',
  notice_delivery_defaults jsonb not null default '{}'::jsonb,
  inspection_contact_email text,
  hud_submission_contact_email text,
  escalation_contact_email text,
  support_mode text not null default 'escalation_only' check (support_mode in ('escalation_only','staff_assisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pha_integration_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null references auth.users(id) on delete cascade,
  integration_type text not null check (integration_type in ('hud_50058_transport','inspection_vendor','email_delivery','document_storage','pms','other')),
  provider_name text not null,
  connection_reference text,
  status text not null default 'not_configured' check (status in ('not_configured','pending','validated','blocked','disabled')),
  validation_snapshot jsonb not null default '{}'::jsonb,
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  last_health_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_user_id,integration_type,provider_name)
);

alter table public.pha_agency_settings enable row level security;
alter table public.pha_integration_profiles enable row level security;
grant select,insert,update on public.pha_agency_settings,public.pha_integration_profiles to authenticated;
grant all on public.pha_agency_settings,public.pha_integration_profiles to service_role;

create policy "PHA users read agency settings" on public.pha_agency_settings for select to authenticated using (workspace_user_id=public.current_pha_workspace_user_id() or public.has_role(auth.uid(),'staff'));
create policy "PHA admins manage agency settings" on public.pha_agency_settings for all to authenticated using (public.pha_workspace_admin_access(workspace_user_id)) with check (public.pha_workspace_admin_access(workspace_user_id));
create policy "PHA users read integration profiles" on public.pha_integration_profiles for select to authenticated using (workspace_user_id=public.current_pha_workspace_user_id() or public.has_role(auth.uid(),'staff'));
create policy "PHA admins manage integration profiles" on public.pha_integration_profiles for all to authenticated using (public.pha_workspace_admin_access(workspace_user_id)) with check (public.pha_workspace_admin_access(workspace_user_id));

create or replace function public.prepare_pha_agency_settings() returns trigger language plpgsql security invoker as $$
begin
 if coalesce(trim(new.timezone),'')='' then raise exception 'Agency timezone is required'; end if;
 if coalesce(trim(new.default_language),'')='' then raise exception 'Default language is required'; end if;
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_agency_settings_prepare before insert or update on public.pha_agency_settings for each row execute function public.prepare_pha_agency_settings();

create or replace function public.prepare_pha_integration_profile() returns trigger language plpgsql security invoker as $$
begin
 if new.status='validated' and (new.validated_by is null or new.validated_at is null or coalesce(trim(new.connection_reference),'')='') then raise exception 'Validated integration requires connection reference and validation record'; end if;
 if new.status in ('blocked','disabled','not_configured') then new.validated_by:=null; new.validated_at:=null; end if;
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_integration_profile_prepare before insert or update on public.pha_integration_profiles for each row execute function public.prepare_pha_integration_profile();
