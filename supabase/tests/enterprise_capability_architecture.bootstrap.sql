create schema if not exists auth;
do $bootstrap$ begin
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $bootstrap$;
create table auth.users(id uuid primary key,email text);
create or replace function auth.uid() returns uuid language sql stable as $auth_uid$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$auth_uid$;
create table public.enterprise_licenses(
 id uuid primary key,organization_id uuid not null,product_code text not null,status text not null,
 starts_at timestamptz,expires_at timestamptz,all_features boolean not null default false,
 license_kind text,activated_at timestamptz,created_at timestamptz not null
);
create table public.enterprise_license_members(
 license_id uuid not null references public.enterprise_licenses(id),user_id uuid not null references auth.users(id),
 role text not null,created_at timestamptz not null,primary key(license_id,user_id)
);
alter table public.enterprise_licenses enable row level security;
alter table public.enterprise_license_members enable row level security;
create policy member_license on public.enterprise_licenses for select to authenticated using(exists(
 select 1 from public.enterprise_license_members m where m.license_id=id and m.user_id=(select auth.uid())
));
create policy own_membership on public.enterprise_license_members for select to authenticated using(user_id=(select auth.uid()));
grant usage on schema public,auth to authenticated,anon;
grant select on public.enterprise_licenses,public.enterprise_license_members to authenticated;
