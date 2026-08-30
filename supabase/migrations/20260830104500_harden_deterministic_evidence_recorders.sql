-- Harden deterministic state-rule evidence so trusted server functions, not caller-supplied
-- hashes or observed fixture outcomes, create release evidence.

-- The service role may read controlled evidence, but direct writes are retired.
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_source_extraction_assessments from service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_deterministic_rules from service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_test_fixtures from service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_source_conflicts from service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_pack_release_assessments from service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_release_approval_events from service_role;

grant select on table public.state_rule_source_extraction_assessments to service_role;
grant select on table public.state_rule_deterministic_rules to service_role;
grant select on table public.state_rule_test_fixtures to service_role;
grant select on table public.state_rule_source_conflicts to service_role;
grant select on table public.state_rule_pack_release_assessments to service_role;
grant select on table public.state_rule_release_approval_events to service_role;

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
  v_hash text;
  v_id uuid;
begin
  if v_status not in (
    'RULES_EXTRACTED','REFERENCE_DATA_EXTRACTED','INDEX_ONLY',
    'NO_EXECUTABLE_RULES','BLOCKED'
  ) then
    raise exception 'unsupported source assessment status';
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
    'validator_build',btrim(p_validator_build),
    'evidence',p_evidence
  )::text,'UTF8'),'sha256'),'hex');

  insert into public.state_rule_source_extraction_assessments(
    source_candidate_id,source_sha256,assessment_status,validator_build,evidence,assessment_sha256
  ) values (
    v_source.id,v_source.source_sha256,v_status,btrim(p_validator_build),p_evidence,v_hash
  ) returning id into v_id;

  return jsonb_build_object(
    'assessment_id',v_id,
    'source_candidate_id',v_source.id,
    'source_sha256',v_source.source_sha256,
    'assessment_status',v_status,
    'assessment_sha256',v_hash
  );
end;
$$;
revoke all on function public.record_state_rule_source_assessment(uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_state_rule_source_assessment(uuid,text,text,jsonb)
  to service_role;

create or replace function public.record_state_deterministic_rule(
  p_pack_candidate_id uuid,
  p_source_candidate_id uuid,
  p_program_code text,
  p_rule_key text,
  p_rule_version text,
  p_topic text,
  p_source_page integer,
  p_citation text,
  p_operation_type text,
  p_input_schema jsonb,
  p_deterministic_operation jsonb,
  p_effective_from date,
  p_effective_to date,
  p_validator_build text,
  p_extraction_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pack public.state_rule_pack_candidates%rowtype;
  v_source record;
  v_operation_type text := upper(btrim(coalesce(p_operation_type,'')));
  v_hash text;
  v_id uuid;
begin
  select * into v_pack from public.state_rule_pack_candidates where id=p_pack_candidate_id;
  if not found or v_pack.state_code='US' then raise exception 'state pack not found'; end if;

  select * into v_source
  from public.state_rule_release_current_sources(v_pack.id)
  where source_candidate_id=p_source_candidate_id;
  if not found then raise exception 'rule source is not in the current verified source snapshot'; end if;

  if nullif(btrim(coalesce(p_program_code,'')),'') is null
     or nullif(btrim(coalesce(p_rule_key,'')),'') is null
     or nullif(btrim(coalesce(p_rule_version,'')),'') is null
     or nullif(btrim(coalesce(p_topic,'')),'') is null
     or nullif(btrim(coalesce(p_citation,'')),'') is null
     or p_source_page is null or p_source_page < 1
     or p_effective_from is null
     or (p_effective_to is not null and p_effective_to < p_effective_from)
     or char_length(btrim(coalesce(p_validator_build,''))) < 3 then
    raise exception 'deterministic rule metadata is incomplete';
  end if;
  if v_operation_type not in (
    'REQUIRE_DOCUMENT','COMPARE_NUMBER','REQUIRE_DATE_ON_OR_BEFORE','REQUIRE_BOOLEAN',
    'REQUIRE_ENUM','CALCULATE_LIMIT','REQUIRE_IF','PROHIBIT_IF','REFERENCE_LIMIT_TABLE'
  ) then raise exception 'unsupported deterministic operation type'; end if;
  if p_input_schema is null or jsonb_typeof(p_input_schema)<>'object'
     or p_deterministic_operation is null or jsonb_typeof(p_deterministic_operation)<>'object'
     or p_extraction_evidence is null or jsonb_typeof(p_extraction_evidence)<>'object' then
    raise exception 'rule schemas and evidence must be JSON objects';
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'pack_candidate_id',v_pack.id,
    'state_code',v_pack.state_code,
    'program_code',upper(btrim(p_program_code)),
    'rule_key',btrim(p_rule_key),
    'rule_version',btrim(p_rule_version),
    'topic',btrim(p_topic),
    'source_candidate_id',v_source.source_candidate_id,
    'source_sha256',v_source.source_sha256,
    'source_page',p_source_page,
    'citation',btrim(p_citation),
    'operation_type',v_operation_type,
    'input_schema',p_input_schema,
    'deterministic_operation',p_deterministic_operation,
    'effective_from',p_effective_from,
    'effective_to',p_effective_to,
    'validator_build',btrim(p_validator_build),
    'extraction_evidence',p_extraction_evidence
  )::text,'UTF8'),'sha256'),'hex');

  insert into public.state_rule_deterministic_rules(
    pack_candidate_id,source_candidate_id,source_sha256,state_code,program_code,
    rule_key,rule_version,topic,source_page,citation,operation_type,input_schema,
    deterministic_operation,effective_from,effective_to,validation_status,
    validator_build,extraction_evidence,rule_sha256
  ) values (
    v_pack.id,v_source.source_candidate_id,v_source.source_sha256,v_pack.state_code,
    upper(btrim(p_program_code)),btrim(p_rule_key),btrim(p_rule_version),btrim(p_topic),
    p_source_page,btrim(p_citation),v_operation_type,p_input_schema,p_deterministic_operation,
    p_effective_from,p_effective_to,'VALIDATED',btrim(p_validator_build),p_extraction_evidence,v_hash
  ) returning id into v_id;

  return jsonb_build_object(
    'rule_id',v_id,'state_code',v_pack.state_code,'rule_key',btrim(p_rule_key),
    'source_candidate_id',v_source.source_candidate_id,'source_sha256',v_source.source_sha256,
    'rule_sha256',v_hash
  );
end;
$$;
revoke all on function public.record_state_deterministic_rule(
  uuid,uuid,text,text,text,text,integer,text,text,jsonb,jsonb,date,date,text,jsonb
) from public, anon, authenticated;
grant execute on function public.record_state_deterministic_rule(
  uuid,uuid,text,text,text,text,integer,text,text,jsonb,jsonb,date,date,text,jsonb
) to service_role;

create or replace function public.evaluate_state_deterministic_rule(
  p_rule_id uuid,
  p_input_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rule public.state_rule_deterministic_rules%rowtype;
  op jsonb;
  left_text text;
  right_text text;
  field_text text;
  left_num numeric;
  right_num numeric;
  actual_num numeric;
  expected_num numeric;
  subtract_key text;
  date_left date;
  date_right date;
  required_bool boolean;
  actual_bool boolean;
  condition_matches boolean;
  requirement_matches boolean;
  outcome text;
  detail jsonb := '{}'::jsonb;
begin
  if p_input_data is null or jsonb_typeof(p_input_data)<>'object' then
    return jsonb_build_object('outcome','NOT_DETERMINED','reason','INPUT_DATA_NOT_OBJECT');
  end if;

  select * into v_rule from public.state_rule_deterministic_rules where id=p_rule_id;
  if not found or v_rule.validation_status<>'VALIDATED' then
    return jsonb_build_object('outcome','NOT_DETERMINED','reason','RULE_NOT_VALIDATED');
  end if;
  if not exists(
    select 1 from public.state_rule_release_current_sources(v_rule.pack_candidate_id) source
    where source.source_candidate_id=v_rule.source_candidate_id
      and source.source_sha256=v_rule.source_sha256
  ) then
    return jsonb_build_object('outcome','NOT_DETERMINED','reason','RULE_SOURCE_NOT_CURRENT');
  end if;

  op := v_rule.deterministic_operation;

  if v_rule.operation_type in ('COMPARE_NUMBER','REFERENCE_LIMIT_TABLE') then
    if nullif(op->>'left_field','') is null or nullif(op->>'operator','') is null then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION');
    end if;
    left_text := p_input_data->>(op->>'left_field');
    if op ? 'right_field' then right_text := p_input_data->>(op->>'right_field');
    else right_text := op->>'right_value'; end if;
    if left_text is null or right_text is null
       or left_text !~ '^-?[0-9]+([.][0-9]+)?$'
       or right_text !~ '^-?[0-9]+([.][0-9]+)?$' then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','NUMERIC_INPUT_MISSING_OR_INVALID');
    end if;
    left_num := left_text::numeric; right_num := right_text::numeric;
    outcome := case upper(op->>'operator')
      when 'LTE' then case when left_num<=right_num then 'PASS' else 'FAIL' end
      when 'LT'  then case when left_num< right_num then 'PASS' else 'FAIL' end
      when 'GTE' then case when left_num>=right_num then 'PASS' else 'FAIL' end
      when 'GT'  then case when left_num> right_num then 'PASS' else 'FAIL' end
      when 'EQ'  then case when left_num= right_num then 'PASS' else 'FAIL' end
      else 'NOT_DETERMINED' end;
    detail := jsonb_build_object('left',left_num,'operator',upper(op->>'operator'),'right',right_num);

  elsif v_rule.operation_type in ('REQUIRE_BOOLEAN','REQUIRE_DOCUMENT') then
    if nullif(op->>'field','') is null then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION');
    end if;
    field_text := lower(p_input_data->>(op->>'field'));
    if field_text not in ('true','false') then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','BOOLEAN_INPUT_MISSING_OR_INVALID');
    end if;
    actual_bool := field_text::boolean;
    required_bool := coalesce((op->>'required')::boolean,true);
    outcome := case when actual_bool=required_bool then 'PASS' else 'FAIL' end;
    detail := jsonb_build_object('field',op->>'field','actual',actual_bool,'required',required_bool);

  elsif v_rule.operation_type='REQUIRE_ENUM' then
    if nullif(op->>'field','') is null or jsonb_typeof(op->'allowed')<>'array' then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION');
    end if;
    field_text := p_input_data->>(op->>'field');
    if field_text is null then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','ENUM_INPUT_MISSING');
    end if;
    outcome := case when exists(select 1 from jsonb_array_elements_text(op->'allowed') a(value) where a.value=field_text)
      then 'PASS' else 'FAIL' end;
    detail := jsonb_build_object('field',op->>'field','actual',field_text,'allowed',op->'allowed');

  elsif v_rule.operation_type='REQUIRE_DATE_ON_OR_BEFORE' then
    if nullif(op->>'date_field','') is null then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION');
    end if;
    left_text := p_input_data->>(op->>'date_field');
    if op ? 'deadline_field' then right_text:=p_input_data->>(op->>'deadline_field');
    else right_text:=op->>'deadline_value'; end if;
    begin date_left:=left_text::date; date_right:=right_text::date;
    exception when others then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','DATE_INPUT_MISSING_OR_INVALID');
    end;
    outcome := case when date_left<=date_right then 'PASS' else 'FAIL' end;
    detail := jsonb_build_object('date',date_left,'deadline',date_right);

  elsif v_rule.operation_type='PROHIBIT_IF' then
    if nullif(op->>'condition_field','') is null or not (op ? 'condition_value') then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION');
    end if;
    if not (p_input_data ? (op->>'condition_field')) then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','CONDITION_INPUT_MISSING');
    end if;
    condition_matches := p_input_data->(op->>'condition_field') = op->'condition_value';
    if not condition_matches then outcome:='PASS';
    elsif op ? 'unless_field' then
      if not (p_input_data ? (op->>'unless_field')) then
        return jsonb_build_object('outcome','NOT_DETERMINED','reason','EXCEPTION_INPUT_MISSING');
      end if;
      outcome := case when p_input_data->(op->>'unless_field') = op->'unless_value' then 'PASS' else 'FAIL' end;
    else outcome:='FAIL'; end if;
    detail := jsonb_build_object('condition_matches',condition_matches,'condition_field',op->>'condition_field','unless_field',op->>'unless_field');

  elsif v_rule.operation_type='REQUIRE_IF' then
    if nullif(op->>'condition_field','') is null or not (op ? 'condition_value')
       or nullif(op->>'required_field','') is null or not (op ? 'required_value') then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION');
    end if;
    if not (p_input_data ? (op->>'condition_field')) then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','CONDITION_INPUT_MISSING');
    end if;
    condition_matches := p_input_data->(op->>'condition_field') = op->'condition_value';
    if not condition_matches then outcome:='PASS';
    else
      if not (p_input_data ? (op->>'required_field')) then
        return jsonb_build_object('outcome','NOT_DETERMINED','reason','REQUIRED_INPUT_MISSING');
      end if;
      requirement_matches := p_input_data->(op->>'required_field') = op->'required_value';
      outcome := case when requirement_matches then 'PASS' else 'FAIL' end;
    end if;
    detail := jsonb_build_object('condition_matches',condition_matches,'requirement_matches',requirement_matches);

  elsif v_rule.operation_type='CALCULATE_LIMIT' then
    if nullif(op->>'base_field','') is null or nullif(op->>'actual_field','') is null
       or jsonb_typeof(op->'subtract_fields')<>'array' then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION');
    end if;
    left_text:=p_input_data->>(op->>'base_field');
    field_text:=p_input_data->>(op->>'actual_field');
    if left_text is null or field_text is null
       or left_text !~ '^-?[0-9]+([.][0-9]+)?$'
       or field_text !~ '^-?[0-9]+([.][0-9]+)?$' then
      return jsonb_build_object('outcome','NOT_DETERMINED','reason','NUMERIC_INPUT_MISSING_OR_INVALID');
    end if;
    expected_num:=left_text::numeric; actual_num:=field_text::numeric;
    for subtract_key in select value from jsonb_array_elements_text(op->'subtract_fields') loop
      right_text:=p_input_data->>subtract_key;
      if right_text is null or right_text !~ '^-?[0-9]+([.][0-9]+)?$' then
        return jsonb_build_object('outcome','NOT_DETERMINED','reason','SUBTRACTION_INPUT_MISSING_OR_INVALID','field',subtract_key);
      end if;
      expected_num:=expected_num-right_text::numeric;
    end loop;
    outcome:=case when actual_num<=expected_num then 'PASS' else 'FAIL' end;
    detail:=jsonb_build_object('actual',actual_num,'calculated_limit',expected_num);

  else
    return jsonb_build_object('outcome','NOT_DETERMINED','reason','UNSUPPORTED_RULE_OPERATION');
  end if;

  return jsonb_build_object(
    'outcome',outcome,
    'rule_id',v_rule.id,
    'rule_key',v_rule.rule_key,
    'rule_sha256',v_rule.rule_sha256,
    'detail',detail
  );
exception
  when others then
    return jsonb_build_object('outcome','NOT_DETERMINED','reason','DETERMINISTIC_EVALUATION_ERROR');
end;
$$;
revoke all on function public.evaluate_state_deterministic_rule(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.evaluate_state_deterministic_rule(uuid,jsonb)
  to service_role;

create or replace function public.record_state_rule_fixture(
  p_rule_id uuid,
  p_fixture_key text,
  p_fixture_kind text,
  p_input_data jsonb,
  p_expected_outcome text,
  p_expected_output jsonb,
  p_validator_build text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rule public.state_rule_deterministic_rules%rowtype;
  v_kind text := upper(btrim(coalesce(p_fixture_kind,'')));
  v_expected text := upper(btrim(coalesce(p_expected_outcome,'')));
  v_observed jsonb;
  v_observed_outcome text;
  v_passed boolean;
  v_hash text;
  v_id uuid;
begin
  select * into v_rule from public.state_rule_deterministic_rules where id=p_rule_id;
  if not found or v_rule.validation_status<>'VALIDATED' then raise exception 'validated rule not found'; end if;
  if v_kind not in ('POSITIVE','NEGATIVE','BOUNDARY','LAYERED_PROGRAM','SUPERSESSION') then
    raise exception 'invalid fixture kind';
  end if;
  if v_expected not in ('PASS','FAIL','NOT_DETERMINED') then raise exception 'invalid expected outcome'; end if;
  if nullif(btrim(coalesce(p_fixture_key,'')),'') is null
     or p_input_data is null or jsonb_typeof(p_input_data)<>'object'
     or coalesce(p_expected_output,'{}'::jsonb) is null
     or char_length(btrim(coalesce(p_validator_build,'')))<3 then
    raise exception 'fixture metadata is incomplete';
  end if;

  v_observed:=public.evaluate_state_deterministic_rule(v_rule.id,p_input_data);
  v_observed_outcome:=v_observed->>'outcome';
  if v_observed_outcome not in ('PASS','FAIL','NOT_DETERMINED') then
    raise exception 'deterministic evaluator returned invalid outcome';
  end if;
  v_passed:=v_expected=v_observed_outcome;

  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'rule_id',v_rule.id,'rule_sha256',v_rule.rule_sha256,
    'fixture_key',btrim(p_fixture_key),'fixture_kind',v_kind,
    'input_data',p_input_data,'expected_outcome',v_expected,
    'observed_outcome',v_observed_outcome,'expected_output',coalesce(p_expected_output,'{}'::jsonb),
    'observed_output',v_observed,'passed',v_passed,'validator_build',btrim(p_validator_build)
  )::text,'UTF8'),'sha256'),'hex');

  insert into public.state_rule_test_fixtures(
    pack_candidate_id,rule_id,fixture_key,fixture_kind,input_data,expected_outcome,
    observed_outcome,expected_output,observed_output,passed,validator_build,fixture_sha256
  ) values (
    v_rule.pack_candidate_id,v_rule.id,btrim(p_fixture_key),v_kind,p_input_data,v_expected,
    v_observed_outcome,coalesce(p_expected_output,'{}'::jsonb),v_observed,v_passed,btrim(p_validator_build),v_hash
  ) returning id into v_id;

  return jsonb_build_object(
    'fixture_id',v_id,'rule_id',v_rule.id,'fixture_key',btrim(p_fixture_key),
    'fixture_kind',v_kind,'expected_outcome',v_expected,'observed_outcome',v_observed_outcome,
    'passed',v_passed,'fixture_sha256',v_hash
  );
end;
$$;
revoke all on function public.record_state_rule_fixture(uuid,text,text,jsonb,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.record_state_rule_fixture(uuid,text,text,jsonb,text,jsonb,text)
  to service_role;

create or replace function public.record_state_rule_conflict(
  p_pack_candidate_id uuid,
  p_conflict_key text,
  p_source_candidate_ids uuid[],
  p_conflict_type text,
  p_description text,
  p_resolution_status text,
  p_resolution_citation text default null,
  p_resolved_by uuid default null,
  p_resolved_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_type text:=upper(btrim(coalesce(p_conflict_type,'')));
  v_status text:=upper(btrim(coalesce(p_resolution_status,'')));
  v_source_id uuid;
  v_hash text;
  v_id uuid;
begin
  if not exists(select 1 from public.state_rule_pack_candidates where id=p_pack_candidate_id and state_code<>'US') then
    raise exception 'state pack not found';
  end if;
  if v_type not in ('CURRENCY','SUPERSESSION','SUBSTANTIVE','APPLICABILITY')
     or v_status not in ('RESOLVED','UNRESOLVED')
     or nullif(btrim(coalesce(p_conflict_key,'')),'') is null
     or nullif(btrim(coalesce(p_description,'')),'') is null then
    raise exception 'conflict metadata is incomplete';
  end if;
  foreach v_source_id in array coalesce(p_source_candidate_ids,'{}'::uuid[]) loop
    if not exists(select 1 from public.state_rule_release_current_sources(p_pack_candidate_id) s where s.source_candidate_id=v_source_id) then
      raise exception 'conflict source is not in current source snapshot';
    end if;
  end loop;
  if v_status='RESOLVED' and (
    nullif(btrim(coalesce(p_resolution_citation,'')),'') is null or p_resolved_by is null or p_resolved_at is null
  ) then raise exception 'resolved conflict requires citation, resolver, and timestamp'; end if;

  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'pack_candidate_id',p_pack_candidate_id,'conflict_key',btrim(p_conflict_key),
    'source_candidate_ids',coalesce(p_source_candidate_ids,'{}'::uuid[]),'conflict_type',v_type,
    'description',btrim(p_description),'resolution_status',v_status,
    'resolution_citation',nullif(btrim(coalesce(p_resolution_citation,'')),''),
    'resolved_by',p_resolved_by,'resolved_at',p_resolved_at
  )::text,'UTF8'),'sha256'),'hex');

  insert into public.state_rule_source_conflicts(
    pack_candidate_id,conflict_key,source_candidate_ids,conflict_type,description,
    resolution_status,resolution_citation,resolved_by,resolved_at,conflict_sha256
  ) values (
    p_pack_candidate_id,btrim(p_conflict_key),coalesce(p_source_candidate_ids,'{}'::uuid[]),v_type,
    btrim(p_description),v_status,nullif(btrim(coalesce(p_resolution_citation,'')),''),
    p_resolved_by,p_resolved_at,v_hash
  ) returning id into v_id;

  return jsonb_build_object('conflict_id',v_id,'conflict_key',btrim(p_conflict_key),
    'resolution_status',v_status,'conflict_sha256',v_hash);
end;
$$;
revoke all on function public.record_state_rule_conflict(uuid,text,uuid[],text,text,text,text,uuid,timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_state_rule_conflict(uuid,text,uuid[],text,text,text,text,uuid,timestamptz)
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
  if not exists(select 1 from public.state_rule_pack_candidates where id=p_pack_candidate_id and state_code<>'US') then
    raise exception 'state pack not found';
  end if;
  if char_length(btrim(coalesce(p_validator_build,'')))<3
     or p_evidence is null or jsonb_typeof(p_evidence)<>'object' then
    raise exception 'pack assessment metadata is incomplete';
  end if;
  if p_conflict_inventory_complete and (
    jsonb_typeof(p_evidence->'conflict_scan')<>'object'
    or coalesce(p_evidence->'conflict_scan'->>'scope','')<>'CURRENT_SOURCE_SNAPSHOT'
  ) then raise exception 'complete conflict inventory requires current-source conflict scan evidence'; end if;

  select * into v_snapshot from public.state_rule_pack_source_snapshot(p_pack_candidate_id);
  select count(*)::integer into v_source_count from public.state_rule_release_current_sources(p_pack_candidate_id);

  with current_sources as (
    select * from public.state_rule_release_current_sources(p_pack_candidate_id)
  ), latest_assessment as (
    select distinct on (a.source_candidate_id) a.*
    from public.state_rule_source_extraction_assessments a
    order by a.source_candidate_id,a.created_at desc,a.id desc
  )
  select count(*)::integer into v_assessed_count
  from current_sources s join latest_assessment a
    on a.source_candidate_id=s.source_candidate_id and a.source_sha256=s.source_sha256
  where a.assessment_status<>'BLOCKED'
    and (a.assessment_status<>'RULES_EXTRACTED' or exists(
      select 1 from public.state_rule_deterministic_rules r
      where r.pack_candidate_id=p_pack_candidate_id and r.source_candidate_id=s.source_candidate_id
        and r.source_sha256=s.source_sha256 and r.validation_status='VALIDATED'
    ));
  v_source_extraction_complete:=v_source_count>0 and v_assessed_count=v_source_count;

  with latest_conflict as (
    select distinct on (c.conflict_key) c.* from public.state_rule_source_conflicts c
    where c.pack_candidate_id=p_pack_candidate_id
    order by c.conflict_key,c.created_at desc,c.id desc
  ) select count(*) filter(where resolution_status='UNRESOLVED')::integer into v_unresolved from latest_conflict;
  if p_conflict_inventory_complete and coalesce(v_unresolved,0)<>0 then
    raise exception 'conflict inventory cannot be complete with unresolved conflicts';
  end if;

  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'pack_candidate_id',p_pack_candidate_id,'source_snapshot_sha256',v_snapshot.source_snapshot_sha256,
    'source_count',v_source_count,'assessed_source_count',v_assessed_count,
    'source_extraction_complete',v_source_extraction_complete,
    'conflict_inventory_complete',p_conflict_inventory_complete,
    'unresolved_conflict_count',coalesce(v_unresolved,0),'validator_build',btrim(p_validator_build),
    'evidence',p_evidence
  )::text,'UTF8'),'sha256'),'hex');

  insert into public.state_rule_pack_release_assessments(
    pack_candidate_id,source_snapshot_sha256,source_extraction_complete,
    conflict_inventory_complete,validator_build,evidence,assessment_sha256
  ) values (
    p_pack_candidate_id,v_snapshot.source_snapshot_sha256,v_source_extraction_complete,
    p_conflict_inventory_complete,btrim(p_validator_build),p_evidence || jsonb_build_object(
      'source_count',v_source_count,'assessed_source_count',v_assessed_count,
      'unresolved_conflict_count',coalesce(v_unresolved,0)
    ),v_hash
  ) returning id into v_id;

  perform public.refresh_state_rule_release_work_item(p_pack_candidate_id);

  return jsonb_build_object(
    'assessment_id',v_id,'source_snapshot_sha256',v_snapshot.source_snapshot_sha256,
    'source_extraction_complete',v_source_extraction_complete,
    'conflict_inventory_complete',p_conflict_inventory_complete,
    'assessment_sha256',v_hash
  );
end;
$$;
revoke all on function public.record_state_rule_pack_assessment(uuid,boolean,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_state_rule_pack_assessment(uuid,boolean,text,jsonb)
  to service_role;
