-- PHA controlled source library and forms/notices registry.

create table if not exists public.pha_source_library (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid references auth.users(id) on delete cascade,
  source_scope text not null check (source_scope in ('federal','agency')),
  program_code text check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  authority_key text not null,
  source_type text not null check (source_type in ('regulation','notice','form','instruction','handbook','administrative_plan','acop','mod_rehab_policy','agency_form','other')),
  title text not null,
  issuing_authority text not null,
  source_reference text not null,
  effective_date date,
  version_label text,
  checksum text,
  status text not null default 'pending' check (status in ('pending','current','superseded','blocked')),
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((source_scope='federal' and workspace_user_id is null) or (source_scope='agency' and workspace_user_id is not null))
);
create unique index if not exists pha_source_library_version_uidx on public.pha_source_library(source_scope,coalesce(workspace_user_id,'00000000-0000-0000-0000-000000000000'::uuid),authority_key,coalesce(version_label,''));

create table if not exists public.pha_controlled_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  program_code text not null check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  template_key text not null,
  template_type text not null check (template_type in ('notice','form','letter','checklist')),
  title text not null,
  source_library_id uuid not null references public.pha_source_library(id),
  policy_overlay_id uuid references public.pha_notice_policy_overlays(id),
  version_label text not null,
  status text not null default 'draft' check (status in ('draft','validated','retired','blocked')),
  required_fields text[] not null default '{}',
  body_schema jsonb not null default '{}'::jsonb,
  validated_by uuid references auth.users(id), validated_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_user_id,program_code,template_key,version_label)
);

alter table public.pha_source_library enable row level security;
alter table public.pha_controlled_templates enable row level security;
grant select,insert,update,delete on public.pha_source_library,public.pha_controlled_templates to authenticated;
grant all on public.pha_source_library,public.pha_controlled_templates to service_role;

create policy "PHA users read applicable source library" on public.pha_source_library for select to authenticated using (source_scope='federal' or workspace_user_id=public.current_pha_workspace_user_id() or public.has_role(auth.uid(),'staff'));
create policy "Staff manage federal source library" on public.pha_source_library for all to authenticated using (source_scope='federal' and public.has_role(auth.uid(),'staff')) with check (source_scope='federal' and public.has_role(auth.uid(),'staff'));
create policy "PHA admins manage agency source library" on public.pha_source_library for all to authenticated using (source_scope='agency' and public.pha_workspace_admin_access(workspace_user_id)) with check (source_scope='agency' and public.pha_workspace_admin_access(workspace_user_id));
create policy "PHA users read controlled templates" on public.pha_controlled_templates for select to authenticated using (public.pha_program_access(workspace_user_id,program_code,false));
create policy "PHA admins manage controlled templates" on public.pha_controlled_templates for all to authenticated using (public.pha_workspace_admin_access(workspace_user_id)) with check (public.pha_workspace_admin_access(workspace_user_id));

create or replace function public.prepare_pha_source_library() returns trigger language plpgsql security invoker as $$
begin
 if new.source_scope='federal' and not public.has_role(auth.uid(),'staff') then raise exception 'Federal controlled sources are staff-governed'; end if;
 if new.status='current' and (coalesce(trim(new.source_reference),'')='' or new.validated_by is null or new.validated_at is null) then raise exception 'Current source requires reference and validation record'; end if;
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_source_library_prepare before insert or update on public.pha_source_library for each row execute function public.prepare_pha_source_library();

create or replace function public.prepare_pha_controlled_template() returns trigger language plpgsql security invoker as $$
declare s public.pha_source_library%rowtype; p public.pha_notice_policy_overlays%rowtype;
begin
 select * into s from public.pha_source_library where id=new.source_library_id;
 if not found or s.status <> 'current' then raise exception 'Controlled template requires a current source-library record'; end if;
 if s.program_code is not null and s.program_code <> new.program_code then raise exception 'Template program does not match controlled source'; end if;
 if s.source_scope='agency' and s.workspace_user_id <> new.workspace_user_id then raise exception 'Agency source belongs to a different PHA workspace'; end if;
 if new.policy_overlay_id is not null then
   select * into p from public.pha_notice_policy_overlays where id=new.policy_overlay_id and workspace_user_id=new.workspace_user_id and program_code=new.program_code and active=true and validated=true;
   if not found then raise exception 'Controlled template policy overlay must be active and validated'; end if;
 end if;
 if new.status='validated' and (new.validated_by is null or new.validated_at is null) then raise exception 'Validated template requires validator and timestamp'; end if;
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_controlled_template_prepare before insert or update on public.pha_controlled_templates for each row execute function public.prepare_pha_controlled_template();
