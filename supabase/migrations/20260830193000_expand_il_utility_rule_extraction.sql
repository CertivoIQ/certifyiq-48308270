-- Expand the first Illinois rule-extraction batch while preserving immutable evidence history.
-- Prior validated rule versions are withdrawn only through an append-only supersession event.

create table if not exists public.state_rule_supersession_events (
  id uuid primary key default gen_random_uuid(),
  pack_candidate_id uuid not null references public.state_rule_pack_candidates(id) on delete restrict,
  rule_key text not null check (char_length(btrim(rule_key)) between 3 and 160),
  prior_rule_id uuid not null references public.state_rule_deterministic_rules(id) on delete restrict,
  replacement_rule_id uuid not null references public.state_rule_deterministic_rules(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 10 and 2000),
  validator_build text not null check (char_length(btrim(validator_build)) between 3 and 128),
  event_sha256 text not null check (event_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (prior_rule_id <> replacement_rule_id)
);

create unique index if not exists state_rule_supersession_prior_idx
  on public.state_rule_supersession_events(prior_rule_id);
create index if not exists state_rule_supersession_pack_key_idx
  on public.state_rule_supersession_events(pack_candidate_id, rule_key, created_at desc, id desc);

alter table public.state_rule_supersession_events enable row level security;
revoke all on table public.state_rule_supersession_events from public, anon, authenticated;
grant all on table public.state_rule_supersession_events to service_role;

create or replace function public.block_state_rule_release_evidence_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'state_rule_deterministic_rules'
     and tg_op = 'UPDATE'
     and current_setting('certivo.allow_rule_supersession', true) = 'on'
     and old.validation_status = 'VALIDATED'
     and new.validation_status = 'REJECTED'
     and (to_jsonb(old) - 'validation_status') = (to_jsonb(new) - 'validation_status') then
    return new;
  end if;
  raise exception 'Deterministic state-rule release evidence is append-only';
end;
$$;
revoke all on function public.block_state_rule_release_evidence_mutation() from public, anon, authenticated;
grant execute on function public.block_state_rule_release_evidence_mutation() to service_role;

drop trigger if exists block_mutation on public.state_rule_supersession_events;
create trigger block_mutation
before update or delete on public.state_rule_supersession_events
for each row execute function public.block_state_rule_release_evidence_mutation();

create or replace function public.supersede_state_deterministic_rule(
  p_prior_rule_id uuid,
  p_replacement_rule_id uuid,
  p_reason text,
  p_validator_build text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_prior public.state_rule_deterministic_rules%rowtype;
  v_replacement public.state_rule_deterministic_rules%rowtype;
  v_event_id uuid;
  v_hash text;
begin
  select * into v_prior from public.state_rule_deterministic_rules where id = p_prior_rule_id for update;
  select * into v_replacement from public.state_rule_deterministic_rules where id = p_replacement_rule_id;
  if v_prior.id is null or v_replacement.id is null then raise exception 'rule version not found'; end if;
  if v_prior.validation_status <> 'VALIDATED' or v_replacement.validation_status <> 'VALIDATED' then
    raise exception 'both rule versions must be validated before supersession';
  end if;
  if v_prior.pack_candidate_id <> v_replacement.pack_candidate_id or v_prior.rule_key <> v_replacement.rule_key then
    raise exception 'replacement must belong to the same pack and rule key';
  end if;
  if v_replacement.created_at < v_prior.created_at then raise exception 'replacement cannot predate prior rule'; end if;
  if char_length(btrim(coalesce(p_reason,''))) < 10 or char_length(btrim(coalesce(p_validator_build,''))) < 3 then
    raise exception 'supersession reason and validator build are required';
  end if;
  if not exists (
    select 1 from public.state_rule_release_current_sources(v_replacement.pack_candidate_id) source
    where source.source_candidate_id = v_replacement.source_candidate_id
      and source.source_sha256 = v_replacement.source_sha256
  ) then raise exception 'replacement source is not current'; end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'pack_candidate_id',v_prior.pack_candidate_id,'rule_key',v_prior.rule_key,
    'prior_rule_id',v_prior.id,'prior_rule_sha256',v_prior.rule_sha256,
    'replacement_rule_id',v_replacement.id,'replacement_rule_sha256',v_replacement.rule_sha256,
    'reason',btrim(p_reason),'validator_build',btrim(p_validator_build)
  )::text,'UTF8'),'sha256'),'hex');

  perform set_config('certivo.allow_rule_supersession','on',true);
  update public.state_rule_deterministic_rules set validation_status = 'REJECTED' where id = v_prior.id;
  perform set_config('certivo.allow_rule_supersession','off',true);

  insert into public.state_rule_supersession_events(
    pack_candidate_id,rule_key,prior_rule_id,replacement_rule_id,reason,validator_build,event_sha256
  ) values (
    v_prior.pack_candidate_id,v_prior.rule_key,v_prior.id,v_replacement.id,btrim(p_reason),btrim(p_validator_build),v_hash
  ) returning id into v_event_id;

  return jsonb_build_object('event_id',v_event_id,'rule_key',v_prior.rule_key,
    'prior_rule_id',v_prior.id,'replacement_rule_id',v_replacement.id,'event_sha256',v_hash);
end;
$$;
revoke all on function public.supersede_state_deterministic_rule(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.supersede_state_deterministic_rule(uuid,uuid,text,text) to service_role;

alter table public.state_rule_deterministic_rules
  drop constraint if exists state_rule_deterministic_rules_operation_type_check;
alter table public.state_rule_deterministic_rules
  add constraint state_rule_deterministic_rules_operation_type_check check (operation_type in (
    'REQUIRE_DOCUMENT','COMPARE_NUMBER','REQUIRE_DATE_ON_OR_BEFORE','REQUIRE_BOOLEAN',
    'REQUIRE_ENUM','CALCULATE_LIMIT','REQUIRE_IF','PROHIBIT_IF','REFERENCE_LIMIT_TABLE',
    'TABLE_LOOKUP_MINIMUM','PERCENT_CEILING_MINIMUM'
  ));

create or replace function public.record_state_deterministic_rule(
  p_pack_candidate_id uuid,p_source_candidate_id uuid,p_program_code text,p_rule_key text,
  p_rule_version text,p_topic text,p_source_page integer,p_citation text,p_operation_type text,
  p_input_schema jsonb,p_deterministic_operation jsonb,p_effective_from date,p_effective_to date,
  p_validator_build text,p_extraction_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_pack public.state_rule_pack_candidates%rowtype; v_source record; v_operation_type text:=upper(btrim(coalesce(p_operation_type,''))); v_hash text; v_id uuid;
begin
  select * into v_pack from public.state_rule_pack_candidates where id=p_pack_candidate_id;
  if not found or v_pack.state_code='US' then raise exception 'state pack not found'; end if;
  select * into v_source from public.state_rule_release_current_sources(v_pack.id) where source_candidate_id=p_source_candidate_id;
  if not found then raise exception 'rule source is not in the current verified source snapshot'; end if;
  if nullif(btrim(coalesce(p_program_code,'')),'') is null or nullif(btrim(coalesce(p_rule_key,'')),'') is null
     or nullif(btrim(coalesce(p_rule_version,'')),'') is null or nullif(btrim(coalesce(p_topic,'')),'') is null
     or nullif(btrim(coalesce(p_citation,'')),'') is null or p_source_page is null or p_source_page<1
     or p_effective_from is null or (p_effective_to is not null and p_effective_to<p_effective_from)
     or char_length(btrim(coalesce(p_validator_build,'')))<3 then raise exception 'deterministic rule metadata is incomplete'; end if;
  if v_operation_type not in('REQUIRE_DOCUMENT','COMPARE_NUMBER','REQUIRE_DATE_ON_OR_BEFORE','REQUIRE_BOOLEAN',
     'REQUIRE_ENUM','CALCULATE_LIMIT','REQUIRE_IF','PROHIBIT_IF','REFERENCE_LIMIT_TABLE',
     'TABLE_LOOKUP_MINIMUM','PERCENT_CEILING_MINIMUM') then raise exception 'unsupported deterministic operation type'; end if;
  if p_input_schema is null or jsonb_typeof(p_input_schema)<>'object' or p_deterministic_operation is null
     or jsonb_typeof(p_deterministic_operation)<>'object' or p_extraction_evidence is null
     or jsonb_typeof(p_extraction_evidence)<>'object' then raise exception 'rule schemas and evidence must be JSON objects'; end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'pack_candidate_id',v_pack.id,'state_code',v_pack.state_code,'program_code',upper(btrim(p_program_code)),
    'rule_key',btrim(p_rule_key),'rule_version',btrim(p_rule_version),'topic',btrim(p_topic),
    'source_candidate_id',v_source.source_candidate_id,'source_sha256',v_source.source_sha256,
    'source_page',p_source_page,'citation',btrim(p_citation),'operation_type',v_operation_type,
    'input_schema',p_input_schema,'deterministic_operation',p_deterministic_operation,
    'effective_from',p_effective_from,'effective_to',p_effective_to,'validator_build',btrim(p_validator_build),
    'extraction_evidence',p_extraction_evidence
  )::text,'UTF8'),'sha256'),'hex');
  insert into public.state_rule_deterministic_rules(
    pack_candidate_id,source_candidate_id,source_sha256,state_code,program_code,rule_key,rule_version,
    topic,source_page,citation,operation_type,input_schema,deterministic_operation,effective_from,effective_to,
    validation_status,validator_build,extraction_evidence,rule_sha256
  ) values (
    v_pack.id,v_source.source_candidate_id,v_source.source_sha256,v_pack.state_code,upper(btrim(p_program_code)),
    btrim(p_rule_key),btrim(p_rule_version),btrim(p_topic),p_source_page,btrim(p_citation),v_operation_type,
    p_input_schema,p_deterministic_operation,p_effective_from,p_effective_to,'VALIDATED',btrim(p_validator_build),
    p_extraction_evidence,v_hash
  ) returning id into v_id;
  return jsonb_build_object('rule_id',v_id,'state_code',v_pack.state_code,'rule_key',btrim(p_rule_key),
    'source_candidate_id',v_source.source_candidate_id,'source_sha256',v_source.source_sha256,'rule_sha256',v_hash);
end;
$$;
revoke all on function public.record_state_deterministic_rule(uuid,uuid,text,text,text,text,integer,text,text,jsonb,jsonb,date,date,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_state_deterministic_rule(uuid,uuid,text,text,text,text,integer,text,text,jsonb,jsonb,date,date,text,jsonb)
  to service_role;

create or replace function public.evaluate_state_deterministic_rule(p_rule_id uuid,p_input_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rule public.state_rule_deterministic_rules%rowtype; op jsonb; band jsonb;
  left_text text; right_text text; field_text text; subtract_key text;
  left_num numeric; right_num numeric; actual_num numeric; expected_num numeric; units_num numeric;
  date_left date; date_right date; required_bool boolean; actual_bool boolean;
  condition_matches boolean; requirement_matches boolean; outcome text; detail jsonb:='{}'::jsonb;
begin
  if p_input_data is null or jsonb_typeof(p_input_data)<>'object' then
    return jsonb_build_object('outcome','NOT_DETERMINED','reason','INPUT_DATA_NOT_OBJECT');
  end if;
  select * into v_rule from public.state_rule_deterministic_rules where id=p_rule_id;
  if not found or v_rule.validation_status<>'VALIDATED' then
    return jsonb_build_object('outcome','NOT_DETERMINED','reason','RULE_NOT_VALIDATED');
  end if;
  if not exists(select 1 from public.state_rule_release_current_sources(v_rule.pack_candidate_id) source
    where source.source_candidate_id=v_rule.source_candidate_id and source.source_sha256=v_rule.source_sha256) then
    return jsonb_build_object('outcome','NOT_DETERMINED','reason','RULE_SOURCE_NOT_CURRENT');
  end if;
  op:=v_rule.deterministic_operation;
  if v_rule.operation_type in('COMPARE_NUMBER','REFERENCE_LIMIT_TABLE') then
    if nullif(op->>'left_field','') is null or nullif(op->>'operator','') is null then return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION'); end if;
    left_text:=p_input_data->>(op->>'left_field'); if op ? 'right_field' then right_text:=p_input_data->>(op->>'right_field'); else right_text:=op->>'right_value'; end if;
    if left_text is null or right_text is null or left_text !~ '^-?[0-9]+([.][0-9]+)?$' or right_text !~ '^-?[0-9]+([.][0-9]+)?$' then return jsonb_build_object('outcome','NOT_DETERMINED','reason','NUMERIC_INPUT_MISSING_OR_INVALID'); end if;
    left_num:=left_text::numeric; right_num:=right_text::numeric;
    outcome:=case upper(op->>'operator') when 'LTE' then case when left_num<=right_num then 'PASS' else 'FAIL' end when 'LT' then case when left_num<right_num then 'PASS' else 'FAIL' end when 'GTE' then case when left_num>=right_num then 'PASS' else 'FAIL' end when 'GT' then case when left_num>right_num then 'PASS' else 'FAIL' end when 'EQ' then case when left_num=right_num then 'PASS' else 'FAIL' end else 'NOT_DETERMINED' end;
    detail:=jsonb_build_object('left',left_num,'operator',upper(op->>'operator'),'right',right_num);
  elsif v_rule.operation_type in('REQUIRE_BOOLEAN','REQUIRE_DOCUMENT') then
    if nullif(op->>'field','') is null then return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION'); end if;
    field_text:=lower(p_input_data->>(op->>'field')); if field_text not in('true','false') then return jsonb_build_object('outcome','NOT_DETERMINED','reason','BOOLEAN_INPUT_MISSING_OR_INVALID'); end if;
    actual_bool:=field_text::boolean; required_bool:=coalesce((op->>'required')::boolean,true);
    outcome:=case when actual_bool=required_bool then 'PASS' else 'FAIL' end;
    detail:=jsonb_build_object('field',op->>'field','actual',actual_bool,'required',required_bool);
  elsif v_rule.operation_type='REQUIRE_ENUM' then
    if nullif(op->>'field','') is null or jsonb_typeof(op->'allowed')<>'array' then return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION'); end if;
    field_text:=p_input_data->>(op->>'field'); if field_text is null then return jsonb_build_object('outcome','NOT_DETERMINED','reason','ENUM_INPUT_MISSING'); end if;
    outcome:=case when exists(select 1 from jsonb_array_elements_text(op->'allowed') a(value) where a.value=field_text) then 'PASS' else 'FAIL' end;
    detail:=jsonb_build_object('field',op->>'field','actual',field_text,'allowed',op->'allowed');
  elsif v_rule.operation_type='REQUIRE_DATE_ON_OR_BEFORE' then
    if nullif(op->>'date_field','') is null then return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION'); end if;
    left_text:=p_input_data->>(op->>'date_field'); if op ? 'deadline_field' then right_text:=p_input_data->>(op->>'deadline_field'); else right_text:=op->>'deadline_value'; end if;
    if left_text is null or right_text is null then return jsonb_build_object('outcome','NOT_DETERMINED','reason','DATE_INPUT_MISSING_OR_INVALID'); end if;
    begin date_left:=left_text::date; date_right:=right_text::date; exception when others then return jsonb_build_object('outcome','NOT_DETERMINED','reason','DATE_INPUT_MISSING_OR_INVALID'); end;
    outcome:=case when date_left<=date_right then 'PASS' else 'FAIL' end; detail:=jsonb_build_object('date',date_left,'deadline',date_right);
  elsif v_rule.operation_type='PROHIBIT_IF' then
    if nullif(op->>'condition_field','') is null or not(op ? 'condition_value') then return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION'); end if;
    if not(p_input_data ? (op->>'condition_field')) then return jsonb_build_object('outcome','NOT_DETERMINED','reason','CONDITION_INPUT_MISSING'); end if;
    condition_matches:=p_input_data->(op->>'condition_field')=op->'condition_value';
    if not condition_matches then outcome:='PASS'; elsif op ? 'unless_field' then if not(p_input_data ? (op->>'unless_field')) then return jsonb_build_object('outcome','NOT_DETERMINED','reason','EXCEPTION_INPUT_MISSING'); end if; outcome:=case when p_input_data->(op->>'unless_field')=op->'unless_value' then 'PASS' else 'FAIL' end; else outcome:='FAIL'; end if;
    detail:=jsonb_build_object('condition_matches',condition_matches,'condition_field',op->>'condition_field','unless_field',op->>'unless_field');
  elsif v_rule.operation_type='REQUIRE_IF' then
    if nullif(op->>'condition_field','') is null or not(op ? 'condition_value') or nullif(op->>'required_field','') is null or not(op ? 'required_value') then return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION'); end if;
    if not(p_input_data ? (op->>'condition_field')) then return jsonb_build_object('outcome','NOT_DETERMINED','reason','CONDITION_INPUT_MISSING'); end if;
    condition_matches:=p_input_data->(op->>'condition_field')=op->'condition_value';
    if not condition_matches then outcome:='PASS'; else if not(p_input_data ? (op->>'required_field')) then return jsonb_build_object('outcome','NOT_DETERMINED','reason','REQUIRED_INPUT_MISSING'); end if; requirement_matches:=p_input_data->(op->>'required_field')=op->'required_value'; outcome:=case when requirement_matches then 'PASS' else 'FAIL' end; end if;
    detail:=jsonb_build_object('condition_matches',condition_matches,'requirement_matches',requirement_matches);
  elsif v_rule.operation_type='CALCULATE_LIMIT' then
    if nullif(op->>'base_field','') is null or nullif(op->>'actual_field','') is null or jsonb_typeof(op->'subtract_fields')<>'array' then return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION'); end if;
    left_text:=p_input_data->>(op->>'base_field'); field_text:=p_input_data->>(op->>'actual_field');
    if left_text is null or field_text is null or left_text !~ '^-?[0-9]+([.][0-9]+)?$' or field_text !~ '^-?[0-9]+([.][0-9]+)?$' then return jsonb_build_object('outcome','NOT_DETERMINED','reason','NUMERIC_INPUT_MISSING_OR_INVALID'); end if;
    expected_num:=left_text::numeric; actual_num:=field_text::numeric;
    for subtract_key in select value from jsonb_array_elements_text(op->'subtract_fields') loop
      right_text:=p_input_data->>subtract_key; if right_text is null or right_text !~ '^-?[0-9]+([.][0-9]+)?$' then return jsonb_build_object('outcome','NOT_DETERMINED','reason','SUBTRACTION_INPUT_MISSING_OR_INVALID','field',subtract_key); end if; expected_num:=expected_num-right_text::numeric;
    end loop;
    outcome:=case when actual_num<=expected_num then 'PASS' else 'FAIL' end; detail:=jsonb_build_object('actual',actual_num,'calculated_limit',expected_num);
  elsif v_rule.operation_type='TABLE_LOOKUP_MINIMUM' then
    if nullif(op->>'units_field','') is null or nullif(op->>'actual_field','') is null or jsonb_typeof(op->'bands')<>'array' then return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION'); end if;
    left_text:=p_input_data->>(op->>'units_field'); field_text:=p_input_data->>(op->>'actual_field');
    if left_text is null or field_text is null or left_text !~ '^[0-9]+$' or field_text !~ '^[0-9]+$' then return jsonb_build_object('outcome','NOT_DETERMINED','reason','INTEGER_INPUT_MISSING_OR_INVALID'); end if;
    units_num:=left_text::numeric; actual_num:=field_text::numeric;
    select value into band from jsonb_array_elements(op->'bands') b(value)
      where units_num >= (value->>'min_units')::numeric
        and (not(value ? 'max_units') or units_num <= (value->>'max_units')::numeric)
      order by (value->>'min_units')::numeric desc limit 1;
    if band is null then return jsonb_build_object('outcome','NOT_DETERMINED','reason','NO_TABLE_BAND_MATCH'); end if;
    expected_num:=case when coalesce((band->>'all_units')::boolean,false) then units_num else (band->>'minimum_samples')::numeric end;
    outcome:=case when actual_num>=expected_num then 'PASS' else 'FAIL' end;
    detail:=jsonb_build_object('units',units_num,'actual_samples',actual_num,'minimum_samples',expected_num,'matched_band',band);
  elsif v_rule.operation_type='PERCENT_CEILING_MINIMUM' then
    if nullif(op->>'units_field','') is null or nullif(op->>'actual_field','') is null or nullif(op->>'percent','') is null or nullif(op->>'minimum_samples','') is null then return jsonb_build_object('outcome','NOT_DETERMINED','reason','INVALID_RULE_OPERATION'); end if;
    left_text:=p_input_data->>(op->>'units_field'); field_text:=p_input_data->>(op->>'actual_field');
    if left_text is null or field_text is null or left_text !~ '^[0-9]+$' or field_text !~ '^[0-9]+$' then return jsonb_build_object('outcome','NOT_DETERMINED','reason','INTEGER_INPUT_MISSING_OR_INVALID'); end if;
    units_num:=left_text::numeric; actual_num:=field_text::numeric;
    expected_num:=greatest(ceil(units_num*(op->>'percent')::numeric),(op->>'minimum_samples')::numeric);
    outcome:=case when actual_num>=expected_num then 'PASS' else 'FAIL' end;
    detail:=jsonb_build_object('units',units_num,'actual_samples',actual_num,'minimum_samples',expected_num,'percent',(op->>'percent')::numeric,'absolute_minimum',(op->>'minimum_samples')::numeric);
  else return jsonb_build_object('outcome','NOT_DETERMINED','reason','UNSUPPORTED_RULE_OPERATION'); end if;
  return jsonb_build_object('outcome',outcome,'rule_id',v_rule.id,'rule_key',v_rule.rule_key,'rule_sha256',v_rule.rule_sha256,'detail',detail);
exception when others then return jsonb_build_object('outcome','NOT_DETERMINED','reason','DETERMINISTIC_EVALUATION_ERROR'); end;
$$;
revoke all on function public.evaluate_state_deterministic_rule(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.evaluate_state_deterministic_rule(uuid,jsonb) to service_role;

do $$
declare
  v_pack uuid;
  v_manual uuid;
  v_utility uuid;
  v_build constant text := 'codex-il-rule-extraction-2026-08-30.2';
  v_result jsonb; v_rule_id uuid; v_prior_id uuid;
begin
  select id into strict v_pack from public.state_rule_pack_candidates
    where state_code='IL' order by inventory_generated_at desc limit 1;
  select source_candidate_id into strict v_manual from public.state_rule_release_current_sources(v_pack)
    where source_url='https://www.ihda.org/wp-content/uploads/2026/06/LIHTC-HOME-Manual-4-2026-FINAL-2.pdf'
      and source_sha256='b362d2cde02da437aced5af45646fa687f415446d3f6c19cfa0d2193ee086851';
  select source_candidate_id into strict v_utility from public.state_rule_release_current_sources(v_pack)
    where source_url='https://www.ihda.org/wp-content/uploads/2025/11/Instructions-for-Rent-Schedule-Utility-Allowance-Request-10-2025.pdf'
      and source_sha256='258990520bc93e300a8e4ecbb811ccc4c3eab6defdc4b97f7f81f550c2788099';
  select id into v_prior_id from public.state_rule_deterministic_rules
    where pack_candidate_id=v_pack and rule_key='IL-HOME-UA-METHOD' and validation_status='VALIDATED'
    order by created_at desc,id desc limit 1;
  v_result:=public.record_state_deterministic_rule(v_pack,v_manual,'HOME','IL-HOME-UA-METHOD','1.1.0',
    'HOME utility allowance method',67,'IHDA April 2026 LIHTC & HOME Compliance Manual §5.4.2, p.67',
    'REQUIRE_ENUM','{"required":["utility_allowance_method"]}'::jsonb,
    '{"field":"utility_allowance_method","allowed":["HUSM","HUD_MULTIFAMILY_UTILITY_ANALYSIS","UTILITY_COMPANY_ESTIMATE","LOCAL_PHA"]}'::jsonb,
    date '2026-01-01',null,v_build,
    '{"authority_locator":"§5.4.2 p.67","extraction_scope":"complete explicit HOME allowable utility methods","correction":"adds authority-listed utility company estimates"}'::jsonb);
  v_rule_id:=(v_result->>'rule_id')::uuid;
  perform public.supersede_state_deterministic_rule(v_prior_id,v_rule_id,
    'The prior enum omitted the authority-listed utility company estimate method on exact source page 67.',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-HOME-UA-METHOD-1.1-POS','POSITIVE','{"utility_allowance_method":"UTILITY_COMPANY_ESTIMATE"}', 'PASS','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-HOME-UA-METHOD-1.1-NEG','NEGATIVE','{"utility_allowance_method":"OWNER_ASSERTED_OTHER"}', 'FAIL','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-HOME-UA-METHOD-1.1-BOUND','BOUNDARY','{"utility_allowance_method":"LOCAL_PHA"}', 'PASS','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-HOME-UA-METHOD-1.1-SUPERSESSION','SUPERSESSION','{"utility_allowance_method":"UTILITY_COMPANY_ESTIMATE"}', 'PASS','{}',v_build);

  select id into v_prior_id from public.state_rule_deterministic_rules
    where pack_candidate_id=v_pack and rule_key='IL-UA-SAMPLE-SIZE-COMPLIANT' and validation_status='VALIDATED'
    order by created_at desc,id desc limit 1;
  v_result:=public.record_state_deterministic_rule(v_pack,v_utility,'IHDA_UA','IL-UA-SAMPLE-SIZE-COMPLIANT','1.1.0',
    'HUD Multifamily Housing Utility Analysis minimum sample size by bedroom size',2,
    'IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, Table 2, p.2',
    'TABLE_LOOKUP_MINIMUM','{"required":["units_per_bedroom_size","sampled_units_per_bedroom_size"]}'::jsonb,
    '{"units_field":"units_per_bedroom_size","actual_field":"sampled_units_per_bedroom_size","bands":[{"min_units":1,"max_units":20,"all_units":true},{"min_units":21,"max_units":61,"minimum_samples":20},{"min_units":62,"max_units":71,"minimum_samples":21},{"min_units":72,"max_units":83,"minimum_samples":22},{"min_units":84,"max_units":99,"minimum_samples":23},{"min_units":100,"max_units":120,"minimum_samples":24},{"min_units":121,"max_units":149,"minimum_samples":25},{"min_units":150,"max_units":191,"minimum_samples":26},{"min_units":192,"max_units":259,"minimum_samples":27},{"min_units":260,"max_units":388,"minimum_samples":28},{"min_units":389,"minimum_samples":29}]}'::jsonb,
    date '2026-01-01',null,v_build,
    '{"authority_locator":"p.2 Table 2","extraction_scope":"complete piecewise minimum sample table","correction":"replaces caller-asserted compliance boolean with source-derived calculation"}'::jsonb);
  v_rule_id:=(v_result->>'rule_id')::uuid;
  perform public.supersede_state_deterministic_rule(v_prior_id,v_rule_id,
    'The prior rule accepted a caller-computed compliance boolean instead of deterministically calculating the Table 2 minimum.',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-UA-SAMPLE-TABLE-1.1-POS','POSITIVE','{"units_per_bedroom_size":72,"sampled_units_per_bedroom_size":23}', 'PASS','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-UA-SAMPLE-TABLE-1.1-NEG','NEGATIVE','{"units_per_bedroom_size":72,"sampled_units_per_bedroom_size":21}', 'FAIL','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-UA-SAMPLE-TABLE-1.1-BOUND','BOUNDARY','{"units_per_bedroom_size":20,"sampled_units_per_bedroom_size":20}', 'PASS','{}',v_build);

  v_result:=public.record_state_deterministic_rule(v_pack,v_utility,'IHDA_OTHER','IL-UA-OTHER-SAMPLE-SIZE-10PCT-MIN8','1.0.0',
    'Other-program utility analysis minimum sample size by bedroom size',2,
    'IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, Table 1 Option 4, p.2',
    'PERCENT_CEILING_MINIMUM','{"required":["units_per_bedroom_size","sampled_units_per_bedroom_size"]}'::jsonb,
    '{"units_field":"units_per_bedroom_size","actual_field":"sampled_units_per_bedroom_size","percent":0.10,"minimum_samples":8}'::jsonb,
    date '2026-01-01',null,v_build,
    '{"authority_locator":"p.2 Table 1 Option 4","extraction_scope":"greater of ten percent or eight units per bedroom size"}'::jsonb);
  v_rule_id:=(v_result->>'rule_id')::uuid;
  perform public.record_state_rule_fixture(v_rule_id,'IL-UA-OTHER-SAMPLE-POS','POSITIVE','{"units_per_bedroom_size":100,"sampled_units_per_bedroom_size":10}', 'PASS','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-UA-OTHER-SAMPLE-NEG','NEGATIVE','{"units_per_bedroom_size":100,"sampled_units_per_bedroom_size":9}', 'FAIL','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-UA-OTHER-SAMPLE-BOUND','BOUNDARY','{"units_per_bedroom_size":80,"sampled_units_per_bedroom_size":8}', 'PASS','{}',v_build);

  v_result:=public.record_state_deterministic_rule(v_pack,v_utility,'SECTION_811_PRA','IL-SECTION-811-PRA-UA-SUBMIT-120','1.0.0',
    'Section 811 PRA utility allowance submission timing',1,
    'IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, Section 811 PRA, p.1',
    'COMPARE_NUMBER','{"required":["days_before_anniversary_date_submitted"]}'::jsonb,
    '{"operator":"GTE","left_field":"days_before_anniversary_date_submitted","right_value":120}'::jsonb,
    date '2026-01-01',null,v_build,
    '{"authority_locator":"p.1 Section 811 PRA","extraction_scope":"explicit 120-day anniversary-date submission lead time"}'::jsonb);
  v_rule_id:=(v_result->>'rule_id')::uuid;
  perform public.record_state_rule_fixture(v_rule_id,'IL-811-UA-SUBMIT-POS','POSITIVE','{"days_before_anniversary_date_submitted":121}', 'PASS','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-811-UA-SUBMIT-NEG','NEGATIVE','{"days_before_anniversary_date_submitted":119}', 'FAIL','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-811-UA-SUBMIT-BOUND','BOUNDARY','{"days_before_anniversary_date_submitted":120}', 'PASS','{}',v_build);
end;
$$;

do $$
declare v_pack uuid;
begin
  select id into strict v_pack from public.state_rule_pack_candidates
    where state_code='IL' order by inventory_generated_at desc limit 1;
  perform public.refresh_state_rule_release_work_item(v_pack);
end;
$$;

do $$
declare v_pack uuid; v_failed integer; v_missing integer; v_active_bad integer;
begin
  select id into strict v_pack from public.state_rule_pack_candidates
    where state_code='IL' order by inventory_generated_at desc limit 1;
  with latest_fixture as (
    select distinct on (fixture_key) * from public.state_rule_test_fixtures
    where pack_candidate_id=v_pack
    order by fixture_key,created_at desc,id desc
  ) select count(*) filter(where not passed)::integer into v_failed from latest_fixture;
  select count(*)::integer into v_missing from public.state_rule_deterministic_rules r
  where r.pack_candidate_id=v_pack and r.validation_status='VALIDATED'
    and r.rule_key in ('IL-HOME-UA-METHOD','IL-UA-SAMPLE-SIZE-COMPLIANT','IL-UA-OTHER-SAMPLE-SIZE-10PCT-MIN8','IL-SECTION-811-PRA-UA-SUBMIT-120')
    and exists(select 1 from unnest(array['POSITIVE','NEGATIVE','BOUNDARY']) k(kind) where not exists(
      select 1 from public.state_rule_test_fixtures f where f.rule_id=r.id and f.fixture_kind=k.kind and f.passed));
  select count(*)::integer into v_active_bad from public.state_rule_deterministic_rules
  where id in (
    select prior_rule_id from public.state_rule_supersession_events
    where pack_candidate_id=v_pack
  ) and validation_status<>'REJECTED';
  if v_failed<>0 or v_missing<>0 or v_active_bad<>0 then
    raise exception 'Illinois extraction migration failed: failed fixtures %, missing core fixtures %, active superseded rules %',v_failed,v_missing,v_active_bad;
  end if;
end;
$$;

