-- Additive, account-scoped storage. No existing certification/property rows are changed.
create table public.income_calculator_rule_profiles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 property_id uuid not null references public.portfolio_properties(id),
 unit_id uuid references public.portfolio_units(id),
 program_code text not null check (length(program_code) between 1 and 80),
 profile jsonb not null check (jsonb_typeof(profile)='object'),
 approval jsonb not null check (jsonb_typeof(approval)='object'),
 content_hash text not null default '',
 created_at timestamptz not null default clock_timestamp()
);
create index income_calculator_profiles_scope on public.income_calculator_rule_profiles(user_id,property_id,unit_id,program_code,created_at desc);
create index income_calculator_profiles_property on public.income_calculator_rule_profiles(property_id);
create index income_calculator_profiles_unit on public.income_calculator_rule_profiles(unit_id);
create table public.income_calculator_snapshots (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 property_id uuid not null references public.portfolio_properties(id),
 unit_id uuid not null references public.portfolio_units(id),
 tenant_profile_id uuid not null references public.portfolio_tenant_profiles(id),
 inputs jsonb not null check (jsonb_typeof(inputs)='object'),
 rule_profiles jsonb not null check (jsonb_typeof(rule_profiles)='array'),
 calculation jsonb not null check (jsonb_typeof(calculation)='object' and calculation->>'status'='Pending Final Review'),
 document_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(document_refs)='array'),
 engine_version text not null,
 content_hash text not null default '',
 created_at timestamptz not null default clock_timestamp()
);
create index income_calculator_snapshots_household on public.income_calculator_snapshots(user_id,tenant_profile_id,created_at desc);
create index income_calculator_snapshots_tenant on public.income_calculator_snapshots(tenant_profile_id);
create index income_calculator_snapshots_property on public.income_calculator_snapshots(property_id);
create index income_calculator_snapshots_unit on public.income_calculator_snapshots(unit_id);
create table public.income_calculator_reviews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 snapshot_id uuid not null unique references public.income_calculator_snapshots(id),
 snapshot_hash text not null,
 responsible_name text not null check (length(trim(responsible_name)) between 1 and 240),
 responsible_position text not null check (length(trim(responsible_position)) between 1 and 240),
 signature text not null check (length(trim(signature)) between 1 and 500),
 reviewed_at timestamptz not null default clock_timestamp()
);
create index income_calculator_reviews_user on public.income_calculator_reviews(user_id);

alter table public.income_calculator_rule_profiles enable row level security;
alter table public.income_calculator_snapshots enable row level security;
alter table public.income_calculator_reviews enable row level security;
revoke all on public.income_calculator_rule_profiles, public.income_calculator_snapshots, public.income_calculator_reviews from public, anon, authenticated, service_role;
grant select on public.income_calculator_rule_profiles, public.income_calculator_snapshots, public.income_calculator_reviews to authenticated;
grant select, insert on public.income_calculator_rule_profiles, public.income_calculator_snapshots, public.income_calculator_reviews to service_role;
create policy income_profiles_read_own on public.income_calculator_rule_profiles for select to authenticated using ((select auth.uid())=user_id);
create policy income_snapshots_read_own on public.income_calculator_snapshots for select to authenticated using ((select auth.uid())=user_id);
create policy income_reviews_read_own on public.income_calculator_reviews for select to authenticated using ((select auth.uid())=user_id);

create function public.income_calculator_guard() returns trigger language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid; related_property uuid; related_unit uuid; snapshot public.income_calculator_snapshots;
begin
 if TG_OP <> 'INSERT' then raise exception 'Income calculator audit records are immutable; save a new version.'; end if;
 if TG_TABLE_NAME='income_calculator_rule_profiles' then
   select p.user_id into owner_id from public.portfolio_properties p where p.id=new.property_id;
   if owner_id is distinct from new.user_id then raise exception 'Property owner mismatch.'; end if;
   if new.unit_id is not null then
     select u.property_id,u.user_id into related_property,owner_id from public.portfolio_units u where u.id=new.unit_id;
     if related_property is distinct from new.property_id or owner_id is distinct from new.user_id then raise exception 'Unit scope mismatch.'; end if;
   end if;
   if new.profile->>'program' is distinct from new.program_code or coalesce(trim(new.approval->>'name'),'')='' or coalesce(trim(new.approval->>'position'),'')='' or coalesce(trim(new.approval->>'signature'),'')='' or new.approval->>'consent' is distinct from 'true' then raise exception 'Signed property profile approval required.'; end if;
   new.created_at=clock_timestamp();
   new.content_hash=encode(extensions.digest(convert_to(jsonb_build_object('id',new.id,'userId',new.user_id,'propertyId',new.property_id,'unitId',new.unit_id,'profile',new.profile,'approval',new.approval,'createdAt',new.created_at)::text,'UTF8'),'sha256'),'hex');
 elsif TG_TABLE_NAME='income_calculator_snapshots' then
   select t.user_id,t.property_id,t.unit_id into owner_id,related_property,related_unit from public.portfolio_tenant_profiles t where t.id=new.tenant_profile_id;
   if owner_id is distinct from new.user_id or related_property is distinct from new.property_id or related_unit is distinct from new.unit_id then raise exception 'Household scope mismatch.'; end if;
   if new.inputs->>'tenantId' is distinct from new.tenant_profile_id::text or new.inputs->>'propertyId' is distinct from new.property_id::text or new.inputs->>'unitId' is distinct from new.unit_id::text or new.calculation->>'engineVersion' is distinct from new.engine_version then raise exception 'Calculator snapshot metadata mismatch.'; end if;
   new.created_at=clock_timestamp();
   new.content_hash=encode(extensions.digest(convert_to(jsonb_build_object('id',new.id,'userId',new.user_id,'propertyId',new.property_id,'unitId',new.unit_id,'tenantId',new.tenant_profile_id,'inputs',new.inputs,'profiles',new.rule_profiles,'calculation',new.calculation,'documents',new.document_refs,'engineVersion',new.engine_version,'createdAt',new.created_at)::text,'UTF8'),'sha256'),'hex');
 else
   select * into snapshot from public.income_calculator_snapshots s where s.id=new.snapshot_id;
   if snapshot.id is null or snapshot.user_id is distinct from new.user_id or snapshot.content_hash is distinct from new.snapshot_hash then raise exception 'Review snapshot mismatch.'; end if;
   if snapshot.calculation->>'reviewable' is distinct from 'true' or jsonb_typeof(snapshot.calculation->'results') is distinct from 'array' or jsonb_array_length(snapshot.calculation->'results')=0 or exists(select 1 from jsonb_array_elements(snapshot.calculation->'results') r where coalesce(r->>'comparison','') not in ('ABOVE_LIMIT','AT_OR_BELOW_LIMIT') or jsonb_typeof(r->'issues') is distinct from 'array' or jsonb_array_length(r->'issues')<>0) then raise exception 'Unresolved calculations cannot receive final review.'; end if;
   new.reviewed_at=clock_timestamp();
 end if;
 return new;
end $$;
revoke all on function public.income_calculator_guard() from public, anon, authenticated;
create trigger income_profiles_guard before insert or update or delete on public.income_calculator_rule_profiles for each row execute function public.income_calculator_guard();
create trigger income_snapshots_guard before insert or update or delete on public.income_calculator_snapshots for each row execute function public.income_calculator_guard();
create trigger income_reviews_guard before insert or update or delete on public.income_calculator_reviews for each row execute function public.income_calculator_guard();
comment on table public.income_calculator_snapshots is 'Immutable server-calculated income worksheets. Comparisons are not full eligibility, rent, or over-income determinations.';
