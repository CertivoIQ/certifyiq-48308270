-- Prevent partial source extraction from satisfying a deterministic state-pack release.

alter table public.state_rule_source_extraction_assessments
  add column if not exists coverage_status text not null default 'PARTIAL'
  check (coverage_status in ('PARTIAL','COMPLETE'));

create or replace function public.record_state_rule_source_assessment(
  p_source_candidate_id uuid,
  p_assessment_status text,
  p_validator_build text,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_source public.state_rule_source_candidates%rowtype;
  v_status text := upper(btrim(coalesce(p_assessment_status,'')));
  v_coverage text := upper(btrim(coalesce(p_evidence->>'coverage_status','')));
  v_hash text;
  v_id uuid;
begin
  if v_status not in (
    'RULES_EXTRACTED','REFERENCE_DATA_EXTRACTED','INDEX_ONLY',
    'NO_EXECUTABLE_RULES','BLOCKED'
  ) then raise exception 'unsupported source assessment status'; end if;
  if v_coverage not in ('PARTIAL','COMPLETE') then
    raise exception 'source assessment evidence must declare coverage_status PARTIAL or COMPLETE';
  end if;
  if char_length(btrim(coalesce(p_validator_build,''))) < 3 then
    raise exception 'validator build is required';
  end if;
  if p_evidence is null or jsonb_typeof(p_evidence) <> 'object' then
    raise exception 'assessment evidence must be a JSON object';
  end if;

  select * into v_source
  from public.state_rule_source_candidates
  where id = p_source_candidate_id;
  if not found then raise exception 'source candidate not found'; end if;
  if v_source.agent_verification_status <> 'verified'
     or not v_source.exact_bytes_captured
     or v_source.source_sha256 is null
     or v_source.source_sha256 !~ '^[0-9a-f]{64}$'
     or v_source.retrieved_at is null then
    raise exception 'source must be a currently verified exact-byte capture';
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'source_candidate_id',v_source.id,
    'source_sha256',v_source.source_sha256,
    'assessment_status',v_status,
    'coverage_status',v_coverage,
    'validator_build',btrim(p_validator_build),
    'evidence',p_evidence
  )::text,'UTF8'),'sha256'),'hex');

  insert into public.state_rule_source_extraction_assessments(
    source_candidate_id,source_sha256,assessment_status,coverage_status,
    validator_build,evidence,assessment_sha256
  ) values (
    v_source.id,v_source.source_sha256,v_status,v_coverage,
    btrim(p_validator_build),p_evidence,v_hash
  ) returning id into v_id;

  return jsonb_build_object(
    'assessment_id',v_id,
    'source_candidate_id',v_source.id,
    'source_sha256',v_source.source_sha256,
    'assessment_status',v_status,
    'coverage_status',v_coverage,
    'assessment_sha256',v_hash
  );
end;
$$;

revoke all on function public.record_state_rule_source_assessment(uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_state_rule_source_assessment(uuid,text,text,jsonb)
  to service_role;

create or replace function public.record_state_rule_pack_assessment(
  p_pack_candidate_id uuid,
  p_conflict_inventory_complete boolean,
  p_validator_build text,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_snapshot record;
  v_source_count integer;
  v_assessed_count integer;
  v_source_extraction_complete boolean;
  v_unresolved integer;
  v_hash text;
  v_id uuid;
begin
  if not exists(
    select 1 from public.state_rule_pack_candidates
    where id=p_pack_candidate_id and state_code<>'US'
  ) then raise exception 'state pack not found'; end if;
  if char_length(btrim(coalesce(p_validator_build,'')))<3
     or p_evidence is null or jsonb_typeof(p_evidence)<>'object' then
    raise exception 'pack assessment metadata is incomplete';
  end if;
  if p_conflict_inventory_complete and (
    jsonb_typeof(p_evidence->'conflict_scan')<>'object'
    or coalesce(p_evidence->'conflict_scan'->>'scope','')<>'CURRENT_SOURCE_SNAPSHOT'
  ) then
    raise exception 'complete conflict inventory requires current-source conflict scan evidence';
  end if;

  select * into v_snapshot
  from public.state_rule_pack_source_snapshot(p_pack_candidate_id);
  select count(*)::integer into v_source_count
  from public.state_rule_release_current_sources(p_pack_candidate_id);

  with current_sources as (
    select * from public.state_rule_release_current_sources(p_pack_candidate_id)
  ), latest_assessment as (
    select distinct on (a.source_candidate_id) a.*
    from public.state_rule_source_extraction_assessments a
    order by a.source_candidate_id,a.created_at desc,a.id desc
  )
  select count(*)::integer into v_assessed_count
  from current_sources s
  join latest_assessment a
    on a.source_candidate_id=s.source_candidate_id
   and a.source_sha256=s.source_sha256
  where a.assessment_status<>'BLOCKED'
    and a.coverage_status='COMPLETE'
    and (
      a.assessment_status<>'RULES_EXTRACTED'
      or exists(
        select 1 from public.state_rule_deterministic_rules r
        where r.pack_candidate_id=p_pack_candidate_id
          and r.source_candidate_id=s.source_candidate_id
          and r.source_sha256=s.source_sha256
          and r.validation_status='VALIDATED'
      )
    );

  v_source_extraction_complete := v_source_count>0 and v_assessed_count=v_source_count;

  with latest_conflict as (
    select distinct on (c.conflict_key) c.*
    from public.state_rule_source_conflicts c
    where c.pack_candidate_id=p_pack_candidate_id
    order by c.conflict_key,c.created_at desc,c.id desc
  )
  select count(*) filter(where resolution_status='UNRESOLVED')::integer
  into v_unresolved
  from latest_conflict;

  if p_conflict_inventory_complete and coalesce(v_unresolved,0)<>0 then
    raise exception 'conflict inventory cannot be complete with unresolved conflicts';
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'pack_candidate_id',p_pack_candidate_id,
    'source_snapshot_sha256',v_snapshot.source_snapshot_sha256,
    'source_count',v_source_count,
    'complete_assessed_source_count',v_assessed_count,
    'source_extraction_complete',v_source_extraction_complete,
    'conflict_inventory_complete',p_conflict_inventory_complete,
    'unresolved_conflict_count',coalesce(v_unresolved,0),
    'validator_build',btrim(p_validator_build),
    'evidence',p_evidence
  )::text,'UTF8'),'sha256'),'hex');

  insert into public.state_rule_pack_release_assessments(
    pack_candidate_id,source_snapshot_sha256,source_extraction_complete,
    conflict_inventory_complete,validator_build,evidence,assessment_sha256
  ) values (
    p_pack_candidate_id,v_snapshot.source_snapshot_sha256,v_source_extraction_complete,
    p_conflict_inventory_complete,btrim(p_validator_build),
    p_evidence || jsonb_build_object(
      'source_count',v_source_count,
      'complete_assessed_source_count',v_assessed_count,
      'unresolved_conflict_count',coalesce(v_unresolved,0)
    ),v_hash
  ) returning id into v_id;

  perform public.refresh_state_rule_release_work_item(p_pack_candidate_id);

  return jsonb_build_object(
    'assessment_id',v_id,
    'source_snapshot_sha256',v_snapshot.source_snapshot_sha256,
    'source_extraction_complete',v_source_extraction_complete,
    'complete_assessed_source_count',v_assessed_count,
    'source_count',v_source_count,
    'conflict_inventory_complete',p_conflict_inventory_complete,
    'assessment_sha256',v_hash
  );
end;
$$;

revoke all on function public.record_state_rule_pack_assessment(uuid,boolean,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_state_rule_pack_assessment(uuid,boolean,text,jsonb)
  to service_role;
