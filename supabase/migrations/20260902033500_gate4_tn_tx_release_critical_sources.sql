-- Gate 4: persist the controlled TN/TX release-critical source capture.
-- These records intentionally remain captured_unvalidated. Independent staff review
-- is required before any source can become verified; this migration cannot activate
-- either state pack.

do $$
begin
  with rows(
    state_code,authority_name,official_domain,program,source_type,source_url,
    source_sha256,retrieved_at,document_title,document_families,discovery_url,
    byte_size,content_type
  ) as (
    values
      ('TN','Tennessee Housing Development Agency','thda.org','LIHTC','THOMAS_DOCUMENTS','https://thda.org/rental-housing-partn/thomas-documents/','e5b13e3fd026bb857304388af48780a2bcb357f5bb8442f18f136c24061e2e8b','2026-09-02T03:27:31.863Z'::timestamptz,'THOMAS Documents controlled index','["COMPLIANCE_GUIDEBOOK","UTILITY_ALLOWANCE"]'::jsonb,'https://thda.org/rental-housing-partn/thomas-documents/',151676,'text/html'),
      ('TN','Tennessee Housing Development Agency','thda.org','LIHTC','HOUSING_CREDIT_COMPLIANCE','https://thda.org/rental-housing-partn/housing-credit-compliance/','49d07a7ea12ea53bf378dad0a2cdd79c6ba1330c594d3de866f768c49ae7fc9c','2026-09-02T03:27:36.868Z'::timestamptz,'THDA Housing Credit Compliance','["COMPLIANCE_FORMS","INCOME_LIMITS","UTILITY_ALLOWANCE"]'::jsonb,'https://thda.org/rental-housing-partn/housing-credit-compliance/',132797,'text/html'),
      ('TN','U.S. Department of Housing and Urban Development','huduser.gov','LIHTC','HUD_MTSP_INCOME_LIMITS','https://www.huduser.gov/portal/datasets/mtsp.html','27c9c8718c608c88c1523fe783edc78db581ce0dd04784b3dad768665574b489','2026-09-02T03:27:37.639Z'::timestamptz,'HUD Multifamily Tax Subsidy Project Income Limits linked by THDA','["INCOME_LIMITS"]'::jsonb,'https://thda.org/rental-housing-partn/housing-credit-compliance/',172388,'text/html'),
      ('TN','Tennessee Housing Development Agency','thda.org','LIHTC','LIHTC_PROGRAM','https://thda.org/rental-housing-partn/lihtc-program/','4b285138eb3ccd8cb5d4ccc8ef8c0e102a4933d173761ae457d3656bc0fb7600','2026-09-02T03:27:39.388Z'::timestamptz,'THDA LIHTC Program rent-limit authority','["RENT_LIMITS"]'::jsonb,'https://thda.org/rental-housing-partn/lihtc-program/',113325,'text/html'),
      ('TN','Tennessee Housing Development Agency','thda.org','LIHTC','UTILITY_ALLOWANCE','https://thda.org/rental-housing-partn/utility-allowances/','16445d4e80784957edb8f7e4c172b53514d305a893fd8ce13b0781a631a8cbb9','2026-09-02T03:27:38.705Z'::timestamptz,'THDA 2026 Utility Allowance authority page','["UTILITY_ALLOWANCE"]'::jsonb,'https://thda.org/rental-housing-partn/utility-allowances/',106084,'text/html'),
      ('TX','Texas Department of Housing and Community Affairs','tdhca.texas.gov','LIHTC','COMPLIANCE_MANUALS_AND_RULES','https://www.tdhca.texas.gov/compliance-manuals-and-rules','6a4e53e0461c23121af12b657fa0dbbae723ebf84d915945b6ce89745db258fa','2026-09-02T03:27:40.668Z'::timestamptz,'TDHCA Compliance Manuals and Rules','["COMPLIANCE_GUIDEBOOK"]'::jsonb,'https://www.tdhca.texas.gov/compliance-manuals-and-rules',86561,'text/html'),
      ('TX','Texas Department of Housing and Community Affairs','tdhca.texas.gov','LIHTC','COMPLIANCE_MONITORING_RULE','https://www.tdhca.texas.gov/sites/default/files/pmcdocs/CM-SubCh-F-Searchable.pdf','2bfceae19671d1ec69fc7d318f4f31ca431aa8dc7c8b4e55763bc059f3569c2f','2026-09-02T03:27:41.260Z'::timestamptz,'TDHCA Compliance Monitoring Rule — Subchapter F searchable PDF','["COMPLIANCE_GUIDEBOOK","COMPLIANCE_RULE_CHANGES"]'::jsonb,'https://www.tdhca.texas.gov/compliance-manuals-and-rules',1362467,'application/pdf'),
      ('TX','Texas Department of Housing and Community Affairs','tdhca.texas.gov','LIHTC','INCOME_AND_RENT_LIMITS','https://www.tdhca.texas.gov/income-and-rent-limits','6933381c1c02e0f06f7ddc08a00cc03f045804f2d557f2e7c467f160aae1eca5','2026-09-02T03:27:41.515Z'::timestamptz,'TDHCA Income and Rent Limits','["INCOME_LIMITS","RENT_LIMITS"]'::jsonb,'https://www.tdhca.texas.gov/income-and-rent-limits',85913,'text/html'),
      ('TX','Texas Department of Housing and Community Affairs','tdhca.texas.gov','LIHTC','INCOME_AND_RENT_TOOL_INSTRUCTIONS','https://www.tdhca.texas.gov/sites/default/files/pmcdocs/IRL-Instructions.pdf','f5398fc9f4bbbfd459bf0ca45a9f123867a504e85286a91591c4056a4976f3b0','2026-09-02T03:27:41.854Z'::timestamptz,'Instructions on How To Use the Department Income and Rent Tool','["INCOME_LIMITS","RENT_LIMITS"]'::jsonb,'https://www.tdhca.texas.gov/income-and-rent-limits',56472,'application/pdf'),
      ('TX','Texas Department of Housing and Community Affairs','tdhca.texas.gov','LIHTC','UTILITY_ALLOWANCE','https://www.tdhca.texas.gov/compliance-utility-allowance-information','bf4778e01057c860d2188e461987f4b2ecd99d78be51d2614a10d1a8220a59c9','2026-09-02T03:27:42.289Z'::timestamptz,'TDHCA Utility Allowance Information','["UTILITY_ALLOWANCE"]'::jsonb,'https://www.tdhca.texas.gov/compliance-utility-allowance-information',87914,'text/html'),
      ('TX','Texas Department of Housing and Community Affairs','tdhca.texas.gov','LIHTC','UTILITY_ALLOWANCE_FORM','https://www.tdhca.texas.gov/sites/default/files/pmcdocs/Allowance-Questionnaire_0.docx','8ba79233ef464074b01395261882df357c0346703c357c4073ec8071ece27f2c','2026-09-02T03:27:42.519Z'::timestamptz,'Utility Allowance Questionnaire','["UTILITY_ALLOWANCE"]'::jsonb,'https://www.tdhca.texas.gov/compliance-utility-allowance-information',37023,'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      ('TX','Texas Department of Housing and Community Affairs','tdhca.texas.gov','LIHTC','UTILITY_ALLOWANCE_TECHNICAL_GUIDE','https://www.tdhca.texas.gov/sites/default/files/pmcdocs/Actual-Use-TechGuide.pdf','deb39f310884e38af58b2f13cd59ba138662731d74fecc7e00c242f2bff49ce0','2026-09-02T03:27:43.024Z'::timestamptz,'Actual Use Technical Guide','["UTILITY_ALLOWANCE"]'::jsonb,'https://www.tdhca.texas.gov/compliance-utility-allowance-information',74886,'application/pdf'),
      ('TX','Texas Department of Housing and Community Affairs','tdhca.texas.gov','LIHTC','COMPLIANCE_FORMS','https://www.tdhca.texas.gov/compliance-forms','d324825914394369a90e843dd6fcb514546e5d91f2d9c0a190bbe4de8ebf3dec','2026-09-02T03:27:43.261Z'::timestamptz,'TDHCA Compliance Forms','["COMPLIANCE_FORMS"]'::jsonb,'https://www.tdhca.texas.gov/compliance-forms',99673,'text/html')
  )
  insert into public.state_rule_source_candidates(
    state_code,inventory_generated_at,scope,authority_name,official_domain,origin_file,
    program,source_type,source_url,candidate_status,agent_verification_status,
    exact_bytes_captured,compliance_activation_allowed,source_sha256,retrieved_at,
    verification_evidence
  )
  select
    r.state_code,p.inventory_generated_at,'STATEWIDE',r.authority_name,r.official_domain,
    'tn-tx-release-critical-documents-2026-09-02.json',r.program,r.source_type,r.source_url,
    'CAPTURED_EXACT_BYTES_PENDING_INDEPENDENT_VALIDATION','captured_unvalidated',
    true,false,r.source_sha256,r.retrieved_at,
    jsonb_build_object(
      'capture_kind','controlled_release_critical_document',
      'capture_actor','github_actions_controlled_capture',
      'capture_run','gate4_tn_tx_release_critical_2026_09_02',
      'artifact_digest','sha256:668c22e9b88cc78f49a9458a8625f95e67049e5dc311a6163f7988e1a23df0f0',
      'document_title',r.document_title,
      'document_families',r.document_families,
      'discovery_url',r.discovery_url,
      'content_type',r.content_type,
      'captured_byte_size',r.byte_size,
      'source_sha256',r.source_sha256,
      'exact_bytes_captured',true,
      'independent_validation_required',true,
      'independent_validation_completed',false,
      'compliance_activation_allowed',false
    )
  from rows r
  join public.state_rule_pack_candidates p on p.state_code=r.state_code
  on conflict(state_code,inventory_generated_at,scope,source_url) do update set
    authority_name=excluded.authority_name,
    official_domain=excluded.official_domain,
    origin_file=excluded.origin_file,
    program=excluded.program,
    source_type=excluded.source_type,
    candidate_status=excluded.candidate_status,
    agent_verification_status='captured_unvalidated',
    exact_bytes_captured=true,
    compliance_activation_allowed=false,
    source_sha256=excluded.source_sha256,
    retrieved_at=excluded.retrieved_at,
    verification_evidence=excluded.verification_evidence,
    updated_at=now();

  update public.state_rule_pack_candidates p
  set source_candidate_count=x.source_count,
      blocked_source_count=x.blocked_count,
      candidate_manifest=coalesce(p.candidate_manifest,'{}'::jsonb) || jsonb_build_object(
        'source_count',x.source_count,
        'required_document_family_gaps',coalesce((
          select jsonb_agg(gap order by gap)
          from jsonb_array_elements_text(coalesce(p.candidate_manifest->'required_document_family_gaps','[]'::jsonb)) g(gap)
          where gap not in ('COMPLIANCE_GUIDEBOOK','INCOME_LIMITS','RENT_LIMITS','UTILITY_ALLOWANCE','COMPLIANCE_FORMS')
        ),'[]'::jsonb),
        'release_critical_document_families_captured',true,
        'release_critical_capture_artifact_digest','sha256:668c22e9b88cc78f49a9458a8625f95e67049e5dc311a6163f7988e1a23df0f0',
        'last_controlled_source_capture','2026-09-02T03:27:43.261Z',
        'compliance_activation_allowed',false
      ),
      status='agent_verification_in_progress',
      compliance_activation_allowed=false,
      updated_at=now()
  from (
    select state_code,inventory_generated_at,count(*)::integer source_count,
      count(*) filter(where candidate_status like 'BLOCKED%' or agent_verification_status in('blocked','rejected'))::integer blocked_count
    from public.state_rule_source_candidates
    where state_code in('TN','TX')
    group by state_code,inventory_generated_at
  ) x
  where p.state_code=x.state_code and p.inventory_generated_at=x.inventory_generated_at;

  perform public.refresh_state_rule_release_work_item(id)
  from public.state_rule_pack_candidates
  where state_code in('TN','TX');
end $$;
