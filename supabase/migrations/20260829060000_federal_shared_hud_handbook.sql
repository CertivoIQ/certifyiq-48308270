-- Model HUD Handbook 4350.3 as one federal controlled source shared by all 50
-- state rule packs. Preserve independent validation and fail-closed activation.

insert into public.state_rule_pack_candidates (
  state_code,
  inventory_generated_at,
  status,
  source_candidate_count,
  blocked_source_count,
  candidate_manifest,
  agent_verification_required,
  compliance_activation_allowed
) values (
  'US',
  '2026-08-29 00:00:00+00',
  'agent_verification_in_progress',
  1,
  0,
  jsonb_build_object(
    'scope', 'FEDERAL_SHARED',
    'inventory_title', 'Federal controlled sources shared by all 50 state rule packs',
    'inventory_generated_at', '2026-08-29T00:00:00.000Z',
    'source_count', 1,
    'applies_to', array[
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
      'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
      'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
      'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
    ]
  ),
  true,
  false
)
on conflict (state_code, inventory_generated_at) do nothing;

update public.state_rule_source_candidates
set
  state_code = 'US',
  inventory_generated_at = '2026-08-29 00:00:00+00',
  scope = 'FEDERAL_SHARED',
  authority_name = 'U.S. Department of Housing and Urban Development',
  official_domain = 'hud.gov',
  origin_file = 'federal_controlled_source_inventory',
  program = 'HUD_MULTIFAMILY',
  source_type = 'HUD_HANDBOOK_4350_3',
  source_url = 'https://www.hud.gov/sites/documents/43503hsgh.pdf',
  candidate_status = 'EXACT_BYTES_CAPTURED_PENDING_AGENT_VERIFICATION',
  agent_verification_status = 'captured_unvalidated',
  exact_bytes_captured = true,
  compliance_activation_allowed = false,
  source_sha256 = 'f58e4281302695a1d252bc3e4f51547806e137738a073cb94fd115920ba00adc',
  retrieved_at = coalesce(retrieved_at, now()),
  verification_evidence = coalesce(verification_evidence, '{}'::jsonb) || jsonb_build_object(
    'federal_shared_source', true,
    'applies_to_all_50_states', true,
    'canonical_authority', 'U.S. Department of Housing and Urban Development',
    'canonical_title', 'Occupancy Requirements of Subsidized Multifamily Housing Programs',
    'handbook_number', '4350.3 REV-1 Change 4',
    'canonical_url', 'https://www.hud.gov/sites/documents/43503hsgh.pdf',
    'page_count', 794,
    'byte_size', 8382820,
    'captured_sha256', 'f58e4281302695a1d252bc3e4f51547806e137738a073cb94fd115920ba00adc',
    'last_decision', 'captured_unvalidated',
    'notes', 'Corrected from a state-hosted duplicate into one canonical federal source shared by all 50 state packs. Independent agent verification remains required.'
  ),
  updated_at = now()
where state_code = 'AL'
  and source_type = 'HUD_HANDBOOK'
  and authority_name = 'Arizona Department of Housing';

insert into public.state_rule_source_candidates (
  state_code, inventory_generated_at, scope, authority_name, official_domain,
  origin_file, program, source_type, source_url, candidate_status,
  agent_verification_status, exact_bytes_captured, compliance_activation_allowed,
  source_sha256, retrieved_at, verification_evidence
)
select
  'US',
  '2026-08-29 00:00:00+00',
  'FEDERAL_SHARED',
  'U.S. Department of Housing and Urban Development',
  'hud.gov',
  'federal_controlled_source_inventory',
  'HUD_MULTIFAMILY',
  'HUD_HANDBOOK_4350_3',
  'https://www.hud.gov/sites/documents/43503hsgh.pdf',
  'EXACT_BYTES_CAPTURED_PENDING_AGENT_VERIFICATION',
  'captured_unvalidated',
  true,
  false,
  'f58e4281302695a1d252bc3e4f51547806e137738a073cb94fd115920ba00adc',
  now(),
  jsonb_build_object(
    'federal_shared_source', true,
    'applies_to_all_50_states', true,
    'canonical_title', 'Occupancy Requirements of Subsidized Multifamily Housing Programs',
    'handbook_number', '4350.3 REV-1 Change 4',
    'page_count', 794,
    'byte_size', 8382820
  )
where not exists (
  select 1
  from public.state_rule_source_candidates
  where state_code = 'US'
    and source_url = 'https://www.hud.gov/sites/documents/43503hsgh.pdf'
);

update public.state_rule_pack_candidates p
set source_candidate_count = counts.source_count,
    blocked_source_count = counts.blocked_count,
    compliance_activation_allowed = false,
    candidate_manifest = coalesce(p.candidate_manifest, '{}'::jsonb)
      || jsonb_build_object('source_count', counts.source_count),
    updated_at = now()
from (
  select state_code, inventory_generated_at,
         count(*)::int as source_count,
         count(*) filter (
           where agent_verification_status in ('blocked', 'rejected')
         )::int as blocked_count
  from public.state_rule_source_candidates
  where state_code in ('AL', 'US')
  group by state_code, inventory_generated_at
) counts
where p.state_code = counts.state_code
  and p.inventory_generated_at = counts.inventory_generated_at;
