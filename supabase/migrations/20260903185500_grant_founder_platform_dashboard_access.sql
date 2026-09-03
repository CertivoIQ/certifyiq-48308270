begin;

create table if not exists public.platform_dashboard_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  dashboard_key text not null,
  granted_at timestamptz not null default now(),
  granted_by text not null default 'system',
  primary key (user_id, dashboard_key),
  constraint platform_dashboard_access_key_check
    check (dashboard_key in ('multifamily', 'pha', 'executive_demo'))
);

alter table public.platform_dashboard_access enable row level security;

revoke all on table public.platform_dashboard_access from anon;
revoke all on table public.platform_dashboard_access from authenticated;
grant select on table public.platform_dashboard_access to authenticated;
grant all on table public.platform_dashboard_access to service_role;

drop policy if exists "platform dashboard access read own" on public.platform_dashboard_access;
create policy "platform dashboard access read own"
on public.platform_dashboard_access
for select
to authenticated
using (user_id = auth.uid());

comment on table public.platform_dashboard_access is
  'Internal per-user entitlement for switching among existing CertivoIQ dashboard experiences. This does not mutate customer workspace type or permissions.';

insert into public.platform_dashboard_access (user_id, dashboard_key, granted_by)
select u.id, dashboard_key, 'founder_admin_access_20260903'
from auth.users u
cross join (values ('multifamily'), ('pha'), ('executive_demo')) as dashboards(dashboard_key)
where lower(u.email) = lower('rjwatkins@certivoiq.com')
on conflict (user_id, dashboard_key) do update
set granted_by = excluded.granted_by;

commit;
