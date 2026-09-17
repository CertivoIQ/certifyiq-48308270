-- Use validated Compliance Graph sources for read-only impact and version-diff analysis.
-- These functions never activate or approve a source or rule.

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
  if v_source.node_kind not in ('regulation','guidance','state_qap','compliance_manual','notice','form','rule') then
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
    from traversed where depth>0 order by node_id,depth
  ), scoped as (
    select * from reachable where node_kind in (
      'rule','finding','remediation','approval','evidence_record','property','unit','household','certification','form','calculation'
    )
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'node_id',node_id,'node_kind',node_kind,'canonical_key',canonical_key,
      'label',label,'graph_distance',depth
    ) order by node_kind,label,node_id),'[]'::jsonb),
    jsonb_build_object(
      'rules',count(*) filter(where node_kind='rule'),
      'findings',count(*) filter(where node_kind='finding'),
      'remediations',count(*) filter(where node_kind='remediation'),
      'approvals',count(*) filter(where node_kind='approval'),
      'evidence_records',count(*) filter(where node_kind='evidence_record'),
      'properties',count(*) filter(where node_kind='property'),
      'units',count(*) filter(where node_kind='unit'),
      'households',count(*) filter(where node_kind='household'),
      'certifications',count(*) filter(where node_kind='certification'),
      'forms',count(*) filter(where node_kind='form'),
      'calculations',count(*) filter(where node_kind='calculation')
    )
  into v_drill_down,v_counts from scoped;

  v_report:=jsonb_build_object(
    'analysis_id',v_analysis_id,'calculated_at',v_calculated_at,'as_of',_as_of,
    'source_node_id',v_source.id,'source_label',v_source.label,
    'source_version',v_source.source_version,
    'validation_status',v_source.attributes->>'validation_status',
    'analysis_status','analysis_only','requires_authorized_review',true,'automatic_activation',false,
    'impacted_counts',v_counts,'drill_down',v_drill_down,
    'method','validated-source-graph-traversal-v2'
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

create or replace function public.compare_regulatory_source_versions(
  _prior_source_node_id uuid,
  _current_source_node_id uuid,
  _as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
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
  if _prior_source_node_id=_current_source_node_id then raise exception 'Distinct regulatory source versions are required' using errcode='22023'; end if;

  select * into v_prior from public.compliance_graph_nodes where id=_prior_source_node_id and user_id=v_user_id;
  select * into v_current from public.compliance_graph_nodes where id=_current_source_node_id and user_id=v_user_id;
  if v_prior.id is null or v_current.id is null then raise exception 'Regulatory source version not found in caller tenant' using errcode='42501'; end if;
  if v_prior.node_kind not in ('regulation','guidance','state_qap','compliance_manual','notice','form','rule')
     or v_current.node_kind not in ('regulation','guidance','state_qap','compliance_manual','notice','form','rule') then
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
      ('rule','finding','remediation','approval','evidence_record','property','unit','household','certification','form','calculation')
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'node_id',node_id,'node_kind',node_kind,'canonical_key',canonical_key,
      'label',label,'graph_distance',depth
    ) order by node_kind,label,node_id),'[]'::jsonb),
    jsonb_build_object(
      'rules',count(*) filter(where node_kind='rule'),
      'findings',count(*) filter(where node_kind='finding'),
      'remediations',count(*) filter(where node_kind='remediation'),
      'approvals',count(*) filter(where node_kind='approval'),
      'evidence_records',count(*) filter(where node_kind='evidence_record'),
      'properties',count(*) filter(where node_kind='property'),
      'units',count(*) filter(where node_kind='unit'),
      'households',count(*) filter(where node_kind='household'),
      'certifications',count(*) filter(where node_kind='certification'),
      'forms',count(*) filter(where node_kind='form'),
      'calculations',count(*) filter(where node_kind='calculation')
    )
  into v_impacted,v_counts from scoped;

  v_changes:=jsonb_build_object(
    'comparison_method','exact-structured-regulatory-diff-v2',
    'exact_source_bytes_changed',coalesce(v_prior.attributes->>'source_sha256','')<>coalesce(v_current.attributes->>'source_sha256',''),
    'prior_sha256',v_prior.attributes->>'source_sha256',
    'current_sha256',v_current.attributes->>'source_sha256',
    'source_url_changed',coalesce(v_prior.attributes->>'source_url','')<>coalesce(v_current.attributes->>'source_url',''),
    'substantive_text_changed',
      case when coalesce(v_prior.attributes->>'source_text','')='' and coalesce(v_current.attributes->>'source_text','')='' then false
      else regexp_replace(lower(coalesce(v_prior.attributes->>'source_text','')),'\s+',' ','g')
        <>regexp_replace(lower(coalesce(v_current.attributes->>'source_text','')),'\s+',' ','g') end,
    'effective_date_changed',v_prior.effective_from is distinct from v_current.effective_from or v_prior.effective_to is distinct from v_current.effective_to,
    'prior_effective_from',v_prior.effective_from,'current_effective_from',v_current.effective_from,
    'requirements_added',v_added,'requirements_removed',v_removed,
    'supersession_declared',v_current.supersedes_node_id=v_prior.id or v_current.attributes->>'supersedes_source_node_id'=v_prior.id::text,
    'impacted_rule_mappings',coalesce(v_current.attributes->'impacted_rule_mappings','[]'::jsonb),
    'limitations',jsonb_build_array(
      'Exact source-byte changes are detected from SHA-256 identity; byte changes are not treated as legal interpretation.',
      'Structured requirement identifiers are compared only when they were explicitly captured.',
      'No regulatory source or rule is activated by this comparison.'
    )
  );
  v_report:=jsonb_build_object(
    'report_id',v_report_id,'compared_at',v_compared_at,'compared_as_of',_as_of,
    'source_family',v_current_family,
    'prior',jsonb_build_object('node_id',v_prior.id,'label',v_prior.label,'source_version',v_prior.source_version),
    'current',jsonb_build_object('node_id',v_current.id,'label',v_current.label,'source_version',v_current.source_version),
    'changes',v_changes,'impacted_counts',v_counts,'impacted_records',v_impacted,
    'diff_status','awaiting_authorized_review','next_step','authorized_review','automatic_activation',false
  );
  v_hash:=encode(extensions.digest(convert_to(v_report::text,'UTF8'),'sha256'),'hex');
  insert into public.regulatory_diff_reports(
    id,user_id,organization_id,prior_source_node_id,current_source_node_id,
    compared_as_of,changes,impacted_counts,impacted_records,report_sha256,compared_by,compared_at
  ) values (
    v_report_id,v_user_id,v_current.organization_id,v_prior.id,v_current.id,
    _as_of,v_changes,v_counts,v_impacted,v_hash,v_user_id,v_compared_at
  );
  return v_report||jsonb_build_object('report_sha256',v_hash);
end;
$$;
revoke all on function public.compare_regulatory_source_versions(uuid,uuid,date) from public,anon;
grant execute on function public.compare_regulatory_source_versions(uuid,uuid,date) to authenticated;
