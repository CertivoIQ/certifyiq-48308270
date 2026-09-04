-- Surface missing exact-document requirements in the state rule release/pending-validation workload.
-- This is additive: existing release-critical gaps remain intact.

with missing as (
  select
    state_code,
    jsonb_agg(requirement_key order by requirement_key) as missing_requirements
  from public.state_rule_document_requirement_readiness
  where required
    and not coalesce(sha_present, false)
  group by state_code
), merged as (
  select
    work.pack_candidate_id,
    work.state_code,
    to_jsonb(array(
      select distinct value
      from jsonb_array_elements_text(
        coalesce(work.release_critical_document_gaps, '[]'::jsonb)
        || coalesce(missing.missing_requirements, '[]'::jsonb)
      ) as item(value)
      order by value
    )) as gaps
  from public.state_rule_release_work_items work
  left join missing on missing.state_code = work.state_code
)
update public.state_rule_release_work_items work
set
  release_critical_document_gaps = merged.gaps,
  blockers = jsonb_set(
    coalesce(work.blockers, '{}'::jsonb),
    '{release_critical_document_gaps}',
    merged.gaps,
    true
  ),
  status = case
    when jsonb_array_length(merged.gaps) > 0 then 'SOURCE_DOCUMENT_GAP'
    else work.status
  end,
  updated_at = now()
from merged
where work.pack_candidate_id = merged.pack_candidate_id;

-- Keep every affected pack fail-closed while a required exact file/SHA is missing.
update public.state_rule_pack_candidates pack
set
  compliance_activation_allowed = false,
  status = 'agent_verification_in_progress',
  updated_at = now()
where exists (
  select 1
  from public.state_rule_document_requirement_readiness readiness
  where readiness.state_code = pack.state_code
    and readiness.required
    and not coalesce(readiness.sha_present, false)
);
