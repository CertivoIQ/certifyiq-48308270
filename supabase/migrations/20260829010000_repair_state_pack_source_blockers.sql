-- Repair source-discovery blockers without bypassing compliance validation.
-- These rows remain queued, fail-closed, and require exact-byte capture, SHA-256,
-- citation review, and independent human approval before any rule activation.

with repairs(
  state_code,
  old_source_type,
  old_candidate_status,
  new_source_type,
  new_source_url,
  new_official_domain,
  new_candidate_status,
  disposition
) as (
  values
    ('AK','AFFORDABLE_HOUSING_COMPLIANCE_REFERENCE_MANUAL','BLOCKED_COMPLIANCE_MANUAL_CURRENCY_REVIEW',
      'AFFORDABLE_HOUSING_COMPLIANCE_REFERENCE_MANUAL',
      'https://www.ahfc.us/pros/compliance-audit/affordable-housing-compliance-reference-manual',
      'ahfc.us','PENDING_EXACT_BYTES_AND_HASHES',
      'Replaced the stale 2011 direct PDF candidate with AHFC''s maintained manual index.'),
    ('ME','PROPERTY_MANAGEMENT_FORMS','BLOCKED_FORMS_PAGE_UNDER_UPDATE',
      'PROPERTY_MANAGEMENT_FORMS',
      'https://www.mainehousing.org/partners/partner-type/asset-management/property-management-forms',
      'mainehousing.org','PENDING_SOURCE_PAGE_REFRESH_AND_EXACT_BYTES',
      'The official page remains under update; keep it queued for refresh rather than treating the entire state pack as blocked.'),
    ('MS','HFA_PROGRAM_ROOT','BLOCKED_REQUIRED_DOCUMENT_INDEX_NOT_VERIFIED',
      'LIHTC_COMPLIANCE_PROGRAM_RESOURCES',
      'https://www.mshomecorp.com/property-managers/compliance-htc/',
      'mshomecorp.com','PENDING_EXACT_BYTES_AND_HASHES',
      'Replaced the generic agency homepage with MHC''s official LIHTC compliance resource page.'),
    ('MT','HOUSING_AGENCY_ROOT','BLOCKED_REQUIRED_DOCUMENT_INDEX_NOT_VERIFIED',
      'LIHTC_QUALIFIED_ALLOCATION_PLAN',
      'https://commerce.mt.gov/Housing/Developers/Housing-Credit/Qualified-Allocation-Plan',
      'commerce.mt.gov','PENDING_EXACT_BYTES_AND_HASHES',
      'Replaced the generic housing homepage with Montana''s official Housing Credit QAP index.'),
    ('NV','COMPLIANCE_MANUAL_FORMS_EXHIBITS','BLOCKED_COMPLIANCE_MANUAL_CURRENCY_REVIEW',
      'COMPLIANCE_MANUAL_FORMS_EXHIBITS',
      'https://housing.nv.gov/Programs/MFC/Multi-Family_Compliance_Manuals___Exhibits/',
      'housing.nv.gov','PENDING_EXACT_BYTES_AND_HASHES',
      'Replaced the legacy layout URL with Nevada Housing Division''s maintained compliance manuals and exhibits page.'),
    ('NY','AGENCY_DISCOVERY_ROOT','BLOCKED_REQUIRED_LIHTC_SOURCE_PAGES_NOT_VERIFIED',
      'NYC_HDC_ANNUAL_COMPLIANCE_MONITORING',
      'https://www.nychdc.com/manage',
      'nychdc.com','PENDING_EXACT_BYTES_AND_HASHES',
      'Replaced the HDC homepage with its official annual compliance monitoring and forms index.'),
    ('OR','AGENCY_DISCOVERY_ROOT','BLOCKED_REQUIRED_LIHTC_SOURCE_PAGES_NOT_VERIFIED',
      'LIHTC_PROGRAM_QAP_AND_RESOURCES',
      'https://www.oregon.gov/ohcs/rental-housing/housing-development/development-resources/pages/low-income-housing-tax-credits.aspx',
      'oregon.gov','PENDING_EXACT_BYTES_AND_HASHES',
      'Replaced the obsolete agency root with OHCS''s official LIHTC program and QAP resource page.'),
    ('SD','AGENCY_AND_PROGRAM_RESOURCES','BLOCKED_REQUIRED_DOCUMENT_LINKS_NOT_INDEPENDENTLY_VERIFIED',
      'LIHTC_PROGRAM_QAP_AND_RESOURCES',
      'https://www.sdhousing.org/develop-housing/available-development-programs/housing-tax-credits',
      'sdhousing.org','PENDING_EXACT_BYTES_AND_HASHES',
      'Replaced the retired SDHDA homepage with South Dakota Housing''s current HTC program, QAP, application, and compliance links.'),
    ('UT','AGENCY_DISCOVERY_ROOT','BLOCKED_REQUIRED_LIHTC_SOURCE_PAGES_NOT_VERIFIED',
      'LIHTC_APPLICATION_AND_QAP_INDEX',
      'https://utahhousingcorp.org/multifamily/applicationInfo/',
      'utahhousingcorp.org','PENDING_EXACT_BYTES_AND_HASHES',
      'Replaced the generic agency homepage with Utah Housing Corporation''s multifamily application and QAP index.'),
    ('VT','FORMS_LIMITS_AND_COMPLIANCE','BLOCKED_COMPLIANCE_MANUAL_CURRENCY_REVIEW',
      'FORMS_LIMITS_AND_COMPLIANCE',
      'https://vhfa.org/managing-agents/forms-documents',
      'vhfa.org','PENDING_MANUAL_CURRENCY_AND_EXACT_BYTES',
      'The official forms index remains authoritative; queue its linked manual for currency and exact-byte review.'),
    ('VT','QAP_DRAFT','BLOCKED_DRAFT_NOT_FINAL',
      'CURRENT_QAP',
      'https://vhfa.org/developers/lihtc/qap',
      'vhfa.org','PENDING_EXACT_BYTES_AND_HASHES',
      'Replaced a draft comparison document with VHFA''s official Current QAP index, which identifies the Governor-approved plan.')
)
update public.state_rule_source_candidates as s
set
  source_type = r.new_source_type,
  source_url = r.new_source_url,
  official_domain = r.new_official_domain,
  candidate_status = r.new_candidate_status,
  agent_verification_status = 'queued_for_agent_verification',
  exact_bytes_captured = false,
  source_sha256 = null,
  retrieved_at = null,
  compliance_activation_allowed = false,
  verification_evidence = coalesce(s.verification_evidence, '{}'::jsonb) ||
    jsonb_build_object(
      'source_triage_2026_08_29',
      jsonb_build_object(
        'previous_source_type', s.source_type,
        'previous_source_url', s.source_url,
        'previous_candidate_status', s.candidate_status,
        'disposition', r.disposition,
        'triaged_at', '2026-08-29T00:00:00Z',
        'independent_validation_complete', false,
        'human_approval_required', true
      )
    ),
  updated_at = now()
from repairs as r
where s.state_code = r.state_code
  and s.source_type = r.old_source_type
  and s.candidate_status = r.old_candidate_status;

update public.state_rule_pack_candidates as p
set
  blocked_source_count = counts.blocked_count,
  status = case when p.status = 'blocked' then 'queued_for_agent_verification' else p.status end,
  compliance_activation_allowed = false,
  updated_at = now()
from (
  select
    p2.id,
    count(s.id) filter (where s.candidate_status like 'BLOCKED%')::integer as blocked_count
  from public.state_rule_pack_candidates p2
  left join public.state_rule_source_candidates s
    on s.state_code = p2.state_code
   and s.inventory_generated_at = p2.inventory_generated_at
  group by p2.id
) as counts
where p.id = counts.id;

do $$
declare
  remaining_blockers integer;
  prematurely_activated integer;
begin
  select count(*) into remaining_blockers
  from public.state_rule_source_candidates
  where state_code in ('AK','ME','MS','MT','NV','NY','OR','SD','UT','VT')
    and candidate_status like 'BLOCKED%';

  if remaining_blockers <> 0 then
    raise exception 'State source repair incomplete: % blocker rows remain', remaining_blockers;
  end if;

  select count(*) into prematurely_activated
  from public.state_rule_source_candidates
  where state_code in ('AK','ME','MS','MT','NV','NY','OR','SD','UT','VT')
    and (
      compliance_activation_allowed
      or exact_bytes_captured
      or source_sha256 is not null
      or agent_verification_status <> 'queued_for_agent_verification'
    );

  if prematurely_activated <> 0 then
    raise exception 'Fail-closed invariant violated for % repaired rows', prematurely_activated;
  end if;
end
$$;
