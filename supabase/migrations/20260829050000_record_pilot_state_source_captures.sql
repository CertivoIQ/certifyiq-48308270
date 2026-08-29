-- Record automated exact-byte capture facts for the TN/TX pilot wave.
-- This is not independent validation and cannot activate a rule pack.

do $$
declare
  updated_sources integer;
begin
  with captures(state_code, source_type, source_url, retrieved_at, byte_size, sha256) as (
    values
      ('TN','COMPLIANCE_ASSET_MANAGEMENT','https://thda.org/rental-housing-partn/compliance-asset-management/',timestamptz '2026-08-29T01:26:01.479Z',95611::bigint,'7273a5ca47533b598eb834f94ae4e9c358b750f4059c4e3021400f632fd2867a'),
      ('TN','HOUSING_CREDIT_COMPLIANCE','https://thda.org/rental-housing-partn/housing-credit-compliance/',timestamptz '2026-08-29T01:26:02.147Z',132797::bigint,'a848c216efc84dbf9211892a1dae5b9f5b09c5364ab3b7ca474682404673ccfe'),
      ('TN','LIHTC_PROGRAM','https://thda.org/rental-housing-partn/lihtc-program/',timestamptz '2026-08-29T01:26:02.817Z',113325::bigint,'09207efc28e1fe37a81e35057b4fead0e50e3d5648b2357e2523a8d019ca715a'),
      ('TN','THOMAS_DOCUMENTS','https://thda.org/rental-housing-partn/thomas-documents/',timestamptz '2026-08-29T01:26:03.644Z',151676::bigint,'5ef215876e910177ccd12aacc44c3b8c6b1795b4c62b3ca0ceef29aed1a9e0e9'),
      ('TX','APPLICATION_MATERIALS','https://www.tdhca.texas.gov/apply-funds',timestamptz '2026-08-29T01:26:03.919Z',91449::bigint,'39010d6bad37c755bf8a97e637e34d7b3e642980c51f107ce74ed53039c1f7ce'),
      ('TX','COMPLIANCE_FORMS','https://www.tdhca.texas.gov/compliance-forms',timestamptz '2026-08-29T01:26:04.580Z',98261::bigint,'5dc2dbe88285e76a39986f2f1256ef161383e80c7f3445831a191b068e290223'),
      ('TX','COMPLIANCE_INDEX','https://www.tdhca.texas.gov/compliance',timestamptz '2026-08-29T01:26:04.762Z',90883::bigint,'97feadb30eaa7cf106fe37d9d182a63f2b522362490e748d6ff3f0abb6dca9eb'),
      ('TX','COMPLIANCE_MANUALS_AND_RULES','https://www.tdhca.texas.gov/compliance-manuals-and-rules',timestamptz '2026-08-29T01:26:05.511Z',85150::bigint,'9876d15f9a71787e1a800f35a9b24053d825ed783a34c43789fd00057c8b7d6a'),
      ('TX','POST_AWARD_MANUAL','https://www.tdhca.texas.gov/post-award-activities-manual',timestamptz '2026-08-29T01:26:06.057Z',93903::bigint,'1328610e5f146358b208d8372159693c42631e18900551481ac6f53006d3a6da'),
      ('TX','QAP_AND_9_PERCENT_PROGRAM','https://www.tdhca.texas.gov/competitive-9-housing-tax-credits',timestamptz '2026-08-29T01:26:06.234Z',171801::bigint,'c68e1c66d5865d99ab257bf1771006260fb7f72394bf522092b10d9f5ec6606b')
  )
  update public.state_rule_source_candidates candidate
  set exact_bytes_captured = true,
      source_sha256 = captures.sha256,
      retrieved_at = captures.retrieved_at,
      agent_verification_status = 'captured_unvalidated',
      compliance_activation_allowed = false,
      verification_evidence = coalesce(candidate.verification_evidence, '{}'::jsonb)
        || jsonb_build_object(
          'capture_actor', 'github_actions',
          'capture_workflow', 'Pilot State Source Evidence',
          'capture_run_id', 33226388665,
          'capture_artifact_id', 9707002104,
          'capture_artifact_sha256', '4d4095aba34f0c6481e71c6beec0f5882227397b37d3d98a824705dec8b15f8a',
          'captured_byte_size', captures.byte_size,
          'independent_validation_required', true,
          'human_verified', false
        ),
      updated_at = now()
  from captures
  where candidate.state_code = captures.state_code
    and candidate.source_type = captures.source_type
    and candidate.source_url = captures.source_url
    and candidate.agent_verification_status = 'queued_for_agent_verification';

  get diagnostics updated_sources = row_count;
  if updated_sources <> 10 then
    raise exception 'Pilot capture reconciliation expected 10 queued sources, updated %',
      updated_sources;
  end if;

  update public.state_rule_pack_candidates
  set status = 'agent_verification_in_progress',
      compliance_activation_allowed = false,
      updated_at = now()
  where state_code in ('TN', 'TX')
    and status = 'queued_for_agent_verification';
end
$$;
