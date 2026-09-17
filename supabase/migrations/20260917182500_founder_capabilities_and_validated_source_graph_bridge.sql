-- Founder enterprise access plus a provenance-preserving bridge from founder-verified
-- state/federal source candidates into the Compliance Graph. This migration does not
-- activate or approve any regulatory rule or state pack.

create or replace function private.is_certivoiq_founder(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from auth.users u
    join public.crm_staff_access a on a.user_id=u.id
    where u.id=p_user_id
      and lower(trim(u.email))='rjwatkins@certivoiq.com'
      and u.email_confirmed_at is not null
      and a.status='active'
      and a.access_level='admin'
  );
$$;
revoke all on function private.is_certivoiq_founder(uuid) from public,anon,authenticated;

create or replace function public.enterprise_capability_matrix(_as_of timestamptz default now())
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select (select auth.uid()) as user_id,
         private.is_certivoiq_founder((select auth.uid())) as is_founder
), caller_licenses as (
  select l.*
  from public.enterprise_license_members m
  join public.enterprise_licenses l on l.id=m.license_id
  join actor a on a.user_id=m.user_id
  where lower(l.status) in ('active','trialing')
    and (l.starts_at is null or l.starts_at<=_as_of)
    and (l.expires_at is null or l.expires_at>_as_of)
), resolved as (
  select c.capability_key,c.display_name,c.capability_category,c.description,
    case
      when a.is_founder and c.capability_key='advanced_integrations_api' then 'disabled'
      when a.is_founder then 'admin'
      else coalesce(o.access_level,case when l.all_features then 'execute' end,p.access_level,'disabled')
    end as access_level,
    case
      when a.is_founder and c.capability_key='advanced_integrations_api' then 'external_license_required'
      when a.is_founder then 'founder_admin_authority'
      when o.access_level is not null then 'approved_license_override'
      when l.all_features then 'existing_all_features_license'
      when p.access_level is not null then 'approved_plan_mapping'
      else 'not_entitled'
    end as decision_source,
    l.id as license_id,l.product_code,l.license_kind,c.requires_product_authorization
  from public.enterprise_capability_catalog c
  cross join actor a
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
  'architecture_version','enterprise-capability-boundary-v2-founder-admin',
  'pricing_logic','none',
  'automatic_package_activation',false,
  'capabilities',coalesce(jsonb_agg(to_jsonb(r) order by r.capability_category,r.capability_key),'[]'::jsonb)
) from resolved r;
$$;
revoke all on function public.enterprise_capability_matrix(timestamptz) from public,anon;
grant execute on function public.enterprise_capability_matrix(timestamptz) to authenticated;

create or replace function private.sync_founder_validated_source_graph(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org text;
  v_source_count integer:=0;
  v_rule_count integer:=0;
  v_edge_count integer:=0;
  v_finding_count integer:=0;
  v_cert_count integer:=0;
begin
  if not private.is_certivoiq_founder(p_user_id) then
    raise exception 'Founder administrator authority required' using errcode='42501';
  end if;

  select coalesce(
    (select f.organization_id from public.compliance_findings f where f.user_id=p_user_id and nullif(f.organization_id,'') is not null order by f.created_at desc limit 1),
    'org-'||p_user_id::text
  ) into v_org;

  with eligible as (
    select s.*,
      case
        when upper(coalesce(s.source_type,'')) like '%QAP%' or upper(coalesce(s.source_type,'')) like '%ALLOCATION_PLAN%' then 'state_qap'
        when upper(coalesce(s.source_type,'')) like '%MANUAL%' or upper(coalesce(s.source_type,'')) like '%GUIDEBOOK%' then 'compliance_manual'
        when upper(coalesce(s.source_type,'')) like '%FORM%' then 'form'
        when upper(coalesce(s.source_type,'')) like '%NOTICE%' then 'notice'
        when upper(coalesce(s.source_type,'')) like '%RULE%' or upper(coalesce(s.source_type,'')) like '%REGULATION%' then 'regulation'
        else 'guidance'
      end as graph_kind,
      lower(concat_ws('|',s.state_code,s.authority_name,s.source_type,coalesce(s.program,''))) as source_family,
      case
        when coalesce(s.verification_evidence->>'effective_date','') ~ '^\d{4}-\d{2}-\d{2}$' then (s.verification_evidence->>'effective_date')::date
        else coalesce(s.retrieved_at::date,s.inventory_generated_at::date)
      end as graph_effective_from
    from public.state_rule_source_candidates s
    where s.agent_verification_status='verified'
      and s.exact_bytes_captured=true
      and s.source_sha256 ~ '^[a-f0-9]{64}$'
      and s.retrieved_at is not null
      and coalesce(s.candidate_status,'')<>'EXCLUDED_REDUNDANT_SOURCE'
  ), dedup as (
    select distinct on (state_code,source_sha256) *
    from eligible
    order by state_code,source_sha256,retrieved_at desc,updated_at desc,id
  ), inserted as (
    insert into public.compliance_graph_nodes(
      user_id,organization_id,node_kind,canonical_key,label,jurisdiction,program_code,
      source_table,source_id,source_version,engine_version,effective_from,attributes,recorded_at
    )
    select
      p_user_id,v_org,d.graph_kind,
      'validated-state-source:'||lower(d.state_code)||':'||d.source_sha256,
      concat_ws(' · ',d.state_code,d.authority_name,coalesce(nullif(d.origin_file,''),d.source_type)),
      d.state_code,nullif(d.program,''),'state_rule_source_candidates',d.id::text,
      coalesce(nullif(d.verification_evidence->>'version',''),nullif(d.verification_evidence->>'effective_date',''),d.retrieved_at::date::text,left(d.source_sha256,12)),
      'validated-source-graph-bridge-2026.09.17.1',d.graph_effective_from,
      jsonb_build_object(
        'validation_status','validated','source_family',d.source_family,'source_sha256',d.source_sha256,
        'source_url',d.source_url,'source_type',d.source_type,'authority_name',d.authority_name,
        'state_code',d.state_code,'program',d.program,'inventory_generated_at',d.inventory_generated_at,
        'retrieved_at',d.retrieved_at,'exact_bytes_captured',true,'verification_status','verified',
        'requirements','[]'::jsonb,'source_candidate_id',d.id
      ),now()
    from dedup d
    where not exists(
      select 1 from public.compliance_graph_nodes n
      where n.user_id=p_user_id
        and n.canonical_key='validated-state-source:'||lower(d.state_code)||':'||d.source_sha256
    )
    returning id
  ) select count(*)::int into v_source_count from inserted;

  with source_nodes as (
    select n.id,n.user_id,n.organization_id,n.jurisdiction,n.effective_from,n.source_version,
           n.attributes->>'source_sha256' as source_sha256,
           n.attributes->>'source_family' as source_family
    from public.compliance_graph_nodes n
    where n.user_id=p_user_id and n.source_table='state_rule_source_candidates'
      and n.attributes->>'validation_status'='validated'
  ), eligible_rules as (
    select distinct on (r.state_code,coalesce(r.rule_sha256,r.id::text)) r.*,s.id as source_node_id,s.organization_id,s.source_family,
           coalesce(r.effective_from,s.effective_from) as graph_effective_from
    from public.state_rule_deterministic_rules r
    join source_nodes s on s.jurisdiction=r.state_code and s.source_sha256=r.source_sha256
    where upper(coalesce(r.validation_status,''))='VALIDATED'
    order by r.state_code,coalesce(r.rule_sha256,r.id::text),r.created_at desc,r.id,s.id
  ), inserted as (
    insert into public.compliance_graph_nodes(
      user_id,organization_id,node_kind,canonical_key,label,jurisdiction,program_code,
      source_table,source_id,source_version,rule_version,engine_version,effective_from,effective_to,
      attributes,recorded_at
    )
    select p_user_id,e.organization_id,'rule',
      'deterministic-rule:'||lower(e.state_code)||':'||coalesce(e.rule_sha256,e.id::text),
      concat_ws(' · ',e.state_code,e.rule_key,e.topic),e.state_code,nullif(e.program_code,''),
      'state_rule_deterministic_rules',e.id::text,e.source_sha256,e.rule_version,e.validator_build,
      e.graph_effective_from,e.effective_to,
      jsonb_build_object(
        'validation_status','validated','rule_key',e.rule_key,'rule_sha256',e.rule_sha256,
        'source_sha256',e.source_sha256,'source_family',e.source_family,'citation',e.citation,
        'source_page',e.source_page,'operation_type',e.operation_type
      ),now()
    from eligible_rules e
    where e.graph_effective_from is not null
      and not exists(
        select 1 from public.compliance_graph_nodes n
        where n.user_id=p_user_id and n.canonical_key='deterministic-rule:'||lower(e.state_code)||':'||coalesce(e.rule_sha256,e.id::text)
      )
    returning id
  ) select count(*)::int into v_rule_count from inserted;

  with source_nodes as (
    select n.id,n.organization_id,n.jurisdiction,n.effective_from,n.source_version,n.attributes->>'source_sha256' source_sha256
    from public.compliance_graph_nodes n
    where n.user_id=p_user_id and n.source_table='state_rule_source_candidates'
  ), rule_nodes as (
    select n.id,n.organization_id,n.jurisdiction,n.effective_from,n.effective_to,n.source_id,n.source_version
    from public.compliance_graph_nodes n
    where n.user_id=p_user_id and n.source_table='state_rule_deterministic_rules'
  ), pairs as (
    select distinct s.id source_node_id,rn.id rule_node_id,s.organization_id,
      greatest(s.effective_from,rn.effective_from) effective_from,
      rn.effective_to,rn.source_version
    from public.state_rule_deterministic_rules r
    join source_nodes s on s.jurisdiction=r.state_code and s.source_sha256=r.source_sha256
    join rule_nodes rn on rn.source_id=r.id::text
    where upper(coalesce(r.validation_status,''))='VALIDATED'
  ), inserted as (
    insert into public.compliance_graph_edges(
      user_id,organization_id,from_node_id,to_node_id,relationship_type,source_version,
      effective_from,effective_to,attributes,recorded_at
    )
    select p_user_id,p.organization_id,p.source_node_id,p.rule_node_id,'governs',p.source_version,
           p.effective_from,p.effective_to,jsonb_build_object('bridge','exact_source_sha_to_validated_rule'),now()
    from pairs p
    where not exists(
      select 1 from public.compliance_graph_edges e
      where e.user_id=p_user_id and e.from_node_id=p.source_node_id and e.to_node_id=p.rule_node_id
        and e.relationship_type='governs'
    )
    returning id
  ) select count(*)::int into v_edge_count from inserted;

  with inserted as (
    insert into public.compliance_graph_nodes(
      user_id,organization_id,node_kind,canonical_key,label,jurisdiction,source_table,source_id,
      source_version,rule_version,engine_version,effective_from,attributes,recorded_at
    )
    select p_user_id,f.organization_id,'finding','finding:'||f.id::text,
      concat_ws(' · ',coalesce(f.rule_id,'Finding'),coalesce(f.status,'unknown')),f.jurisdiction,
      'compliance_findings',f.id::text,coalesce(f.rule_pack_version,f.rule_version),f.rule_version,f.engine_build,
      f.created_at::date,
      jsonb_build_object('status',f.status,'severity',f.severity,'review_state',f.review_state,
                         'rule_id',f.rule_id,'item_id',f.item_id,'validation_status','service_delivery_record'),now()
    from public.compliance_findings f
    where f.user_id=p_user_id
      and not exists(select 1 from public.compliance_graph_nodes n where n.user_id=p_user_id and n.source_table='compliance_findings' and n.source_id=f.id::text)
    returning id
  ) select count(*)::int into v_finding_count from inserted;

  with items as (
    select distinct i.*
    from public.certification_import_items i
    join public.compliance_findings f on f.item_id=i.id
    where f.user_id=p_user_id and i.user_id=p_user_id
  ), inserted as (
    insert into public.compliance_graph_nodes(
      user_id,organization_id,node_kind,canonical_key,label,jurisdiction,source_table,source_id,
      source_version,engine_version,effective_from,attributes,recorded_at
    )
    select p_user_id,v_org,'certification','certification:'||i.id::text,
      'Certification '||left(i.id::text,8),i.jurisdiction,'certification_import_items',i.id::text,
      coalesce(i.certification_type,'reviewed'),coalesce(i.extraction_provider,'certification-review'),
      coalesce(i.processed_at::date,i.created_at::date),
      jsonb_build_object('status',i.status,'certification_type',i.certification_type,'jurisdiction',i.jurisdiction,
                         'program_codes',coalesce(to_jsonb(i.program_codes),'[]'::jsonb),'contains_raw_customer_content',false),now()
    from items i
    where not exists(select 1 from public.compliance_graph_nodes n where n.user_id=p_user_id and n.source_table='certification_import_items' and n.source_id=i.id::text)
    returning id
  ) select count(*)::int into v_cert_count from inserted;

  insert into public.compliance_graph_edges(
    user_id,organization_id,from_node_id,to_node_id,relationship_type,source_version,effective_from,attributes,recorded_at
  )
  select p_user_id,rn.organization_id,rn.id,fn.id,'finds',rn.source_version,
         greatest(rn.effective_from,fn.effective_from),jsonb_build_object('bridge','exact_rule_key_to_finding'),now()
  from public.compliance_graph_nodes rn
  join public.compliance_graph_nodes fn on fn.user_id=p_user_id and fn.source_table='compliance_findings'
  join public.compliance_findings f on f.id=fn.source_id::uuid
  where rn.user_id=p_user_id and rn.source_table='state_rule_deterministic_rules'
    and rn.attributes->>'rule_key'=f.rule_id
    and (rn.jurisdiction is null or f.jurisdiction is null or rn.jurisdiction=f.jurisdiction)
    and not exists(select 1 from public.compliance_graph_edges e where e.user_id=p_user_id and e.from_node_id=rn.id and e.to_node_id=fn.id and e.relationship_type='finds');

  insert into public.compliance_graph_edges(
    user_id,organization_id,from_node_id,to_node_id,relationship_type,source_version,effective_from,attributes,recorded_at
  )
  select p_user_id,fn.organization_id,fn.id,cn.id,'applies_to',fn.source_version,
         greatest(fn.effective_from,cn.effective_from),jsonb_build_object('bridge','finding_to_certification_item'),now()
  from public.compliance_graph_nodes fn
  join public.compliance_findings f on f.id=fn.source_id::uuid
  join public.compliance_graph_nodes cn on cn.user_id=p_user_id and cn.source_table='certification_import_items' and cn.source_id=f.item_id::text
  where fn.user_id=p_user_id and fn.source_table='compliance_findings'
    and not exists(select 1 from public.compliance_graph_edges e where e.user_id=p_user_id and e.from_node_id=fn.id and e.to_node_id=cn.id and e.relationship_type='applies_to');

  return jsonb_build_object(
    'source_nodes_added',v_source_count,'rule_nodes_added',v_rule_count,
    'finding_nodes_added',v_finding_count,'certification_nodes_added',v_cert_count,
    'status','synced','automatic_rule_activation',false
  );
end;
$$;
revoke all on function private.sync_founder_validated_source_graph(uuid) from public,anon,authenticated;

create or replace function public.validated_regulatory_source_catalog()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_sync jsonb:='{}'::jsonb;
  v_nodes jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.is_certivoiq_founder(v_user_id) then
    v_sync:=private.sync_founder_validated_source_graph(v_user_id);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'label',n.label,'node_kind',n.node_kind,'jurisdiction',n.jurisdiction,
    'program_code',n.program_code,'source_version',n.source_version,'effective_from',n.effective_from,
    'source_family',n.attributes->>'source_family','source_sha256',n.attributes->>'source_sha256',
    'source_url',n.attributes->>'source_url','source_type',n.attributes->>'source_type',
    'authority_name',n.attributes->>'authority_name'
  ) order by n.jurisdiction,n.attributes->>'authority_name',n.attributes->>'source_family',n.effective_from desc,n.label),'[]'::jsonb)
  into v_nodes
  from public.compliance_graph_nodes n
  where n.user_id=v_user_id
    and n.source_table='state_rule_source_candidates'
    and n.attributes->>'validation_status'='validated';
  return jsonb_build_object('nodes',v_nodes,'sync',v_sync,'node_id_field','id');
end;
$$;
revoke all on function public.validated_regulatory_source_catalog() from public,anon;
grant execute on function public.validated_regulatory_source_catalog() to authenticated;
