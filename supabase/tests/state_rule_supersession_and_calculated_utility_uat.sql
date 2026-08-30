-- Rollback-only UAT for immutable rule supersession and calculated utility sample rules.
begin;

do $$
declare
  v_pack uuid;
  v_rule uuid;
  v_result jsonb;
  v_count integer;
begin
  select id into strict v_pack from public.state_rule_pack_candidates
    where state_code='IL' order by inventory_generated_at desc limit 1;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='state_rule_supersession_events' and c.relrowsecurity
  ) then raise exception 'Supersession events are missing RLS'; end if;

  if has_table_privilege('authenticated','public.state_rule_supersession_events','INSERT')
     or has_table_privilege('authenticated','public.state_rule_supersession_events','UPDATE') then
    raise exception 'Authenticated clients can mutate supersession evidence';
  end if;

  select count(*)::integer into v_count
  from public.state_rule_supersession_events
  where pack_candidate_id=v_pack
    and rule_key in ('IL-HOME-UA-METHOD','IL-UA-SAMPLE-SIZE-COMPLIANT');
  if v_count<>2 then raise exception 'Expected two Illinois rule supersession events, found %',v_count; end if;

  if exists (
    select 1 from public.state_rule_supersession_events e
    join public.state_rule_deterministic_rules prior on prior.id=e.prior_rule_id
    join public.state_rule_deterministic_rules replacement on replacement.id=e.replacement_rule_id
    where e.pack_candidate_id=v_pack
      and (prior.validation_status<>'REJECTED' or replacement.validation_status<>'VALIDATED'
        or prior.rule_key<>replacement.rule_key or prior.pack_candidate_id<>replacement.pack_candidate_id)
  ) then raise exception 'Supersession lifecycle state is inconsistent'; end if;

  select id into v_rule from public.state_rule_deterministic_rules
  where pack_candidate_id=v_pack and rule_key='IL-UA-SAMPLE-SIZE-COMPLIANT' and validation_status='VALIDATED'
  order by created_at desc,id desc limit 1;
  v_result:=public.evaluate_state_deterministic_rule(v_rule,'{"units_per_bedroom_size":389,"sampled_units_per_bedroom_size":29}'::jsonb);
  if v_result->>'outcome'<>'PASS' or (v_result->'detail'->>'minimum_samples')::numeric<>29 then
    raise exception 'Table 2 open-ended band did not evaluate deterministically: %',v_result;
  end if;

  select id into v_rule from public.state_rule_deterministic_rules
  where pack_candidate_id=v_pack and rule_key='IL-UA-OTHER-SAMPLE-SIZE-10PCT-MIN8' and validation_status='VALIDATED'
  order by created_at desc,id desc limit 1;
  v_result:=public.evaluate_state_deterministic_rule(v_rule,'{"units_per_bedroom_size":81,"sampled_units_per_bedroom_size":9}'::jsonb);
  if v_result->>'outcome'<>'PASS' or (v_result->'detail'->>'minimum_samples')::numeric<>9 then
    raise exception 'Ten-percent ceiling calculation did not evaluate deterministically: %',v_result;
  end if;

  with target_rules as (
    select id from public.state_rule_deterministic_rules
    where pack_candidate_id=v_pack and validation_status='VALIDATED'
      and rule_key in ('IL-HOME-UA-METHOD','IL-UA-SAMPLE-SIZE-COMPLIANT',
        'IL-UA-OTHER-SAMPLE-SIZE-10PCT-MIN8','IL-SECTION-811-PRA-UA-SUBMIT-120')
  )
  select count(*)::integer into v_count from target_rules r
  where exists (
    select 1 from unnest(array['POSITIVE','NEGATIVE','BOUNDARY']) k(kind)
    where not exists(select 1 from public.state_rule_test_fixtures f where f.rule_id=r.id and f.fixture_kind=k.kind and f.passed)
  );
  if v_count<>0 then raise exception 'Extracted rules are missing passing core fixtures'; end if;

  if exists (
    select 1 from public.state_rule_pack_candidates
    where id=v_pack and compliance_activation_allowed
  ) then raise exception 'Illinois pack was activated during extraction'; end if;

  if exists (
    select 1 from public.state_rule_release_work_items
    where pack_candidate_id=v_pack and status in ('READY_FOR_INDEPENDENT_RELEASE','RELEASED')
  ) then raise exception 'Incomplete Illinois extraction advanced to release approval'; end if;
end;
$$;

rollback;

