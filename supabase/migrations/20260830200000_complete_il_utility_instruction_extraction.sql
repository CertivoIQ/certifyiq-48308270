-- Complete executable-rule extraction for the exact two-page Illinois utility instructions.
do $$
declare
  v_pack uuid; v_source uuid; v_build constant text := 'codex-il-rule-extraction-2026-08-30.4';
  v_prior public.state_rule_deterministic_rules%rowtype; v_spec jsonb; v_result jsonb; v_rule uuid;
  v_rules jsonb;
begin
  select id into strict v_pack from public.state_rule_pack_candidates
    where state_code='IL' order by inventory_generated_at desc limit 1;
  select source_candidate_id into strict v_source from public.state_rule_release_current_sources(v_pack)
    where source_url='https://www.ihda.org/wp-content/uploads/2025/11/Instructions-for-Rent-Schedule-Utility-Allowance-Request-10-2025.pdf'
      and source_sha256='258990520bc93e300a8e4ecbb811ccc4c3eab6defdc4b97f7f81f550c2788099';

  -- Narrow two previously broad rules to the source methods for which they are stated.
  for v_prior in select * from public.state_rule_deterministic_rules
    where pack_candidate_id=v_pack and validation_status='VALIDATED'
      and rule_key in ('IL-UA-CONSECUTIVE-USAGE-12-MONTHS','IL-UA-SUMMARY-BACKUP-SUBMITTED')
    order by rule_key
  loop
    v_result:=public.record_state_deterministic_rule(v_pack,v_source,'UA_OPTION_1_OR_4',v_prior.rule_key,'1.1.0',
      v_prior.topic,v_prior.source_page,v_prior.citation,v_prior.operation_type,v_prior.input_schema,
      v_prior.deterministic_operation,v_prior.effective_from,v_prior.effective_to,v_build,
      v_prior.extraction_evidence || jsonb_build_object('applicability','Table 1 Option 1 or Option 4','correction','Method-scoped applicability'));
    v_rule:=(v_result->>'rule_id')::uuid;
    perform public.supersede_state_deterministic_rule(v_prior.id,v_rule,
      'Narrows the active rule to the exact Table 1 methods for which the instruction states the requirement.',v_build);
    if v_prior.rule_key='IL-UA-CONSECUTIVE-USAGE-12-MONTHS' then
      perform public.record_state_rule_fixture(v_rule,v_prior.rule_key||'-1.1-POS','POSITIVE','{"consecutive_utility_usage_months":13}','PASS','{}',v_build);
      perform public.record_state_rule_fixture(v_rule,v_prior.rule_key||'-1.1-NEG','NEGATIVE','{"consecutive_utility_usage_months":11}','FAIL','{}',v_build);
      perform public.record_state_rule_fixture(v_rule,v_prior.rule_key||'-1.1-BOUND','BOUNDARY','{"consecutive_utility_usage_months":12}','PASS','{}',v_build);
    else
      perform public.record_state_rule_fixture(v_rule,v_prior.rule_key||'-1.1-POS','POSITIVE','{"ihda_utility_allowance_summary_and_backup_submitted":true}','PASS','{}',v_build);
      perform public.record_state_rule_fixture(v_rule,v_prior.rule_key||'-1.1-NEG','NEGATIVE','{"ihda_utility_allowance_summary_and_backup_submitted":false}','FAIL','{}',v_build);
      perform public.record_state_rule_fixture(v_rule,v_prior.rule_key||'-1.1-BOUND','BOUNDARY','{"ihda_utility_allowance_summary_and_backup_submitted":true}','PASS','{}',v_build);
    end if;
  end loop;

  for v_spec in select value from jsonb_array_elements($specs$
  [
    {"key":"IL-HOME-NHTF-UA-METHOD-OPTIONS-1-3","program":"HOME_NHTF","topic":"HOME/NHTF utility allowance method option","page":1,"citation":"IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, HOME and NHTF, p.1","type":"REQUIRE_ENUM","schema":{"required":["utility_allowance_method"]},"op":{"field":"utility_allowance_method","allowed":["HUD_MULTIFAMILY_UTILITY_ANALYSIS","HUSM","PHA_UTILITY_ALLOWANCE"]},"pos":{"utility_allowance_method":"HUSM"},"neg":{"utility_allowance_method":"OTHER_PROGRAMS_OPTION"},"bound":{"utility_allowance_method":"PHA_UTILITY_ALLOWANCE"}},
    {"key":"IL-SECTION-811-PRA-UA-METHOD-OPTIONS-1-OR-3","program":"SECTION_811_PRA","topic":"Section 811 PRA utility allowance method option","page":1,"citation":"IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, Section 811 PRA, p.1","type":"REQUIRE_ENUM","schema":{"required":["utility_allowance_method"]},"op":{"field":"utility_allowance_method","allowed":["HUD_MULTIFAMILY_UTILITY_ANALYSIS","PHA_UTILITY_ALLOWANCE"]},"pos":{"utility_allowance_method":"HUD_MULTIFAMILY_UTILITY_ANALYSIS"},"neg":{"utility_allowance_method":"HUSM"},"bound":{"utility_allowance_method":"PHA_UTILITY_ALLOWANCE"}},
    {"key":"IL-OTHER-UA-METHOD-OPTIONS-1-4","program":"IHDA_OTHER","topic":"Other-program utility allowance method option","page":1,"citation":"IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, All other programs, p.1","type":"REQUIRE_ENUM","schema":{"required":["utility_allowance_method"]},"op":{"field":"utility_allowance_method","allowed":["HUD_MULTIFAMILY_UTILITY_ANALYSIS","HUSM","PHA_UTILITY_ALLOWANCE","OTHER_PROGRAMS_OPTION"]},"pos":{"utility_allowance_method":"OTHER_PROGRAMS_OPTION"},"neg":{"utility_allowance_method":"OWNER_ASSERTED_OTHER"},"bound":{"utility_allowance_method":"HUD_MULTIFAMILY_UTILITY_ANALYSIS"}},
    {"key":"IL-HOME-NHTF-RENT-UA-REQUEST-FORM","program":"HOME_NHTF","topic":"HOME/NHTF rent and utility allowance request form","page":1,"citation":"IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, HOME and NHTF, p.1","type":"REQUIRE_DOCUMENT","schema":{"required":["rent_and_utility_allowance_request_completed"]},"op":{"field":"rent_and_utility_allowance_request_completed","required":true},"pos":{"rent_and_utility_allowance_request_completed":true},"neg":{"rent_and_utility_allowance_request_completed":false},"bound":{"rent_and_utility_allowance_request_completed":true}},
    {"key":"IL-SECTION-811-PRA-HUD-92458","program":"SECTION_811_PRA","topic":"Section 811 PRA HUD-92458 Rent Schedule","page":1,"citation":"IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, Section 811 PRA, p.1","type":"REQUIRE_DOCUMENT","schema":{"required":["hud_92458_rent_schedule_completed"]},"op":{"field":"hud_92458_rent_schedule_completed","required":true},"pos":{"hud_92458_rent_schedule_completed":true},"neg":{"hud_92458_rent_schedule_completed":false},"bound":{"hud_92458_rent_schedule_completed":true}},
    {"key":"IL-OTHER-RENT-UA-REQUEST-FORM","program":"IHDA_OTHER","topic":"Other-program rent and utility allowance request form","page":1,"citation":"IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, All other programs, p.1","type":"REQUIRE_DOCUMENT","schema":{"required":["rent_and_utility_allowance_request_completed"]},"op":{"field":"rent_and_utility_allowance_request_completed","required":true},"pos":{"rent_and_utility_allowance_request_completed":true},"neg":{"rent_and_utility_allowance_request_completed":false},"bound":{"rent_and_utility_allowance_request_completed":true}},
    {"key":"IL-UA-EMAIL-COMPLIANCE-CONNECTION","program":"IHDA_UA","topic":"Utility allowance documentation delivery","page":1,"citation":"IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, p.1","type":"REQUIRE_BOOLEAN","schema":{"required":["documentation_emailed_to_compliance_connection"]},"op":{"field":"documentation_emailed_to_compliance_connection","required":true},"pos":{"documentation_emailed_to_compliance_connection":true},"neg":{"documentation_emailed_to_compliance_connection":false},"bound":{"documentation_emailed_to_compliance_connection":true}},
    {"key":"IL-UA-OPTION1-FACTOR-UPDATE-MAX-2-YEARS","program":"UA_OPTION_1","topic":"Option 1 factor-based update period","page":2,"citation":"IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, Table 1 Option 1, p.2","type":"COMPARE_NUMBER","schema":{"required":["factor_based_update_years_after_baseline"]},"op":{"left_field":"factor_based_update_years_after_baseline","operator":"LTE","right_value":2},"pos":{"factor_based_update_years_after_baseline":1},"neg":{"factor_based_update_years_after_baseline":3},"bound":{"factor_based_update_years_after_baseline":2}},
    {"key":"IL-UA-OPTION3-BEDROOM-AMOUNTS-TOTALED","program":"UA_OPTION_3","topic":"PHA allowance bedroom amounts and total","page":2,"citation":"IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, Table 1 Option 3, p.2","type":"REQUIRE_BOOLEAN","schema":{"required":["pha_amounts_per_bedroom_circled_and_totaled"]},"op":{"field":"pha_amounts_per_bedroom_circled_and_totaled","required":true},"pos":{"pha_amounts_per_bedroom_circled_and_totaled":true},"neg":{"pha_amounts_per_bedroom_circled_and_totaled":false},"bound":{"pha_amounts_per_bedroom_circled_and_totaled":true}},
    {"key":"IL-UA-OPTION3-SURCHARGE-CLARIFIED","program":"UA_OPTION_3","topic":"PHA surcharge or gas fixed charge treatment","page":2,"citation":"IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, Table 1 Option 3, p.2","type":"REQUIRE_IF","schema":{"required":["pha_schedule_has_surcharge_or_gas_fixed_charge","surcharge_tenant_payment_clarified_and_totaled"]},"op":{"condition_field":"pha_schedule_has_surcharge_or_gas_fixed_charge","condition_value":true,"required_field":"surcharge_tenant_payment_clarified_and_totaled","required_value":true},"pos":{"pha_schedule_has_surcharge_or_gas_fixed_charge":true,"surcharge_tenant_payment_clarified_and_totaled":true},"neg":{"pha_schedule_has_surcharge_or_gas_fixed_charge":true,"surcharge_tenant_payment_clarified_and_totaled":false},"bound":{"pha_schedule_has_surcharge_or_gas_fixed_charge":false,"surcharge_tenant_payment_clarified_and_totaled":false}},
    {"key":"IL-UA-OPTION4-LEGIBLE-WITH-TOTAL","program":"UA_OPTION_4","topic":"Option 4 legibility and total","page":2,"citation":"IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, Table 1 Option 4, p.2","type":"REQUIRE_BOOLEAN","schema":{"required":["all_utility_numbers_legible_with_total"]},"op":{"field":"all_utility_numbers_legible_with_total","required":true},"pos":{"all_utility_numbers_legible_with_total":true},"neg":{"all_utility_numbers_legible_with_total":false},"bound":{"all_utility_numbers_legible_with_total":true}}
  ]
  $specs$::jsonb) specs(value)
  loop
    v_result:=public.record_state_deterministic_rule(v_pack,v_source,v_spec->>'program',v_spec->>'key','1.0.0',
      v_spec->>'topic',(v_spec->>'page')::integer,v_spec->>'citation',v_spec->>'type',v_spec->'schema',v_spec->'op',
      date '2026-01-01',null,v_build,jsonb_build_object('authority_locator','p.'||(v_spec->>'page'),'extraction_scope','explicit executable provision'));
    v_rule:=(v_result->>'rule_id')::uuid;
    perform public.record_state_rule_fixture(v_rule,(v_spec->>'key')||'-POS','POSITIVE',v_spec->'pos','PASS','{}',v_build);
    perform public.record_state_rule_fixture(v_rule,(v_spec->>'key')||'-NEG','NEGATIVE',v_spec->'neg','FAIL','{}',v_build);
    perform public.record_state_rule_fixture(v_rule,(v_spec->>'key')||'-BOUND','BOUNDARY',v_spec->'bound','PASS','{}',v_build);
  end loop;

  select jsonb_agg(jsonb_build_object('rule_key',rule_key,'rule_version',rule_version,'rule_sha256',rule_sha256,
    'source_page',source_page,'citation',citation,'operation_type',operation_type) order by source_page,rule_key)
  into v_rules from public.state_rule_deterministic_rules
  where pack_candidate_id=v_pack and source_candidate_id=v_source and validation_status='VALIDATED';

  perform public.record_state_rule_source_assessment(v_source,'RULES_EXTRACTED',v_build,jsonb_build_object(
    'coverage_status','COMPLETE','source_page_count',2,'reviewed_pages',jsonb_build_array(1,2),
    'complete_page_review',true,'exact_source_sha256','258990520bc93e300a8e4ecbb811ccc4c3eab6defdc4b97f7f81f550c2788099',
    'active_rules',v_rules,'explicit_executable_provisions_extracted',true,
    'non_executable_references',jsonb_build_array('HUD HUSM web instructions','HUD Notice H-2015-04','Rental Assistance Contract annual-adjustment clause')));
  perform public.record_state_rule_conflict(v_pack,'IL-UTILITY-INSTRUCTIONS-EXTRACTION-GAPS-2026-08-30',array[v_source],
    'SUBSTANTIVE','All explicit executable provisions on exact pages 1-2 are now implemented and fixture-validated; independent resolver confirmation remains outstanding.',
    'UNRESOLVED','IHDA Instructions for Annual Submission of Rent Schedule and Utility Allowance Request, pp.1-2');
  perform public.record_state_rule_pack_assessment(v_pack,false,v_build,jsonb_build_object(
    'assessment_scope','FIRST_BATCH_IL_CURRENT_SOURCE_SNAPSHOT_INCREMENTAL','complete_source_extraction_claimed',false,
    'conflict_inventory_complete_claimed',false,'utility_instruction_extraction_complete',true));
end;
$$;

do $$
declare v_pack uuid; v_source uuid; v_failed integer; v_missing integer; v_coverage text;
begin
  select id into strict v_pack from public.state_rule_pack_candidates where state_code='IL' order by inventory_generated_at desc limit 1;
  select source_candidate_id into strict v_source from public.state_rule_release_current_sources(v_pack)
    where source_sha256='258990520bc93e300a8e4ecbb811ccc4c3eab6defdc4b97f7f81f550c2788099';
  with latest as(select distinct on(fixture_key)* from public.state_rule_test_fixtures where pack_candidate_id=v_pack order by fixture_key,created_at desc,id desc)
    select count(*) filter(where not passed)::integer into v_failed from latest;
  select count(*)::integer into v_missing from public.state_rule_deterministic_rules r
    where r.pack_candidate_id=v_pack and r.source_candidate_id=v_source and r.validation_status='VALIDATED'
      and exists(select 1 from unnest(array['POSITIVE','NEGATIVE','BOUNDARY']) k(kind) where not exists(
        select 1 from public.state_rule_test_fixtures f where f.rule_id=r.id and f.fixture_kind=k.kind and f.passed));
  select coverage_status into strict v_coverage from public.state_rule_source_extraction_assessments
    where source_candidate_id=v_source order by created_at desc,id desc limit 1;
  if v_failed<>0 or v_missing<>0 or v_coverage<>'COMPLETE' then
    raise exception 'Utility extraction completion failed: fixtures %, missing %, coverage %',v_failed,v_missing,v_coverage;
  end if;
end;
$$;

