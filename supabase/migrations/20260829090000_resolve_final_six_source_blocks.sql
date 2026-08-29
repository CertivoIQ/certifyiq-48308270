do $$
declare
  az_updates integer;
  fl_updates integer;
  remaining_blocks integer;
begin
  with superseded(id, evidence) as (
    values
      (
        '0f75073f-8e3d-4ff5-a567-3b3aabb05478'::uuid,
        jsonb_build_object(
          'last_decision', 'superseded',
          'human_verified', false,
          'independent_validation_required', false,
          'notes', 'Redundant mutable authority index superseded by the existing verified exact-file ADOH 2025 LIHTC Compliance Manual record.',
          'superseded_by', jsonb_build_array(
            jsonb_build_object(
              'record_id', '536e5df1-0b8a-4d58-ab5e-08dfa4082fbc',
              'source_type', 'COMPLIANCE_MANUAL',
              'source_url', 'https://housing.az.gov/sites/default/files/2025-08/LIHTC-Compliance-Manual_2025.pdf',
              'sha256', 'da5d5bf4c96630baf383e8c3503a504f45054e5d49fa30fa12e1e4508fc05ceb'
            )
          )
        )
      ),
      (
        '33876369-3545-49d1-af97-cf3d4beb9eaa'::uuid,
        jsonb_build_object(
          'last_decision', 'superseded',
          'human_verified', false,
          'independent_validation_required', false,
          'notes', 'Redundant umbrella page superseded by existing verified exact-source records for the ADOH manual, 2026 income and rent limits, and TIC.',
          'superseded_by', jsonb_build_array(
            jsonb_build_object('record_id','536e5df1-0b8a-4d58-ab5e-08dfa4082fbc','source_type','COMPLIANCE_MANUAL','source_url','https://housing.az.gov/sites/default/files/2025-08/LIHTC-Compliance-Manual_2025.pdf','sha256','da5d5bf4c96630baf383e8c3503a504f45054e5d49fa30fa12e1e4508fc05ceb'),
            jsonb_build_object('record_id','2764f179-2264-4277-87e7-f3eb5237576d','source_type','INCOME_AND_RENT_LIMITS','source_url','https://housing.az.gov/resources/2026-lihtc-rent-income-limits-post-1989-effective-512026','sha256','6bd9899a3675243fc023d55939f58a68f143b812c4f7b98da03318a3d64fefdb'),
            jsonb_build_object('record_id','538da30b-17d0-4ce4-9e44-5f0c002fe0ec','source_type','TENANT_INCOME_CERTIFICATION','source_url','https://housing.az.gov/sites/default/files/2025-01/LIHTC-ADOH-TIC-Printable%20Version_Revised%2001_30_2025.pdf','sha256','51461cccc8de1c95e31000da744d3924826fb14393951cab924e444d1e17579e')
          )
        )
      )
  )
  update public.state_rule_source_candidates source
  set candidate_status = 'SUPERSEDED_REDUNDANT_AUTHORITY_INDEX',
      agent_verification_status = 'rejected',
      verification_evidence = coalesce(source.verification_evidence, '{}'::jsonb)
        || superseded.evidence
        || jsonb_build_object(
          'resolution_manifest', 'artifacts/final-blocked-source-replacements.json',
          'resolution_workflow', 'Final Blocked Source Replacements',
          'resolution_run_id', 33242405199,
          'resolution_artifact_id', 9711742994,
          'resolution_artifact_sha256', '05dc4713f84690c47bfcfb5584fae3424ca7b9363382be0fc7476a2c07ebe146',
          'resolved_at', now()
        ),
      compliance_activation_allowed = false,
      updated_at = now()
  from superseded
  where source.id = superseded.id
    and source.agent_verification_status = 'blocked';

  get diagnostics az_updates = row_count;
  if az_updates <> 2 then
    raise exception 'Expected to supersede 2 blocked Arizona umbrella sources, updated %', az_updates;
  end if;

  with captures(id, source_url, retrieved_at, byte_size, sha256, last_modified, document_title, authority_evidence) as (
    values
      (
        '365827bd-2633-45f2-9871-05169432408a'::uuid,
        'https://www.floridahousing.org/docs/default-source/developers-and-property-managers/compliance/compliance-training/florida_housing_compliance_training_workshop_presentation-%28for-note-taking%29-v-26-2.pdf?sfvrsn=6b39f07b_3',
        '2026-08-29T08:07:28.885Z'::timestamptz,
        2637499::bigint,
        '22e6907b857cc95eb3f51b67c8568688a0eb99e157bc426cb7de81c13e3c4d3f',
        'Wed, 11 Feb 2026 20:08:52 GMT',
        'Florida Housing Compliance Training Workshop v26.2',
        'Current official Florida Housing compliance workshop, including monitoring, HOTMA and Tenant Income Certification controls.'
      ),
      (
        '483fdc90-5d9a-40bf-86b1-abb5bf17000a'::uuid,
        'https://www.floridahousing.org/docs/default-source/developers-and-property-managers/compliance/compliance-training/florida_housing_compliance_training_workshop_presentation-%28for-note-taking%29-v-26-2.pdf?sfvrsn=6b39f07b_3',
        '2026-08-29T08:07:28.895Z'::timestamptz,
        2637499::bigint,
        '22e6907b857cc95eb3f51b67c8568688a0eb99e157bc426cb7de81c13e3c4d3f',
        'Wed, 11 Feb 2026 20:08:52 GMT',
        'Florida Housing Compliance Training Workshop v26.2 — forms and limits controls',
        'Current official Florida Housing compliance workshop expressly references Appendix Q Tenant Income Certification and current compliance controls.'
      ),
      (
        '88cbcd66-63b8-4d9b-ab7d-e9d6f608b4c0'::uuid,
        'https://www.floridahousing.org/docs/default-source/programs/competitive/2026-rule-development-process/notice-of-development-of-rulemaking-67-48---for-2-24-26-workshop.pdf?Status=Master&sfvrsn=200d86d8_1',
        '2026-08-29T08:07:28.899Z'::timestamptz,
        91344::bigint,
        '942dba5e38965b3b38bbb77764fa32083b42457dedf005230db1cbaf84cda8b4',
        'Fri, 06 Feb 2026 14:20:59 GMT',
        '2026 Rule 67-48 and Qualified Allocation Plan rulemaking notice',
        'Official 2026 Florida Housing notice for Rule Chapter 67-48 and amendments to the 2026 QAP.'
      ),
      (
        'a9f4f294-33ad-4b18-8400-f0564b6c9476'::uuid,
        'https://www.floridahousing.org/docs/default-source/programs/competitive/2026-rule-development-process/notice-of-proposed-rule---67-21---includes-notice-of-hearing.pdf?Status=Master&sfvrsn=aa922464_1',
        '2026-08-29T08:07:28.902Z'::timestamptz,
        270212::bigint,
        '9302cbe015f574a45ffa3c5cfee9af70d60a6b18970e07b6be278f384650430b',
        'Mon, 04 May 2026 16:14:59 GMT',
        '2026 Rule 67-21 proposed rule and hearing notice',
        'Official 2026 Florida Housing proposed Rule 67-21 notice governing noncompetitive bond-financed developments.'
      )
  )
  update public.state_rule_source_candidates source
  set candidate_status = case
        when source.agent_verification_status = 'verified' then 'VERIFIED_EXACT_BYTES'
        else 'CAPTURED_EXACT_BYTES_PENDING_INDEPENDENT_VALIDATION'
      end,
      agent_verification_status = case
        when source.agent_verification_status in ('verified', 'rejected') then source.agent_verification_status
        else 'captured_unvalidated'
      end,
      exact_bytes_captured = true,
      source_sha256 = captures.sha256,
      retrieved_at = captures.retrieved_at,
      verification_evidence = coalesce(source.verification_evidence, '{}'::jsonb)
        || jsonb_build_object(
          'last_decision', case when source.agent_verification_status = 'verified' then 'verified' else 'captured_unvalidated' end,
          'human_verified', source.agent_verification_status = 'verified',
          'independent_validation_required', source.agent_verification_status <> 'verified',
          'discovery_url', source.source_url,
          'final_url', captures.source_url,
          'document_title', captures.document_title,
          'authority_evidence', captures.authority_evidence,
          'content_type', 'application/pdf',
          'capture_kind', 'controlled_document',
          'captured_byte_size', captures.byte_size,
          'last_modified', captures.last_modified,
          'tls_peer_verification', false,
          'tls_exception_scope', 'Pinned official Florida Housing hosts only; exact PDF header and SHA-256 captured.',
          'resolution_manifest', 'artifacts/final-blocked-source-replacements.json',
          'resolution_workflow', 'Final Blocked Source Replacements',
          'resolution_run_id', 33242405199,
          'resolution_artifact_id', 9711742994,
          'resolution_artifact_sha256', '05dc4713f84690c47bfcfb5584fae3424ca7b9363382be0fc7476a2c07ebe146'
        ),
      compliance_activation_allowed = false,
      updated_at = now()
  from captures
  where source.id = captures.id
    and source.agent_verification_status in ('blocked', 'verified', 'rejected');

  get diagnostics fl_updates = row_count;
  if fl_updates <> 4 then
    raise exception 'Expected to capture 4 blocked Florida sources, updated %', fl_updates;
  end if;

  select count(*) into remaining_blocks
  from public.state_rule_source_candidates
  where agent_verification_status = 'blocked';

  if remaining_blocks <> 0 then
    raise exception 'Expected zero blocked source validations after reconciliation, found %', remaining_blocks;
  end if;

  update public.state_rule_pack_candidates pack
  set blocked_source_count = (
        select count(*)
        from public.state_rule_source_candidates source
        where source.state_code = pack.state_code
          and source.agent_verification_status = 'blocked'
      ),
      candidate_manifest = pack.candidate_manifest || jsonb_build_object(
        'final_blocked_source_resolution_manifest', 'artifacts/final-blocked-source-replacements.json',
        'final_blocked_source_resolution_run_id', 33242405199,
        'final_blocked_source_count', 0,
        'superseded_redundant_source_count', 2,
        'captured_replacement_source_count', 4,
        'independent_validation_required_for_replacements', true
      ),
      compliance_activation_allowed = false,
      updated_at = now()
  where pack.state_code in ('AZ', 'FL');
end
$$;
