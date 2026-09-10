-- Phase 10: governed Compliance Impact Analysis.
-- Analysis is permitted only for a source node marked validated/approved and
-- never activates, approves, or deploys a regulatory change.

create table public.compliance_impact_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id text not null,
  source_node_id uuid not null references public.compliance_graph_nodes(id) on delete restrict,
  source_version text,
  as_of date not null,
  analysis_status text not null default 'analysis_only'
    check (analysis_status='analysis_only'),
  impacted_counts jsonb not null,
  drill_down jsonb not null,
  requires_authorized_review boolean not null default true
    check (requires_authorized_review),
  analysis_sha256 text not null check (analysis_sha256 ~ '^[a-f0-9]{64}$'),
  calculated_by uuid not null references auth.users(id) on delete restrict,
  calculated_at timestamptz not null default now()
);
create index compliance_impact_analyses_owner_time_idx
  on public.compliance_impact_analyses(user_id,calculated_at desc);
create index compliance_impact_analyses_source_fk_idx
  on public.compliance_impact_analyses(source_node_id);
create index compliance_impact_analyses_calculated_by_fk_idx
  on public.compliance_impact_analyses(calculated_by);

alter table public.compliance_impact_analyses enable row level security;
revoke all on public.compliance_impact_analyses from public,anon,authenticated;
grant select on public.compliance_impact_analyses to authenticated;
create policy compliance_impact_owner_read
  on public.compliance_impact_analyses for select to authenticated
  using ((select auth.uid())=user_id);

create or replace function private.block_compliance_impact_mutation()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Compliance impact analyses are immutable.' using errcode='55000'; end;
$$;
revoke all on function private.block_compliance_impact_mutation() from public,anon,authenticated,service_role;
create trigger compliance_impact_analyses_immutable
before update or delete on public.compliance_impact_analyses
for each row execute function private.block_compliance_impact_mutation();

create or replace function public.calculate_compliance_impact(
  _source_node_id uuid,
  _as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.compliance_graph_nodes;
  v_analysis_id uuid := gen_random_uuid();
  v_calculated_at timestamptz := clock_timestamp();
  v_drill_down jsonb;
  v_counts jsonb;
  v_report jsonb;
  v_hash text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_source from public.compliance_graph_nodes
  where id=_source_node_id and user_id=v_user_id;
  if v_source.id is null then raise exception 'Validated source node not found in caller tenant' using errcode='42501'; end if;
  if v_source.node_kind not in ('law','regulation','guidance','source','qap','compliance_manual','notice','form','rule') then
    raise exception 'Node kind cannot initiate regulatory impact analysis' using errcode='22023';
  end if;
  if coalesce(v_source.attributes->>'validation_status','') not in ('validated','approved') then
    raise exception 'Regulatory source change is not validated; impact analysis denied' using errcode='55000';
  end if;
  if exists (
    select 1 from public.compliance_impact_analyses a
    where a.user_id=v_user_id and a.source_node_id=_source_node_id
      and a.calculated_at>clock_timestamp()-interval '30 seconds'
  ) then raise exception 'Impact analysis rate limit: retry after 30 seconds' using errcode='57014'; end if;

  with recursive traversed(node_id,node_kind,canonical_key,label,depth,path) as (
    select n.id,n.node_kind,n.canonical_key,n.label,0,array[n.id]
    from public.compliance_graph_nodes n
    where n.id=v_source.id and n.user_id=v_user_id
    union all
    select n.id,n.node_kind,n.canonical_key,n.label,t.depth+1,t.path||n.id
    from traversed t
    join public.compliance_graph_edges e on e.from_node_id=t.node_id
    join public.compliance_graph_nodes n on n.id=e.to_node_id
    where e.user_id=v_user_id and n.user_id=v_user_id
      and e.effective_from<=_as_of
      and (e.effective_to is null or e.effective_to>=_as_of)
      and n.effective_from<=_as_of
      and (n.effective_to is null or n.effective_to>=_as_of)
      and t.depth<16 and not n.id=any(t.path)
  ), reachable as (
    select distinct on (node_id) node_id,node_kind,canonical_key,label,depth
    from traversed where depth>0
    order by node_id,depth
  ), scoped as (
    select * from reachable where node_kind in (
      'property','unit','household','certification','policy','form','calculation','workflow'
    )
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
  into v_drill_down,v_counts from scoped;

  v_report:=jsonb_build_object(
    'analysis_id',v_analysis_id,'calculated_at',v_calculated_at,'as_of',_as_of,
    'source_node_id',v_source.id,'source_label',v_source.label,
    'source_version',v_source.source_version,
    'validation_status',v_source.attributes->>'validation_status',
    'analysis_status','analysis_only',
    'requires_authorized_review',true,
    'automatic_activation',false,
    'impacted_counts',v_counts,'drill_down',v_drill_down,
    'method','version-effective-graph-traversal-v1'
  );
  v_hash:=encode(extensions.digest(convert_to(v_report::text,'UTF8'),'sha256'),'hex');
  insert into public.compliance_impact_analyses(
    id,user_id,organization_id,source_node_id,source_version,as_of,
    impacted_counts,drill_down,analysis_sha256,calculated_by,calculated_at
  ) values (
    v_analysis_id,v_user_id,v_source.organization_id,v_source.id,v_source.source_version,_as_of,
    v_counts,v_drill_down,v_hash,v_user_id,v_calculated_at
  );
  return v_report||jsonb_build_object('analysis_sha256',v_hash);
end;
$$;
revoke all on function public.calculate_compliance_impact(uuid,date) from public,anon;
grant execute on function public.calculate_compliance_impact(uuid,date) to authenticated;
