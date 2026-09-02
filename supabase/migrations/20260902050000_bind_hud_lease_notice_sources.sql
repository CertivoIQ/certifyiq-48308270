-- Bind exact-byte HUD model leases and resident-notice forms.
-- All rows remain fail-closed for compliance decision use.

insert into public.compliance_form_registry(
  form_code, form_name, form_family, issuing_authority, program_codes,
  revision_label, source_url, source_sha256, required_fields, required_signatures,
  validation_support, support_status, notes
)
values
(
  'HUD-90105-A','HUD Model Lease for Subsidized Programs','lease_addendum_notice','HUD',array['HUD_MFH_PROJECT_BASED'],
  '12/2007','https://www.hud.gov/sites/dfiles/OCHCO/documents/90105a.pdf','ae735de3c9619a2bb7f2431db1d06e2476468d627e82232fe463815b08b78754',
  '[{"group":"lease_identity","fields":["landlord","tenant","unit","project","term"]},{"group":"lease_financial","fields":["rent","utilities","charges","security_deposit"]},{"group":"occupancy_and_recertification","fields":["household","recertification","attachments"]}]'::jsonb,
  '[{"role":"landlord_or_owner_representative","required":true},{"role":"tenant","required":true},{"role":"additional_tenant_signatures","required_when_applicable":true}]'::jsonb,
  jsonb_build_object('recognition',true,'decision_use',false,'source_capture','captured_exact_bytes','source_byte_length',266465,'source_retrieved_at','2026-09-02T04:44:17.415Z','pdf_magic_verified',true,'field_map_status','source_mapped_fixture_validation_pending','signature_map_status','source_mapped_fixture_validation_pending','effective_date_status','revision_date_recorded_effective_date_not_inferred'),
  'source_validation_required','Exact HUD bytes captured. Program applicability, lease clauses, attachments, and signature fixtures remain validation-gated.'
),
(
  'HUD-90105-B','HUD Model Lease for Section 202/8 or Section 202 PAC','lease_addendum_notice','HUD',array['HUD_MFH_PROJECT_BASED'],
  '12/2007','https://www.hud.gov/sites/dfiles/OCHCO/documents/90105b.pdf','4199df227db0987b4444215671d787259ff7c83ed6f7dcc00cb20c26b932a028',
  '[{"group":"lease_identity","fields":["landlord","tenant","unit","project","term"]},{"group":"lease_financial","fields":["rent","utilities","charges","security_deposit"]},{"group":"section_202_8_or_pac","fields":["program_terms","recertification","attachments"]}]'::jsonb,
  '[{"role":"landlord_or_owner_representative","required":true},{"role":"tenant","required":true},{"role":"witness_or_additional_signature","required_when_applicable":true}]'::jsonb,
  jsonb_build_object('recognition',true,'decision_use',false,'source_capture','captured_exact_bytes','source_byte_length',395317,'source_retrieved_at','2026-09-02T04:44:17.415Z','pdf_magic_verified',true,'field_map_status','source_mapped_fixture_validation_pending','signature_map_status','source_mapped_fixture_validation_pending','effective_date_status','revision_date_recorded_effective_date_not_inferred'),
  'source_validation_required','Exact HUD bytes captured for the Section 202/8 or Section 202 PAC model lease. Detailed program routing remains validation-gated.'
),
(
  'HUD-90105-C','HUD Model Lease for Section 202 PRAC','lease_addendum_notice','HUD',array['HUD_MFH_PROJECT_BASED'],
  '12/2007','https://www.hud.gov/sites/dfiles/OCHCO/documents/90105c.pdf','7f735fb8e5601b98378231ace21fa8553cec0a06865c8ec0006af8ae4140dc69',
  '[{"group":"lease_identity","fields":["landlord","tenant","unit","project","term"]},{"group":"lease_financial","fields":["rent","utilities","charges","security_deposit"]},{"group":"section_202_prac","fields":["program_terms","recertification","attachments"]}]'::jsonb,
  '[{"role":"landlord_or_owner_representative","required":true},{"role":"tenant","required":true},{"role":"witness_or_additional_signature","required_when_applicable":true}]'::jsonb,
  jsonb_build_object('recognition',true,'decision_use',false,'source_capture','captured_exact_bytes','source_byte_length',185420,'source_retrieved_at','2026-09-02T04:44:17.415Z','pdf_magic_verified',true,'field_map_status','source_mapped_fixture_validation_pending','signature_map_status','source_mapped_fixture_validation_pending','effective_date_status','revision_date_recorded_effective_date_not_inferred'),
  'source_validation_required','Exact HUD bytes captured for the Section 202 PRAC model lease; deterministic lease fixtures remain pending.'
),
(
  'HUD-90105-D','HUD Model Lease for Section 811 PRAC','lease_addendum_notice','HUD',array['HUD_MFH_PROJECT_BASED'],
  '12/2007','https://www.hud.gov/sites/dfiles/OCHCO/documents/90105d.pdf','63b6490e68595cf800edc9178b326c33f37e1ead1a5cbad574f3b20db225bd3d',
  '[{"group":"lease_identity","fields":["landlord","tenant","unit","project","term"]},{"group":"lease_financial","fields":["rent","utilities","charges","security_deposit"]},{"group":"section_811_prac","fields":["program_terms","recertification","attachments"]}]'::jsonb,
  '[{"role":"landlord_or_owner_representative","required":true},{"role":"tenant","required":true},{"role":"witness_or_additional_signature","required_when_applicable":true}]'::jsonb,
  jsonb_build_object('recognition',true,'decision_use',false,'source_capture','captured_exact_bytes','source_byte_length',147782,'source_retrieved_at','2026-09-02T04:44:17.415Z','pdf_magic_verified',true,'field_map_status','source_mapped_fixture_validation_pending','signature_map_status','source_mapped_fixture_validation_pending','effective_date_status','revision_date_recorded_effective_date_not_inferred'),
  'source_validation_required','Exact HUD bytes captured for the Section 811 PRAC model lease; deterministic lease fixtures remain pending.'
),
(
  'HUD-90100','HUD Annual Recertification Initial Notice','lease_addendum_notice','HUD',array['HUD_MFH_PROJECT_BASED'],
  '12/2007','https://www.hud.gov/sites/documents/90100.pdf','4bd7f0c562aa4acbe7da08d5ae86d261fde365138f862cfbdddd09188a1f78eb',
  '[{"group":"notice_identity","fields":["tenant_name","address","notice_date"]},{"group":"recertification_timing","fields":["interview_month","interview_year","required_information","recertification_deadline"]}]'::jsonb,
  '[{"role":"head_of_family_or_resident","required":true},{"role":"witness_or_owner_representative","required":true}]'::jsonb,
  jsonb_build_object('recognition',true,'decision_use',false,'source_capture','captured_exact_bytes','source_byte_length',72805,'source_retrieved_at','2026-09-02T04:44:17.415Z','pdf_magic_verified',true,'field_map_status','source_mapped_fixture_validation_pending','signature_map_status','source_mapped_fixture_validation_pending','effective_date_status','revision_date_recorded_effective_date_not_inferred'),
  'source_validation_required','Exact HUD annual-recertification initial-notice bytes captured. Timing and signature fixtures remain pending.'
),
(
  'HUD-5380','HUD VAWA Notice of Occupancy Rights','lease_addendum_notice','HUD',array[]::text[],
  'OMB expires 01/31/2028','https://www.hud.gov/sites/dfiles/OCHCO/documents/5380.pdf','2d4c0ff21a92c35b05285edc589ffe36eb0f173665642e5fdec8ebc6ffd4dc80',
  '[{"group":"provider_and_program","fields":["covered_housing_provider","contact_information","applicable_program"]},{"group":"notice_content","fields":["occupancy_rights","documentation_options","confidentiality_information"]}]'::jsonb,
  '[]'::jsonb,
  jsonb_build_object('recognition',true,'decision_use',false,'source_capture','captured_exact_bytes','source_byte_length',1875600,'source_retrieved_at','2026-09-02T04:44:17.415Z','pdf_magic_verified',true,'sensitive_document',true,'restricted_content_ingestion',true,'separate_secure_storage_required',true,'standard_document_intelligence_processing',false,'field_map_status','restricted_workflow_required','effective_date_status','omb_expiration_recorded_effective_date_not_inferred'),
  'source_validation_required','VAWA notice definition only. Standard Document Intelligence content processing is blocked pending a safeguarded VAWA workflow.'
),
(
  'HUD-5382','HUD VAWA Certification and Alternate Documentation','lease_addendum_notice','HUD',array[]::text[],
  'OMB expires 01/31/2028','https://www.hud.gov/sites/dfiles/OCHCO/documents/5382.pdf','7cf850e5c58ace85ce24197d86fff6a9d596374d12f95afe9a9013f6f8f12580',
  '[{"group":"certification","fields":["requester_or_victim_information","incident_information","alternate_documentation_when_used"]},{"group":"certification_statement","fields":["certification"]}]'::jsonb,
  '[{"role":"person_submitting_certification","required":true},{"role":"date","required":true}]'::jsonb,
  jsonb_build_object('recognition',true,'decision_use',false,'source_capture','captured_exact_bytes','source_byte_length',1878163,'source_retrieved_at','2026-09-02T04:44:17.415Z','pdf_magic_verified',true,'sensitive_document',true,'restricted_content_ingestion',true,'separate_secure_storage_required',true,'standard_document_intelligence_processing',false,'field_map_status','restricted_workflow_required','signature_map_status','source_mapped_restricted_workflow_required','effective_date_status','omb_expiration_recorded_effective_date_not_inferred'),
  'source_validation_required','Sensitive VAWA certification definition only. Standard Document Intelligence content processing is blocked pending a safeguarded VAWA workflow.'
),
(
  'HUD-5383','HUD VAWA Emergency Transfer Request','lease_addendum_notice','HUD',array[]::text[],
  'OMB expires 01/31/2028','https://www.hud.gov/sites/dfiles/OCHCO/documents/5383.pdf','c139b9b58bd4808c810fc7fce3dc01b6918b71c1162812b0ffea6f6b59218404',
  '[{"group":"transfer_request","fields":["victim_names","requester_name","household_members","members_transferring","perpetrator_if_known_and_safe","current_address","bedrooms","safe_contact_methods"]},{"group":"transfer_preferences","fields":["safety_preferences"]},{"group":"tenant_certification","fields":["certification"]}]'::jsonb,
  '[{"role":"tenant_or_requester","required":true},{"role":"date","required":true}]'::jsonb,
  jsonb_build_object('recognition',true,'decision_use',false,'source_capture','captured_exact_bytes','source_byte_length',1706396,'source_retrieved_at','2026-09-02T04:44:17.415Z','pdf_magic_verified',true,'sensitive_document',true,'restricted_content_ingestion',true,'separate_secure_storage_required',true,'standard_document_intelligence_processing',false,'field_map_status','restricted_workflow_required','signature_map_status','source_mapped_restricted_workflow_required','effective_date_status','omb_expiration_recorded_effective_date_not_inferred'),
  'source_validation_required','Sensitive VAWA emergency-transfer definition only. Standard Document Intelligence content processing is blocked pending a safeguarded VAWA workflow.'
)
on conflict (form_code, revision_label) do update
set source_url=excluded.source_url,
    source_sha256=excluded.source_sha256,
    required_fields=excluded.required_fields,
    required_signatures=excluded.required_signatures,
    validation_support=excluded.validation_support,
    notes=excluded.notes,
    updated_at=now();

insert into public.compliance_form_registry_events(registry_form_id,event_type,event_payload)
select registry.id,'source_captured',jsonb_build_object(
  'source_url',registry.source_url,
  'sha256',registry.source_sha256,
  'revision_label',registry.revision_label,
  'support_status',registry.support_status,
  'decision_use',false,
  'capture_manifest_timestamp','2026-09-02T04:44:17.415Z'
)
from public.compliance_form_registry registry
where registry.form_code in ('HUD-90105-A','HUD-90105-B','HUD-90105-C','HUD-90105-D','HUD-90100','HUD-5380','HUD-5382','HUD-5383')
  and registry.source_sha256 is not null
  and not exists (
    select 1 from public.compliance_form_registry_events event
    where event.registry_form_id=registry.id
      and event.event_type='source_captured'
      and event.event_payload->>'sha256'=registry.source_sha256
  );
