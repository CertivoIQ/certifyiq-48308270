-- Bind exact official HUD source bytes to the Document Intelligence registry.
-- This is source-control evidence only. No row becomes decision-authorized here.

update public.compliance_form_registry
set
  revision_label = '06/2014',
  source_url = 'https://www.hud.gov/sites/documents/50059.pdf',
  source_sha256 = 'faa2892a48ce00ac75b9c447e5f0ef3fc63c730127967ca37baedd77db1fe873',
  required_fields = '[
    {"group":"certification_identity","fields":["project","unit_number","effective_date","certification_type","head_of_household"]},
    {"group":"eligibility_and_income","fields":["household","income","assets","allowances_and_rent_calculations"]},
    {"group":"rent_summary","fields":["total_tenant_payment","tenant_rent","utility_reimbursement","assistance_payment"]}
  ]'::jsonb,
  required_signatures = '[
    {"role":"owner_agent","required":true},
    {"role":"head_of_household","required":true},
    {"role":"spouse_or_co_head","required_when_present":true},
    {"role":"other_adult_household_members","required_when_present":true}
  ]'::jsonb,
  validation_support = jsonb_build_object(
    'recognition', true,
    'decision_use', false,
    'source_capture', 'captured_exact_bytes',
    'source_byte_length', 301698,
    'source_retrieved_at', '2026-09-02T04:35:18.487Z',
    'pdf_magic_verified', true,
    'field_map_status', 'preliminary_source_mapped_fixture_validation_pending',
    'signature_map_status', 'source_mapped_fixture_validation_pending',
    'effective_date_status', 'not_independently_established'
  ),
  notes = 'Official HUD form revision and exact bytes captured. Required-field and signature controls are source-mapped but remain non-decision-authorized pending deterministic fixtures.',
  updated_at = now()
where form_code = 'HUD-50059' and revision_label = 'source validation required';

update public.compliance_form_registry
set
  revision_label = '06/2014',
  source_url = 'https://www.hud.gov/sites/documents/50059-a.pdf',
  source_sha256 = 'efe20bd39e192fa1bd2991ede64fbc4a9cfd0f8066a119d30320d980e766f6d3',
  required_fields = '[
    {"group":"partial_certification_identity","fields":["project_name","project_number","subsidy_type","contract_number","transaction_type","head_of_household","unit_number","bedrooms","building_id","effective_date"]},
    {"group":"transaction_detail","fields":["move_out","termination","gross_rent_change_or_unit_transfer","rent_and_assistance_fields"]}
  ]'::jsonb,
  required_signatures = '[
    {"role":"owner_agent","required":true},
    {"role":"head_of_household","required":true}
  ]'::jsonb,
  validation_support = jsonb_build_object(
    'recognition', true,
    'decision_use', false,
    'source_capture', 'captured_exact_bytes',
    'source_byte_length', 81340,
    'source_retrieved_at', '2026-09-02T04:35:18.487Z',
    'pdf_magic_verified', true,
    'field_map_status', 'preliminary_source_mapped_fixture_validation_pending',
    'signature_map_status', 'source_mapped_fixture_validation_pending',
    'effective_date_status', 'not_independently_established'
  ),
  notes = 'Official HUD partial-certification form and exact bytes captured; source-mapped controls remain pending fixture validation.',
  updated_at = now()
where form_code = 'HUD-50059-A' and revision_label = 'source validation required';

update public.compliance_form_registry
set
  revision_label = '02/2007',
  source_url = 'https://www.hud.gov/sites/documents/9887.pdf',
  source_sha256 = '2d0c8a68a3ecb25c2ea4ef2442fbd96b651bfcbc9d2c46ba45af6762b9d644a9',
  program_codes = array['HUD_MFH_PROJECT_BASED'],
  required_fields = '[
    {"group":"requesting_organizations","fields":["hud_office","owner_or_management_agent","pha_when_applicable"]},
    {"group":"consent","fields":["income_information_release_consent","date"]}
  ]'::jsonb,
  required_signatures = '[
    {"role":"head_spouse_or_co_head","required_regardless_of_age":true},
    {"role":"household_members_age_18_or_older","required":true},
    {"role":"new_adult_members","required_when_joining_or_turning_18":true}
  ]'::jsonb,
  validation_support = jsonb_build_object(
    'recognition', true,
    'decision_use', false,
    'source_capture', 'captured_exact_bytes',
    'source_byte_length', 134088,
    'source_retrieved_at', '2026-09-02T04:35:18.487Z',
    'pdf_magic_verified', true,
    'consent_expiration_months', 15,
    'field_map_status', 'preliminary_source_mapped_fixture_validation_pending',
    'signature_map_status', 'source_mapped_fixture_validation_pending',
    'effective_date_status', 'not_independently_established'
  ),
  notes = 'HUD-9887 is contained in the official HUD-9887/9887-A package. The form states who must sign and that the consent expires 15 months after signature.',
  updated_at = now()
where form_code = 'HUD-9887' and revision_label = 'source validation required';

update public.compliance_form_registry
set
  revision_label = '02/2007',
  source_url = 'https://www.hud.gov/sites/documents/9887.pdf',
  source_sha256 = '2d0c8a68a3ecb25c2ea4ef2442fbd96b651bfcbc9d2c46ba45af6762b9d644a9',
  program_codes = array['HUD_MFH_PROJECT_BASED'],
  required_fields = '[
    {"group":"consent_party","fields":["applicant_or_tenant_name","project_owner_or_representative_name","owner_representative_title"]},
    {"group":"consent_acknowledgement","fields":["consent_to_release","date"]}
  ]'::jsonb,
  required_signatures = '[
    {"role":"applicant_or_tenant","required":true},
    {"role":"project_owner_or_representative","required":true},
    {"role":"head_spouse_or_co_head","required_regardless_of_age":true},
    {"role":"household_members_age_18_or_older","required":true}
  ]'::jsonb,
  validation_support = jsonb_build_object(
    'recognition', true,
    'decision_use', false,
    'source_capture', 'captured_exact_bytes',
    'source_byte_length', 134088,
    'source_retrieved_at', '2026-09-02T04:35:18.487Z',
    'pdf_magic_verified', true,
    'individual_consent_expiration_months', 15,
    'field_map_status', 'preliminary_source_mapped_fixture_validation_pending',
    'signature_map_status', 'source_mapped_fixture_validation_pending',
    'effective_date_status', 'not_independently_established'
  ),
  notes = 'HUD-9887-A is contained in the official HUD-9887/9887-A package. Signature and consent controls are source mapped but remain pending deterministic fixtures.',
  updated_at = now()
where form_code = 'HUD-9887-A' and revision_label = 'source validation required';

update public.compliance_form_registry
set
  revision_label = '06/2016 package; Addendum A includes 04/2018 page',
  source_url = 'https://www.hud.gov/sites/documents/9834.pdf',
  source_sha256 = '0676e13ab491ab6dc90a27288348d3499fcaa94e8b825b0e2a6258dfe10e039c',
  required_fields = '[
    {"group":"review_identity","fields":["project_name","project_number","reviewer_name","review_type"]},
    {"group":"review_sections","fields":["desk_review","on_site_review","summary_report"]},
    {"group":"addendum_a_tenant_file_review","fields":["tenant_file_document_checks","verification","lease","income_and_rent","billing"]},
    {"group":"addendum_b_section_504","fields":["project_accessibility","accessible_units","program_accessibility"]}
  ]'::jsonb,
  required_signatures = '[
    {"role":"owner","required_when":"certifying applicable Addendum B Section 504 information"}
  ]'::jsonb,
  validation_support = jsonb_build_object(
    'recognition', true,
    'question_level_ingestion', false,
    'decision_use', false,
    'source_capture', 'captured_exact_bytes',
    'source_byte_length', 1150295,
    'source_retrieved_at', '2026-09-02T04:35:18.487Z',
    'pdf_magic_verified', true,
    'field_map_status', 'section_groups_mapped_question_level_fixture_validation_pending',
    'signature_map_status', 'conditional_owner_certification_mapped_fixture_validation_pending',
    'effective_date_status', 'not_independently_established'
  ),
  notes = 'Current HUD-posted package captured. The package contains mixed revision markings, including a 04/2018 Addendum A page within the broader 06/2016 form set; CertivoIQ therefore does not infer one universal effective date.',
  updated_at = now()
where form_code = 'HUD-9834' and revision_label = 'source validation required';

update public.compliance_form_registry
set
  revision_label = '01/2024',
  source_url = 'https://www.hud.gov/sites/dfiles/PIH/documents/50058-Family-Report.pdf',
  source_sha256 = '695c404ecd94c77f19fb3b91d02395c629f496481e5384aaae3d4c52aabc033e',
  program_codes = array['HCV_TENANT_BASED','HUD_PBV','PUBLIC_HOUSING','MOD_REHAB'],
  required_fields = '[
    {"group":"agency_and_action","fields":["agency","program","action_type","effective_date"]},
    {"group":"household","fields":["household_members","citizenship","disability","ssn_or_exemption"]},
    {"group":"unit","fields":["unit_address","bedrooms","inspection_fields_when_applicable"]},
    {"group":"financial","fields":["assets","annual_income","deductions","adjusted_income","total_tenant_payment"]},
    {"group":"program_specific","fields":["public_housing_or_voucher_or_mod_rehab_fields_as_applicable"]}
  ]'::jsonb,
  required_signatures = '[]'::jsonb,
  validation_support = jsonb_build_object(
    'recognition', true,
    'decision_use', false,
    'source_capture', 'captured_exact_bytes',
    'source_byte_length', 127207,
    'source_retrieved_at', '2026-09-02T04:35:18.487Z',
    'pdf_magic_verified', true,
    'signature_on_form', false,
    'hud_hotma_resource_updated', '2026-06-17',
    'supporting_instruction_source', jsonb_build_object(
      'url', 'https://www.hud.gov/sites/default/files/PIH/documents/50058-Instruction-Booklet.pdf',
      'sha256', 'ac8ad92ca9d88c58dad1c39fc22c2c2c0db5733bdd8a3172f21ce57952f3214c',
      'byte_length', 927388,
      'captured_at', '2026-09-02T04:35:18.487Z'
    ),
    'field_map_status', 'section_groups_mapped_line_level_fixture_validation_pending',
    'effective_date_status', 'revision_date_recorded_effective_date_not_inferred'
  ),
  notes = 'Bound to the revised HUD-50058 published through HUD HOTMA resources, not the obsolete 11/2013 generic forms-index PDF. HUD marks this form 01/2024; CertivoIQ does not infer a separate effective date from the revision label.',
  updated_at = now()
where form_code = 'HUD-50058' and revision_label = 'source validation required';

insert into public.compliance_form_registry(
  form_code, form_name, form_family, issuing_authority, program_codes,
  revision_label, source_url, source_sha256, required_fields, required_signatures,
  validation_support, support_status, notes
)
values
(
  'HUD-50058-MTW', 'HUD-50058 MTW Family Report', 'pha_reporting', 'HUD', array['MTW'],
  '01/2024', 'https://www.hud.gov/sites/dfiles/PIH/documents/50058-MTW-Family-Report.pdf',
  '53a64d02b5e6c07e1814c4f84b0109d796b6484ea17c5049693dcc9b0de40fbf',
  '[{"group":"mtw_family_report","fields":["agency","action","household","asset_income","mtw_program_specific_financial_fields","self_sufficiency_when_applicable"]}]'::jsonb,
  '[]'::jsonb,
  jsonb_build_object('recognition',true,'decision_use',false,'source_capture','captured_exact_bytes','source_byte_length',75935,'source_retrieved_at','2026-09-02T04:35:18.487Z','pdf_magic_verified',true,'signature_on_form',false,'field_map_status','section_groups_mapped_line_level_fixture_validation_pending','effective_date_status','revision_date_recorded_effective_date_not_inferred'),
  'source_validation_required',
  'Official MTW variant captured from HUD HOTMA resources; remains non-decision-authorized pending line-level fixtures.'
),
(
  'HUD-50058-MTW-EXPANSION', 'HUD-50058 MTW Expansion Family Report', 'pha_reporting', 'HUD', array['MTW_EXPANSION'],
  '01/2024', 'https://www.hud.gov/sites/dfiles/PIH/documents/50058-MTW-Expansion-Family-Report.pdf',
  '549f1d187a2431e99dd34d4af16eed5714f7cc1f95f724c5d2f00e6209d2e24e',
  '[{"group":"mtw_expansion_family_report","fields":["agency","action","household","assets","deductions","total_tenant_payment","program_specific_housing_fields","self_sufficiency_when_applicable"]}]'::jsonb,
  '[]'::jsonb,
  jsonb_build_object('recognition',true,'decision_use',false,'source_capture','captured_exact_bytes','source_byte_length',101723,'source_retrieved_at','2026-09-02T04:35:18.487Z','pdf_magic_verified',true,'signature_on_form',false,'field_map_status','section_groups_mapped_line_level_fixture_validation_pending','effective_date_status','revision_date_recorded_effective_date_not_inferred'),
  'source_validation_required',
  'Official MTW Expansion variant captured from HUD HOTMA resources; remains non-decision-authorized pending line-level fixtures.'
)
on conflict (form_code, revision_label) do update
set source_url = excluded.source_url,
    source_sha256 = excluded.source_sha256,
    required_fields = excluded.required_fields,
    required_signatures = excluded.required_signatures,
    validation_support = excluded.validation_support,
    notes = excluded.notes,
    updated_at = now();

insert into public.compliance_form_registry_events(registry_form_id, event_type, event_payload)
select registry.id, 'source_captured', jsonb_build_object(
  'source_url', registry.source_url,
  'sha256', registry.source_sha256,
  'revision_label', registry.revision_label,
  'support_status', registry.support_status,
  'decision_use', false,
  'capture_manifest_timestamp', '2026-09-02T04:35:18.487Z'
)
from public.compliance_form_registry registry
where registry.form_code in (
  'HUD-50059','HUD-50059-A','HUD-9887','HUD-9887-A','HUD-9834','HUD-50058','HUD-50058-MTW','HUD-50058-MTW-EXPANSION'
)
and registry.source_sha256 is not null
and not exists (
  select 1 from public.compliance_form_registry_events event
  where event.registry_form_id = registry.id
    and event.event_type = 'source_captured'
    and event.event_payload->>'sha256' = registry.source_sha256
);
