-- Correct two page/section bindings from the exact Illinois manual while preserving prior versions.
do $$
declare
  v_pack uuid;
  v_manual uuid;
  v_build constant text := 'codex-il-rule-extraction-2026-08-30.3';
  v_prior public.state_rule_deterministic_rules%rowtype;
  v_result jsonb;
  v_rule_id uuid;
begin
  select id into strict v_pack from public.state_rule_pack_candidates
    where state_code='IL' order by inventory_generated_at desc limit 1;
  select source_candidate_id into strict v_manual from public.state_rule_release_current_sources(v_pack)
    where source_url='https://www.ihda.org/wp-content/uploads/2026/06/LIHTC-HOME-Manual-4-2026-FINAL-2.pdf'
      and source_sha256='b362d2cde02da437aced5af45646fa687f415446d3f6c19cfa0d2193ee086851';

  select * into strict v_prior from public.state_rule_deterministic_rules
    where pack_candidate_id=v_pack and rule_key='IL-LIHTC-MOVEIN-INCOME-LIMIT' and validation_status='VALIDATED'
    order by created_at desc,id desc limit 1;
  v_result:=public.record_state_deterministic_rule(
    v_pack,v_manual,v_prior.program_code,v_prior.rule_key,'1.1.0',v_prior.topic,14,
    'IHDA April 2026 LIHTC & HOME Compliance Manual §2.2.1, p.14',
    v_prior.operation_type,v_prior.input_schema,v_prior.deterministic_operation,
    v_prior.effective_from,v_prior.effective_to,v_build,
    v_prior.extraction_evidence || jsonb_build_object(
      'authority_locator','§2.2.1 p.14',
      'correction','Exact page 14 begins §2.2.1 LIHTC Program; prior locator §2.1.1 was incorrect.'
    )
  );
  v_rule_id:=(v_result->>'rule_id')::uuid;
  perform public.supersede_state_deterministic_rule(v_prior.id,v_rule_id,
    'Corrects the section locator to §2.2.1 on exact source page 14 without changing rule logic.',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-MOVEIN-INCOME-1.1-POS','POSITIVE',
    '{"household_income":50000,"applicable_income_limit":60000}','PASS','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-MOVEIN-INCOME-1.1-NEG','NEGATIVE',
    '{"household_income":60001,"applicable_income_limit":60000}','FAIL','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-MOVEIN-INCOME-1.1-BOUND','BOUNDARY',
    '{"household_income":60000,"applicable_income_limit":60000}','PASS','{}',v_build);

  select * into strict v_prior from public.state_rule_deterministic_rules
    where pack_candidate_id=v_pack and rule_key='IL-LAYERED-MOST-RESTRICTIVE-INCOME' and validation_status='VALIDATED'
    order by created_at desc,id desc limit 1;
  v_result:=public.record_state_deterministic_rule(
    v_pack,v_manual,v_prior.program_code,v_prior.rule_key,'1.1.0',v_prior.topic,37,
    'IHDA April 2026 LIHTC & HOME Compliance Manual §4.2.3, p.37',
    v_prior.operation_type,v_prior.input_schema,v_prior.deterministic_operation,
    v_prior.effective_from,v_prior.effective_to,v_build,
    v_prior.extraction_evidence || jsonb_build_object(
      'authority_locator','§4.2.3 p.37',
      'correction','Stored source page now matches the exact page containing the layered-program requirement.'
    )
  );
  v_rule_id:=(v_result->>'rule_id')::uuid;
  perform public.supersede_state_deterministic_rule(v_prior.id,v_rule_id,
    'Corrects the stored source page from 36 to exact source page 37 without changing rule logic.',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-LAYERED-INCOME-1.1-POS','POSITIVE',
    '{"most_restrictive_income_limit_applied":true}','PASS','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-LAYERED-INCOME-1.1-NEG','NEGATIVE',
    '{"most_restrictive_income_limit_applied":false}','FAIL','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-LAYERED-INCOME-1.1-BOUND','BOUNDARY',
    '{"most_restrictive_income_limit_applied":true}','PASS','{}',v_build);
  perform public.record_state_rule_fixture(v_rule_id,'IL-LAYERED-INCOME-1.1-LAYERED','LAYERED_PROGRAM',
    '{"most_restrictive_income_limit_applied":true}','PASS','{}',v_build);

  perform public.refresh_state_rule_release_work_item(v_pack);
end;
$$;

do $$
declare v_pack uuid; v_failed integer; v_bad integer;
begin
  select id into strict v_pack from public.state_rule_pack_candidates
    where state_code='IL' order by inventory_generated_at desc limit 1;
  with latest_fixture as (
    select distinct on(fixture_key) * from public.state_rule_test_fixtures
    where pack_candidate_id=v_pack order by fixture_key,created_at desc,id desc
  ) select count(*) filter(where not passed)::integer into v_failed from latest_fixture;
  select count(*)::integer into v_bad from public.state_rule_deterministic_rules
  where pack_candidate_id=v_pack and validation_status='VALIDATED'
    and ((rule_key='IL-LIHTC-MOVEIN-INCOME-LIMIT' and (source_page<>14 or citation not like '%§2.2.1%'))
      or (rule_key='IL-LAYERED-MOST-RESTRICTIVE-INCOME' and (source_page<>37 or citation not like '%§4.2.3%')));
  if v_failed<>0 or v_bad<>0 then
    raise exception 'Manual citation correction failed: failed fixtures %, invalid active bindings %',v_failed,v_bad;
  end if;
end;
$$;

