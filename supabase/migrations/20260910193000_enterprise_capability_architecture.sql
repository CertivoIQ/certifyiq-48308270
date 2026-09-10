-- Phase 17: Enterprise / Economic Expansion Architecture.
-- This layer defines capability and plan boundaries only. It contains no
-- prices, metering charges, checkout behavior, or automatic package activation.

create table public.enterprise_capability_catalog (
  capability_key text primary key check (capability_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  display_name text not null,
  capability_category text not null check (capability_category in
    ('audit','intelligence','integration','analytics')),
  description text not null,
  availability_state text not null default 'architecture_ready'
    check (availability_state in ('architecture_ready','available','retired')),
  requires_product_authorization boolean not null default true,
  customer_data_classification text not null default 'tenant_confidential'
    check (customer_data_classification in ('tenant_confidential','tenant_aggregate','non_customer')),
  created_at timestamptz not null default now()
);
alter table public.enterprise_capability_catalog enable row level security;
revoke all on public.enterprise_capability_catalog from public,anon,authenticated;
grant select on public.enterprise_capability_catalog to authenticated;
create policy enterprise_capability_catalog_read
  on public.enterprise_capability_catalog for select to authenticated
  using (availability_state<>'retired');

insert into public.enterprise_capability_catalog(
  capability_key,display_name,capability_category,description
) values
 ('audit_simulation','Audit Simulation','audit','Controlled simulation modes backed by supported criteria.'),
 ('auditor_workspace','Auditor Workspace','audit','Temporary scoped read-only external auditor access.'),
 ('compliance_intelligence','Compliance Intelligence','intelligence','Structured readiness, trend, and control-center analytics.'),
 ('regulatory_change_intelligence','Regulatory Change Intelligence','intelligence','Validated regulatory diffs and impact analysis.'),
 ('advanced_integrations_api','Advanced Integrations / API','integration','Governed enterprise integration and API boundary.'),
 ('enterprise_benchmarking','Enterprise Benchmarking','analytics','Future anonymized and sufficiently aggregated benchmarking only.')
on conflict (capability_key) do nothing;

create table public.enterprise_plan_capabilities (
  plan_key text not null check (plan_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  capability_key text not null references public.enterprise_capability_catalog(capability_key) on delete restrict,
  access_level text not null check (access_level in ('read','execute','admin')),
  governance_status text not null default 'draft'
    check (governance_status in ('draft','approved','retired')),
  effective_from timestamptz not null,
  effective_to timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  approval_reference text,
  created_at timestamptz not null default now(),
  primary key(plan_key,capability_key,effective_from),
  check (effective_to is null or effective_to>effective_from),
  check (governance_status<>'approved' or (approved_by is not null and nullif(btrim(approval_reference),'') is not null))
);
create index enterprise_plan_capabilities_capability_fk_idx
  on public.enterprise_plan_capabilities(capability_key);
create index enterprise_plan_capabilities_approved_by_fk_idx
  on public.enterprise_plan_capabilities(approved_by) where approved_by is not null;
alter table public.enterprise_plan_capabilities enable row level security;
revoke all on public.enterprise_plan_capabilities from public,anon,authenticated;
grant select on public.enterprise_plan_capabilities to authenticated;
create policy enterprise_plan_capability_member_read
  on public.enterprise_plan_capabilities for select to authenticated
  using (exists(
    select 1
    from public.enterprise_license_members m
    join public.enterprise_licenses l on l.id=m.license_id
    where m.user_id=(select auth.uid())
      and (l.product_code=enterprise_plan_capabilities.plan_key
        or l.license_kind=enterprise_plan_capabilities.plan_key)
  ));

create table public.enterprise_license_capability_overrides (
  license_id uuid not null references public.enterprise_licenses(id) on delete restrict,
  capability_key text not null references public.enterprise_capability_catalog(capability_key) on delete restrict,
  access_level text not null check (access_level in ('disabled','read','execute','admin')),
  governance_status text not null default 'draft'
    check (governance_status in ('draft','approved','retired')),
  effective_from timestamptz not null,
  effective_to timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  approval_reference text,
  created_at timestamptz not null default now(),
  primary key(license_id,capability_key,effective_from),
  check (effective_to is null or effective_to>effective_from),
  check (governance_status<>'approved' or (approved_by is not null and nullif(btrim(approval_reference),'') is not null))
);
create index enterprise_license_capability_overrides_capability_fk_idx
  on public.enterprise_license_capability_overrides(capability_key);
create index enterprise_license_capability_overrides_approved_by_fk_idx
  on public.enterprise_license_capability_overrides(approved_by) where approved_by is not null;
alter table public.enterprise_license_capability_overrides enable row level security;
revoke all on public.enterprise_license_capability_overrides from public,anon,authenticated;
grant select on public.enterprise_license_capability_overrides to authenticated;
create policy enterprise_license_capability_member_read
  on public.enterprise_license_capability_overrides for select to authenticated
  using (exists(
    select 1 from public.enterprise_license_members m
    where m.license_id=enterprise_license_capability_overrides.license_id
      and m.user_id=(select auth.uid())
  ));

create or replace function public.enterprise_capability_matrix(
  _as_of timestamptz default now()
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $enterprise_matrix$
with caller_licenses as (
  select l.*
  from public.enterprise_license_members m
  join public.enterprise_licenses l on l.id=m.license_id
  where m.user_id=(select auth.uid())
    and lower(l.status) in ('active','trialing')
    and (l.starts_at is null or l.starts_at<=_as_of)
    and (l.expires_at is null or l.expires_at>_as_of)
), resolved as (
  select c.capability_key,c.display_name,c.capability_category,c.description,
    coalesce(o.access_level,
      case when l.all_features then 'execute' end,
      p.access_level,'disabled') as access_level,
    case
      when o.access_level is not null then 'approved_license_override'
      when l.all_features then 'existing_all_features_license'
      when p.access_level is not null then 'approved_plan_mapping'
      else 'not_entitled'
    end as decision_source,
    l.id as license_id,l.product_code,l.license_kind,
    c.requires_product_authorization
  from public.enterprise_capability_catalog c
  left join lateral (
    select x.* from caller_licenses x
    order by x.activated_at desc nulls last,x.created_at desc,x.id limit 1
  ) l on true
  left join lateral (
    select x.access_level
    from public.enterprise_plan_capabilities x
    where l.id is not null and x.capability_key=c.capability_key
      and (x.plan_key=l.product_code or x.plan_key=l.license_kind)
      and x.governance_status='approved'
      and x.effective_from<=_as_of and (x.effective_to is null or x.effective_to>_as_of)
    order by x.effective_from desc limit 1
  ) p on true
  left join lateral (
    select x.access_level
    from public.enterprise_license_capability_overrides x
    where x.license_id=l.id and x.capability_key=c.capability_key
      and x.governance_status='approved'
      and x.effective_from<=_as_of and (x.effective_to is null or x.effective_to>_as_of)
    order by x.effective_from desc limit 1
  ) o on true
)
select jsonb_build_object(
  'as_of',_as_of,
  'architecture_version','enterprise-capability-boundary-v1',
  'pricing_logic','none',
  'automatic_package_activation',false,
  'capabilities',coalesce(jsonb_agg(to_jsonb(r) order by r.capability_category,r.capability_key),'[]'::jsonb)
) from resolved r;
$enterprise_matrix$;

revoke all on function public.enterprise_capability_matrix(timestamptz) from public,anon;
grant execute on function public.enterprise_capability_matrix(timestamptz) to authenticated;
comment on function public.enterprise_capability_matrix(timestamptz) is
  'Resolves governed enterprise capabilities without pricing, checkout, or automatic package activation.';
