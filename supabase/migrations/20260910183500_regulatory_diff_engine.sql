-- Phase 11: Regulatory Diff Engine.
-- Comparisons use structured, validated source metadata. They do not infer
-- discretionary legal meaning and cannot activate a rule version.

create table public.regulatory_diff_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id text not null,
  prior_source_node_id uuid not null references public.compliance_graph_nodes(id) on delete restrict,
  current_source_node_id uuid not null references public.compliance_graph_nodes(id) on delete restrict,
  compared_as_of date not null,
  diff_status text not null default 'awaiting_authorized_review'
    check (diff_status='awaiting_authorized_review'),
  changes jsonb not null,
  impacted_counts jsonb not null,
  impacted_records jsonb not null,
  automatic_activation boolean not null default false check (not automatic_activation),
  report_sha256 text not null check (report_sha256 ~ '^[a-f0-9]{64}$'),
  compared_by uuid not null references auth.users(id) on delete restrict,
  compared_at timestamptz not null default now(),
  check (prior_source_node_id<>current_source_node_id)
);
create index regulatory_diff_reports_owner_time_idx
  on public.regulatory_diff_reports(user_id,compared_at desc);
create index regulatory_diff_reports_prior_fk_idx
  on public.regulatory_diff_reports(prior_source_node_id);
create index regulatory_diff_reports_current_fk_idx
  on public.regulatory_diff_reports(current_source_node_id);
create index regulatory_diff_reports_compared_by_fk_idx
  on public.regulatory_diff_reports(compared_by);

alter table public.regulatory_diff_reports enable row level security;
revoke all on public.regulatory_diff_reports from public,anon,authenticated;
grant select on public.regulatory_diff_reports to authenticated;
create policy regulatory_diff_owner_read
  on public.regulatory_diff_reports for select to authenticated
  using ((select auth.uid())=user_id);

create or replace function private.block_regulatory_diff_mutation()
returns trigger language plpgsql set search_path='' as $regulatory_diff_guard$
begin
  raise exception 'Regulatory diff reports are immutable.' using errcode='55000';
end;
$regulatory_diff_guard$;
revoke all on function private.block_regulatory_diff_mutation()
  from public,anon,authenticated,service_role;
create trigger regulatory_diff_reports_immutable
before update or delete on public.regulatory_diff_reports
for each row execute function private.block_regulatory_diff_mutation();

create or replace function public.compare_regulatory_source_versions(
  _prior_source_node_id uuid,
  _current_source_node_id uuid,
  _as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $regulatory_diff$
declare
  v_user_id uuid:=auth.uid();
  v_prior public.compliance_graph_nodes;
  v_current public.compliance_graph_nodes;
  v_report_id uuid:=gen_random_uuid();
  v_compared_at timestamptz:=clock_timestamp();
  v_prior_family text;
  v_current_family text;
  v_added jsonb;
  v_removed jsonb;
  v_impacted jsonb;
  v_counts jsonb;
  v_changes jsonb;
  v_report jsonb;
  v_hash text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if _prior_source_node_id=_current_source_node_id then
    raise exception 'Distinct regulatory source versions are required' using errcode='22023';
  end if;

  select * into v_prior from public.compliance_graph_nodes
  where id=_prior_source_node_id and user_id=v_user_id;
  select * into v_current from public.compliance_graph_nodes
  where id=_current_source_node_id and user_id=v_user_id;
  if v_prior.id is null or v_current.id is null then
    raise exception 'Regulatory source version not found in caller tenant' using errcode='42501';
  end if;
  if v_prior.node_kind not in ('law','regulation','guidance','source','qap','compliance_manual','notice','form','rule')
     or v_current.node_kind not in ('law','regulation','guidance','source','qap','compliance_manual','notice','form','rule') then
    raise exception 'Unsupported regulatory source kind' using errcode='22023';
  end if;
  if coalesce(v_prior.attributes->>'validation_status','') not in ('validated','approved')
     or coalesce(v_current.attributes->>'validation_status','') not in ('validated','approved') then
    raise exception 'Both regulatory source versions must be validated' using errcode='55000';
  end if;

  v_prior_family:=nullif(v_prior.attributes->>'source_family','');
  v_current_family:=nullif(v_current.attributes->>'source_family','');
  if v_prior_family is null or v_current_family is null or v_prior_family<>v_current_family then
    raise exception 'Source versions must declare the same source_family' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into v_added
  from (
    select value from jsonb_array_elements_text(coalesce(v_current.attributes->'requirements','[]'::jsonb))
    except
    select value from jsonb_array_elements_text(coalesce(v_prior.attributes->'requirements','[]'::jsonb))
  ) added;
  select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into v_removed
  from (
    select value from jsonb_array_elements_text(coalesce(v_prior.attributes->'requirements','[]'::jsonb))
    except
    select value from jsonb_array_elements_text(coalesce(v_current.attributes->'requirements','[]'::jsonb))
  ) removed;

  with recursive traversed(node_id,node_kind,canonical_key,label,depth,path) as (
    select n.id,n.node_kind,n.canonical_key,n.label,0,array[n.id]
    from public.compliance_graph_nodes n where n.id=v_current.id and n.user_id=v_user_id
    union all
    select n.id,n.node_kind,n.canonical_key,n.label,t.depth+1,t.path||n.id
    from traversed t
    join public.compliance_graph_edges e on e.from_node_id=t.node_id
    join public.compliance_graph_nodes n on n.id=e.to_node_id
    where e.user_id=v_user_id and n.user_id=v_user_id
      and e.effective_from<=_as_of and (e.effective_to is null or e.effective_to>=_as_of)
      and n.effective_from<=_as_of and (n.effective_to is null or n.effective_to>=_as_of)
      and t.depth<16 and not n.id=any(t.path)
  ), reachable as (
    select distinct on(node_id) node_id,node_kind,canonical_key,label,depth
    from traversed where depth>0 order by node_id,depth
  ), scoped as (
    select * from reachable where node_kind in
      ('property','unit','household','certification','policy','form','calculation','workflow')
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'node_id',node_id,'node_kind',node_kind,'canonical_key',canonical_key,
      'label',label,'graph_distance',depth
    ) order by node_kind,label,node_id),'[]'::jsonb),
    jsonb_build_object(
      'properties',count(*) filter(where node_kind='property'),
      'units',count(*) filter(where node_kind='unit'),
      'households',count(*) filter(where node_kind='household'),
      'certifications',count(*) filter(where node_kind='certification'),
      'policies',count(*) filter(where node_kind='policy'),
      'forms',count(*) filter(where node_kind='form'),
      'calculations',count(*) filter(where node_kind='calculation'),
      'workflows',count(*) filter(where node_kind='workflow')
    )
  into v_impacted,v_counts from scoped;

  v_changes:=jsonb_build_object(
    'comparison_method','exact-structured-regulatory-diff-v1',
    'substantive_text_changed',
      regexp_replace(lower(coalesce(v_prior.attributes->>'source_text','')),'\s+',' ','g')
      <>regexp_replace(lower(coalesce(v_current.attributes->>'source_text','')),'\s+',' ','g'),
    'effective_date_changed',
      v_prior.effective_from is distinct from v_current.effective_from
      or v_prior.effective_to is distinct from v_current.effective_to,
    'prior_effective_from',v_prior.effective_from,
    'current_effective_from',v_current.effective_from,
    'requirements_added',v_added,
    'requirements_removed',v_removed,
    'supersession_declared',
      v_current.supersedes_node_id=v_prior.id
      or v_current.attributes->>'supersedes_source_node_id'=v_prior.id::text,
    'impacted_rule_mappings',
      coalesce(v_current.attributes->'impacted_rule_mappings','[]'::jsonb),
    'limitations',jsonb_build_array(
      'Text changes are exact normalized comparisons, not legal interpretation.',
      'Only structured requirement identifiers are classified as added or removed.'
    )
  );
  v_report:=jsonb_build_object(
    'report_id',v_report_id,'compared_at',v_compared_at,'compared_as_of',_as_of,
    'source_family',v_current_family,
    'prior',jsonb_build_object('node_id',v_prior.id,'label',v_prior.label,'source_version',v_prior.source_version),
    'current',jsonb_build_object('node_id',v_current.id,'label',v_current.label,'source_version',v_current.source_version),
    'changes',v_changes,'impacted_counts',v_counts,'impacted_records',v_impacted,
    'diff_status','awaiting_authorized_review',
    'next_step','authorized_review',
    'automatic_activation',false
  );
  v_hash:=encode(extensions.digest(convert_to(v_report::text,'UTF8'),'sha256'),'hex');
  insert into public.regulatory_diff_reports(
    id,user_id,organization_id,prior_source_node_id,current_source_node_id,
    compared_as_of,changes,impacted_counts,impacted_records,report_sha256,
    compared_by,compared_at
  ) values (
    v_report_id,v_user_id,v_current.organization_id,v_prior.id,v_current.id,
    _as_of,v_changes,v_counts,v_impacted,v_hash,v_user_id,v_compared_at
  );
  return v_report||jsonb_build_object('report_sha256',v_hash);
end;
$regulatory_diff$;
revoke all on function public.compare_regulatory_source_versions(uuid,uuid,date) from public,anon;
grant execute on function public.compare_regulatory_source_versions(uuid,uuid,date) to authenticated;
