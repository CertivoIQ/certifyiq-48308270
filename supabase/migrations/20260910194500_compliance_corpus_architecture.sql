-- Phase 18: CertivoIQ Compliance Corpus architecture.
-- Raw tenant records are permanently service-delivery-only. Future model
-- training or cross-tenant analytics require a separate governed process.

create schema if not exists private;

create table public.compliance_corpus_data_use_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id text not null,
  model_training_permission text not null default 'prohibited'
    check (model_training_permission in ('prohibited','permitted')),
  anonymized_aggregation_permission text not null default 'prohibited'
    check (anonymized_aggregation_permission in ('prohibited','permitted')),
  consent_reference text,
  authorized_by uuid references auth.users(id) on delete restrict,
  effective_from timestamptz not null,
  effective_to timestamptz,
  policy_sha256 text not null check (policy_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz not null default now(),
  check (effective_to is null or effective_to>effective_from),
  check (
    (model_training_permission='prohibited' and anonymized_aggregation_permission='prohibited')
    or (authorized_by is not null and nullif(btrim(consent_reference),'') is not null)
  )
);
create index compliance_corpus_policy_owner_effective_idx
  on public.compliance_corpus_data_use_policies(user_id,organization_id,effective_from desc);
create index compliance_corpus_policy_authorized_by_fk_idx
  on public.compliance_corpus_data_use_policies(authorized_by) where authorized_by is not null;
alter table public.compliance_corpus_data_use_policies enable row level security;
revoke all on public.compliance_corpus_data_use_policies from public,anon,authenticated;
grant select on public.compliance_corpus_data_use_policies to authenticated;
grant all on public.compliance_corpus_data_use_policies to service_role;
create policy compliance_corpus_policy_owner_read
  on public.compliance_corpus_data_use_policies for select to authenticated
  using ((select auth.uid())=user_id);

create table public.compliance_corpus_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id text not null,
  regulation_node_id uuid not null references public.compliance_graph_nodes(id) on delete restrict,
  target_kind text not null check (target_kind in (
    'property','program','evidence','calculation','finding','correction',
    'reviewer_decision','audit_outcome'
  )),
  target_reference text not null,
  property_id uuid references public.portfolio_properties(id) on delete restrict,
  program_code text,
  evidence_manifest_id uuid references public.evidence_manifests(id) on delete restrict,
  calculation_reference text,
  finding_id uuid references public.compliance_findings(id) on delete restrict,
  correction_id uuid references public.compliance_remediation_actions(id) on delete restrict,
  reviewer_decision_id uuid references public.finding_reviews(id) on delete restrict,
  audit_simulation_report_id uuid references public.audit_simulation_reports(id) on delete restrict,
  source_version text not null,
  rule_version text,
  engine_version text,
  structured_facts jsonb not null default '{}'::jsonb,
  provenance jsonb not null,
  customer_data_use text not null default 'service_delivery_only'
    check (customer_data_use='service_delivery_only'),
  contains_raw_customer_content boolean not null default false
    check (not contains_raw_customer_content),
  model_training_eligible boolean not null default false
    check (not model_training_eligible),
  record_sha256 text not null check (record_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz not null default now(),
  unique(user_id,regulation_node_id,target_kind,target_reference,source_version),
  check (provenance ?& array['source_table','source_id','captured_at']),
  check (
    (target_kind='property' and property_id is not null)
    or (target_kind='program' and nullif(btrim(program_code),'') is not null)
    or (target_kind='evidence' and evidence_manifest_id is not null)
    or (target_kind='calculation' and nullif(btrim(calculation_reference),'') is not null)
    or (target_kind='finding' and finding_id is not null)
    or (target_kind='correction' and correction_id is not null)
    or (target_kind='reviewer_decision' and reviewer_decision_id is not null)
    or (target_kind='audit_outcome' and audit_simulation_report_id is not null)
  )
);
create index compliance_corpus_records_owner_recorded_idx
  on public.compliance_corpus_records(user_id,recorded_at desc);
create index compliance_corpus_records_organization_kind_idx
  on public.compliance_corpus_records(organization_id,target_kind,recorded_at desc);
create index compliance_corpus_records_regulation_fk_idx
  on public.compliance_corpus_records(regulation_node_id);
create index compliance_corpus_records_property_fk_idx
  on public.compliance_corpus_records(property_id) where property_id is not null;
create index compliance_corpus_records_evidence_fk_idx
  on public.compliance_corpus_records(evidence_manifest_id) where evidence_manifest_id is not null;
create index compliance_corpus_records_finding_fk_idx
  on public.compliance_corpus_records(finding_id) where finding_id is not null;
create index compliance_corpus_records_correction_fk_idx
  on public.compliance_corpus_records(correction_id) where correction_id is not null;
create index compliance_corpus_records_reviewer_fk_idx
  on public.compliance_corpus_records(reviewer_decision_id) where reviewer_decision_id is not null;
create index compliance_corpus_records_audit_fk_idx
  on public.compliance_corpus_records(audit_simulation_report_id) where audit_simulation_report_id is not null;
alter table public.compliance_corpus_records enable row level security;
revoke all on public.compliance_corpus_records from public,anon,authenticated;
grant select on public.compliance_corpus_records to authenticated;
grant insert,select on public.compliance_corpus_records to service_role;
create policy compliance_corpus_record_owner_read
  on public.compliance_corpus_records for select to authenticated
  using ((select auth.uid())=user_id);

create table private.compliance_corpus_aggregate_cells (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  period_start date not null,
  period_end date not null,
  jurisdiction text,
  program_code text,
  rule_family text,
  aggregate_value numeric not null,
  contributing_tenant_count integer not null check (contributing_tenant_count>=5),
  contributing_record_count bigint not null check (contributing_record_count>=contributing_tenant_count),
  aggregation_method text not null,
  source_version_set jsonb not null,
  policy_snapshot_sha256 text not null check (policy_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  aggregate_sha256 text not null check (aggregate_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  check (period_end>=period_start),
  unique(metric_key,period_start,period_end,jurisdiction,program_code,rule_family,aggregate_sha256)
);
create index compliance_corpus_aggregate_cells_metric_period_idx
  on private.compliance_corpus_aggregate_cells(metric_key,period_start,period_end);
alter table private.compliance_corpus_aggregate_cells enable row level security;
revoke all on private.compliance_corpus_aggregate_cells from public,anon,authenticated;
grant insert,select on private.compliance_corpus_aggregate_cells to service_role;

create or replace function private.validate_compliance_corpus_tenant_links()
returns trigger
language plpgsql
security definer
set search_path=''
as $corpus_validate$
begin
  if not exists(
    select 1 from public.compliance_graph_nodes n
    where n.id=new.regulation_node_id and n.user_id=new.user_id
      and n.organization_id=new.organization_id
      and n.node_kind in ('authority','regulation','guidance','state_qap','compliance_manual','notice','rule')
  ) then raise exception 'Corpus regulation provenance is outside the tenant' using errcode='42501'; end if;
  if new.property_id is not null and not exists(
    select 1 from public.portfolio_properties p where p.id=new.property_id and p.user_id=new.user_id
  ) then raise exception 'Corpus property is outside the tenant' using errcode='42501'; end if;
  if new.evidence_manifest_id is not null and not exists(
    select 1 from public.evidence_manifests e where e.id=new.evidence_manifest_id and e.user_id=new.user_id
  ) then raise exception 'Corpus evidence is outside the tenant' using errcode='42501'; end if;
  if new.finding_id is not null and not exists(
    select 1 from public.compliance_findings f where f.id=new.finding_id and f.user_id=new.user_id
  ) then raise exception 'Corpus finding is outside the tenant' using errcode='42501'; end if;
  if new.correction_id is not null and not exists(
    select 1 from public.compliance_remediation_actions r
    join public.compliance_findings f on f.id=r.finding_id
    where r.id=new.correction_id and f.user_id=new.user_id
  ) then raise exception 'Corpus correction is outside the tenant' using errcode='42501'; end if;
  if new.reviewer_decision_id is not null and not exists(
    select 1 from public.finding_reviews r where r.id=new.reviewer_decision_id and r.user_id=new.user_id
  ) then raise exception 'Corpus reviewer decision is outside the tenant' using errcode='42501'; end if;
  if new.audit_simulation_report_id is not null and not exists(
    select 1 from public.audit_simulation_reports a where a.id=new.audit_simulation_report_id and a.user_id=new.user_id
  ) then raise exception 'Corpus audit outcome is outside the tenant' using errcode='42501'; end if;
  return new;
end;
$corpus_validate$;
revoke all on function private.validate_compliance_corpus_tenant_links()
  from public,anon,authenticated,service_role;

create or replace function private.block_compliance_corpus_mutation()
returns trigger language plpgsql set search_path='' as $corpus_immutable$
begin raise exception 'Compliance Corpus history is immutable.' using errcode='55000'; end;
$corpus_immutable$;
revoke all on function private.block_compliance_corpus_mutation()
  from public,anon,authenticated,service_role;

create trigger compliance_corpus_records_validate
before insert on public.compliance_corpus_records
for each row execute function private.validate_compliance_corpus_tenant_links();
create trigger compliance_corpus_records_immutable
before update or delete on public.compliance_corpus_records
for each row execute function private.block_compliance_corpus_mutation();
create trigger compliance_corpus_policies_immutable
before update or delete on public.compliance_corpus_data_use_policies
for each row execute function private.block_compliance_corpus_mutation();
create trigger compliance_corpus_aggregate_cells_immutable
before update or delete on private.compliance_corpus_aggregate_cells
for each row execute function private.block_compliance_corpus_mutation();

create or replace function public.compliance_corpus_status(
  _as_of timestamptz default now()
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $corpus_status$
with current_policy as (
  select p.*
  from public.compliance_corpus_data_use_policies p
  where p.user_id=(select auth.uid())
    and p.effective_from<=_as_of and (p.effective_to is null or p.effective_to>_as_of)
  order by p.effective_from desc,p.recorded_at desc limit 1
), counts as (
  select r.target_kind,count(*)::integer as record_count
  from public.compliance_corpus_records r
  where r.user_id=(select auth.uid()) and r.recorded_at<=_as_of
  group by r.target_kind
)
select jsonb_build_object(
  'as_of',_as_of,
  'architecture_version','provenance-preserving-corpus-v1',
  'raw_cross_tenant_access',false,
  'raw_customer_records_model_training_eligible',false,
  'model_training_permission',coalesce((select model_training_permission from current_policy),'prohibited'),
  'anonymized_aggregation_permission',coalesce((select anonymized_aggregation_permission from current_policy),'prohibited'),
  'anonymized_aggregation_supported',true,
  'minimum_aggregate_tenant_count',5,
  'record_counts',coalesce((select jsonb_object_agg(target_kind,record_count) from counts),'{}'::jsonb)
);
$corpus_status$;
revoke all on function public.compliance_corpus_status(timestamptz) from public,anon;
grant execute on function public.compliance_corpus_status(timestamptz) to authenticated;
