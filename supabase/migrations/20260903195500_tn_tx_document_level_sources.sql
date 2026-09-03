-- TN/TX document-level source recrawl captured 2026-09-03.
-- Every row below is an exact downloadable file hash. HTML landing pages remain
-- discovery-only and cannot satisfy validation. All rows remain fail-closed
-- pending independent validation.

with docs(state_code,authority_name,official_domain,program,source_type,document_title,programs_csv,roles_csv,source_url,final_url,discovery_url,content_type,byte_size,source_sha256,retrieved_at) as (
 values
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'LIHTC', 'TN_2026_LIHTC_QAP', '2026 Qualified Allocation Plan', 'LIHTC', 'LIHTC_QAP', 'https://thda.org/wp-content/uploads/2026/01/2026-QAP-01.06.2026-003.pdf', 'https://thda.org/wp-content/uploads/2026/01/2026-QAP-01.06.2026-003.pdf', null, 'application/pdf', 1111281, '6bc2c372995bfab8bf1d1205a0408e008442e1295736838e9b255d676f722f7a', '2026-09-03T19:48:24.665Z'),
 ('TX', 'Texas Department of Housing and Community Affairs', 'tdhca.texas.gov', 'LIHTC', 'TX_2026_LIHTC_QAP', '2026 Qualified Allocation Plan', 'LIHTC', 'LIHTC_QAP', 'https://www.tdhca.texas.gov/sites/default/files/multifamily/docs/26-QAP.pdf', 'https://www.tdhca.texas.gov/sites/default/files/multifamily/docs/26-QAP.pdf', null, 'application/pdf', 1755171, '4bda851be19661d53b5729edd8b49378c41e170b16d5fefcadddcc6b0de60b8a', '2026-09-03T19:48:25.074Z'),
 ('TX', 'Texas Department of Housing and Community Affairs', 'tdhca.texas.gov', 'LIHTC', 'TX_LIHTC_COMPLIANCE_RULE_SUBCHAPTER_F', 'Compliance Monitoring Rule – Subchapter F', 'LIHTC', 'LIHTC_COMPLIANCE_RULE', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/CM-SubCh-F-Searchable.pdf', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/CM-SubCh-F-Searchable.pdf', null, 'application/pdf', 1362467, '2bfceae19671d1ec69fc7d318f4f31ca431aa8dc7c8b4e55763bc059f3569c2f', '2026-09-03T19:48:25.441Z'),
 ('TX', 'Texas Department of Housing and Community Affairs', 'tdhca.texas.gov', 'LIHTC', 'TX_HOTMA_INCOME_CERTIFICATION_FORM', 'Income Certification', 'LIHTC,HOTMA', 'INCOME_CERTIFICATION_FORM', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-IncomeCert_1.pdf', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-IncomeCert_1.pdf', null, 'application/pdf', 603883, '7d7d6f75eeb258a856cfbde56b5f2a01544e51005a79efd852e0826f20531ff0', '2026-09-03T19:48:25.756Z'),
 ('TX', 'Texas Department of Housing and Community Affairs', 'tdhca.texas.gov', 'LIHTC', 'TX_HOTMA_INCOME_CERTIFICATION_INSTRUCTIONS', 'Income Certification Instructions', 'LIHTC,HOTMA', 'HOTMA_INCOME_CERTIFICATION_INSTRUCTIONS', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-IncomeCertInst_2.pdf', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-IncomeCertInst_2.pdf', null, 'application/pdf', 241755, 'cc23314da134dffcc2671434ccec36d26fd9fd4dc78e436a56ded7f36cd2da32', '2026-09-03T19:48:26.068Z'),
 ('TX', 'Texas Department of Housing and Community Affairs', 'tdhca.texas.gov', 'LIHTC', 'TX_ASSET_CERTIFICATION_FORM', 'Asset Certification of Net Family Assets', 'LIHTC,HOTMA', 'ASSET_CERTIFICATION_FORM', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/24-AssetCert-NetFamily-en_0.pdf', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/24-AssetCert-NetFamily-en_0.pdf', null, 'application/pdf', 232613, 'f675559b8557f4456505974704bc30ec653180150bf1b82de7fd58cd84f70b1a', '2026-09-03T19:48:26.370Z'),
 ('TX', 'Texas Department of Housing and Community Affairs', 'tdhca.texas.gov', 'LIHTC', 'TX_HOTMA_EMPLOYMENT_VERIFICATION_FORM', 'Employment Verification', 'LIHTC,HOTMA', 'EMPLOYMENT_VERIFICATION_FORM', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-EmployVer.pdf', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-EmployVer.pdf', null, 'application/pdf', 159646, 'f82416912d38b1adb62ece7a531586e091457c342383e95e0b8f218d2963fd61', '2026-09-03T19:48:26.654Z'),
 ('TX', 'Texas Department of Housing and Community Affairs', 'tdhca.texas.gov', 'LIHTC', 'TX_SECTION8_INCOME_VERIFICATION_FORM', 'Income Verification for Households with Section 8 Certificates', 'LIHTC,SECTION_8,HCV,PBV', 'SECTION8_INCOME_VERIFICATION_FORM', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/Sec8Ver_0.pdf', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/Sec8Ver_0.pdf', null, 'application/pdf', 128727, 'f655c7d8f401a769838097eedabef94f2297cbfcaef11d6e5cefd0e7c09b5819', '2026-09-03T19:48:26.937Z'),
 ('TX', 'Texas Department of Housing and Community Affairs', 'tdhca.texas.gov', 'SECTION_8', 'TX_HCV_PBV_ADMIN_PLAN', 'Housing Choice Voucher Administrative Plan', 'SECTION_8,HCV,PBV', 'HCV_ADMIN_PLAN,PBV_ADMIN_CHAPTER', 'https://www.tdhca.texas.gov/sites/default/files/section-8/docs/22-HCVP-AdminPlan.pdf', 'https://www.tdhca.texas.gov/sites/default/files/section-8/docs/22-HCVP-AdminPlan.pdf', null, 'application/pdf', 2501272, '6f3c44eb8c6bf9c2ea8097461c60858ad0b870fc3b04eb37380ae82d28c2563a', '2026-09-03T19:48:27.239Z'),
 ('TX', 'Texas Department of Housing and Community Affairs', 'tdhca.texas.gov', 'SECTION_8', 'TX_2026_HCV_UTILITY_ALLOWANCE', '2026 HCV Utility Allowance Schedules', 'SECTION_8,HCV,PBV', 'HCV_UTILITY_ALLOWANCE_SCHEDULE', 'https://www.tdhca.texas.gov/sites/default/files/section-8/docs/26-UtilityAllowances.pdf', 'https://www.tdhca.texas.gov/sites/default/files/section-8/docs/26-UtilityAllowances.pdf', null, 'application/pdf', 1066520, 'df4e294d1d87b91d3fa2385dd19430fde1b43a4f3b5cef6ff2df91d529fa3e4e', '2026-09-03T19:48:27.589Z'),
 ('TX', 'Texas Department of Housing and Community Affairs', 'tdhca.texas.gov', 'SECTION_8', 'TX_2027_HCV_PHA_PLAN', '2027 HCV PHA Plan', 'SECTION_8,HCV,PBV,HOTMA', 'PHA_PLAN_CURRENT', 'https://www.tdhca.texas.gov/sites/default/files/section-8/docs/27-S8-PHA-Plan.pdf', 'https://www.tdhca.texas.gov/sites/default/files/section-8/docs/27-S8-PHA-Plan.pdf', null, 'application/pdf', 216671, '96b565a1e52c060f737abd20c36dbc773a7d395cc93c44b999492f4c6d91047b', '2026-09-03T19:48:27.890Z'),
 ('TX', 'Texas Department of Housing and Community Affairs', 'tdhca.texas.gov', 'LIHTC', 'TX_HOTMA_ASSET_GUIDANCE', 'Assets and HOTMA Changes', 'LIHTC,HOTMA', 'HOTMA_GUIDANCE', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/24-Assets-HOTMA-Changes.pdf', 'https://www.tdhca.texas.gov/sites/default/files/pmcdocs/24-Assets-HOTMA-Changes.pdf', null, 'application/pdf', 1492604, '538810faabfe9f6ffb9b0bd30da91bd7b4605f2f0396f69de841956ee7ef3ec8', '2026-09-03T19:48:28.214Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'LIHTC', 'TN_HOTMA_COMPLIANCE_GUIDANCE', 'HOTMA Compliance Training (11/18/2024)', 'LIHTC,HOTMA', 'HOTMA_GUIDANCE', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/MFD-HOTMA-Training.11182024.ADA-Updated-2026.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/MFD-HOTMA-Training.11182024.ADA-Updated-2026.pdf', 'https://thda.org/rental-housing-partn/housing-credit-compliance/', 'application/pdf', 252594, 'd9a8966d319c9c7f795017ff390a26a34ba380c90d9d61d4c666f2971324365c', '2026-09-03T19:48:29.175Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'LIHTC', 'TN_SECTION8_INCOME_VERIFICATION_FORM', 'HO-0423 - Verification of Annual Income, Household Size, and Utility Allowance by the Section 8 Administrative Agency for Applications with Housing Choice Vouchers', 'LIHTC,SECTION_8,HCV', 'SECTION8_INCOME_VERIFICATION_FORM', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/MFD-Section-8-Verification-of-Income-and-Utility-Allowance-Updated-2026.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/MFD-Section-8-Verification-of-Income-and-Utility-Allowance-Updated-2026.pdf', 'https://thda.org/rental-housing-partn/housing-credit-compliance/', 'application/pdf', 150155, 'c1afb8061473dc1eab4c2aaf1eb10d2bbd027a3bb912df5460884e4d4aac5381', '2026-09-03T19:48:29.185Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'LIHTC', 'TN_EMPLOYMENT_VERIFICATION_FORM', 'Employment Verification', 'LIHTC,HOTMA', 'EMPLOYMENT_VERIFICATION_FORM', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/THDA-Employment-Verification-Updated-6-2026.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/THDA-Employment-Verification-Updated-6-2026.pdf', 'https://thda.org/rental-housing-partn/housing-credit-compliance/', 'application/pdf', 158299, '928715d616b0d9c5f009ca465d09118f650e71aa3ad7f32a40e8b95ac170b241', '2026-09-03T19:48:29.195Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'LIHTC', 'TN_ASSET_SELF_CERTIFICATION_FORM', 'Asset Self-Certification Worksheet', 'LIHTC,HOTMA', 'ASSET_CERTIFICATION_FORM', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/CAM_2026_TN-Asset-Self-Certification-Worksheet.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/CAM_2026_TN-Asset-Self-Certification-Worksheet.pdf', 'https://thda.org/rental-housing-partn/housing-credit-compliance/', 'application/pdf', 252220, 'cc2054ad827a19259ee4d3623a2863b156a87e0a44c78cf22f5653ce7bfe55eb', '2026-09-03T19:48:29.205Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'LIHTC', 'TN_THOMAS_COMPLIANCE_GUIDE', 'THOMAS Compliance Guide', 'LIHTC', 'LIHTC_COMPLIANCE_GUIDE', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/Updated-THOMAS-Compliance-Guide.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/Updated-THOMAS-Compliance-Guide.pdf', 'https://thda.org/rental-housing-partn/thomas-documents/', 'application/pdf', 1719836, '7b2f5ec006e8925b3916f9bba46c6a7e662ea8a3b6cd2d3be28f9805082c51aa', '2026-09-03T19:48:30.072Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'LIHTC', 'TN_LIHTC_UTILITY_ALLOWANCE_GUIDANCE', 'Utility Allowance Guidance', 'LIHTC', 'UTILITY_ALLOWANCE_GUIDANCE', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/Utility-Allowance-Guidance.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/Utility-Allowance-Guidance.pdf', 'https://thda.org/rental-housing-partn/thomas-documents/', 'application/pdf', 305215, '326064030bf93d60893eda51052131c7b1372b8e4dea2909c92a4e417ffe92cd', '2026-09-03T19:48:30.088Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'LIHTC', 'TN_2026_LIHTC_ELIGIBILITY_CERTIFICATION', '2026 LIHTC Eligibility Certification - BOTH', 'LIHTC', 'LIHTC_ELIGIBILITY_CERTIFICATION_FORM', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/MF_2026_LIHTC-Attachment-21-Eligibility-1.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/MF_2026_LIHTC-Attachment-21-Eligibility-1.pdf', 'https://thda.org/rental-housing-partn/thomas-documents/', 'application/pdf', 186014, '62fda051191b5a953f0aeceb8a048aaffea4a9686e9cc85185f4d3677b3ec9b7', '2026-09-03T19:48:30.102Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'LIHTC', 'TN_UTILITY_ALLOWANCE_CERTIFICATION_FORM', 'Utility Allowance Certification and Utility Worksheet - BOTH', 'LIHTC', 'UTILITY_ALLOWANCE_FORM', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/Utility-Allowance-Certification-and-Utility-Worksheet.xlsx', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/Utility-Allowance-Certification-and-Utility-Worksheet.xlsx', 'https://thda.org/rental-housing-partn/thomas-documents/', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 1739638, '94edea5e1fbafd3055c3ad79017fab13f47b57f13eb76d05c472813c40a74bfc', '2026-09-03T19:48:30.768Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'SECTION_8', 'TN_HCV_2026_HOTMA_NSPIRE_RULE_UPDATE', '2026 Emergency Rule Changes HOTMA – NSPIRE (EFF. 1-19-2026)', 'SECTION_8,HCV,PBV,HOTMA', 'HCV_HOTMA_NSPIRE_RULE_UPDATE', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/S8RA-2026-ADMIN.PLAN_NSPIRE-and-HOTMA.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/S8RA-2026-ADMIN.PLAN_NSPIRE-and-HOTMA.pdf', 'https://thda.org/help-for-renters/hcv-administrative-plans-policy-and-rules/', 'application/pdf', 563895, '4bbe0fc43cad9fb6a881d10564fff35003bbc120677af14c633bb09e37407e5c', '2026-09-03T19:48:31.601Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'SECTION_8', 'TN_PBV_2025_ADMIN_PLAN_AMENDMENT', '2025 PBV - Single Chapter Amendment (eff. 7-31-2025)', 'SECTION_8,HCV,PBV,HOTMA', 'PBV_ADMIN_CHAPTER,PBV_ADMIN_PLAN_AMENDMENT', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/PBV-Program-Finalized-for-Posting.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/PBV-Program-Finalized-for-Posting.pdf', 'https://thda.org/help-for-renters/hcv-administrative-plans-policy-and-rules/', 'application/pdf', 2939382, '86f96096cc1826baee684390b276f52bb5dfb1c31a697c52cfea9b19e332aaeb', '2026-09-03T19:48:31.706Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'SECTION_8', 'TN_2025_HCV_PHA_PLAN', 'HCV 2025 5-Year PHA Plan (eff. 7-1-2025)', 'SECTION_8,HCV,PBV', 'PHA_PLAN_CURRENT', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/2025-5-Year-plan-combined.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/2025-5-Year-plan-combined.pdf', 'https://thda.org/help-for-renters/hcv-administrative-plans-policy-and-rules/', 'application/pdf', 2737601, 'cc58ae3f9058c4dc372261c5f12a15723a9a6da45ba88a2d90aad6064efc4be1', '2026-09-03T19:48:31.761Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'SECTION_8', 'TN_HCV_ADMIN_PLAN', 'Administrative Plan Effective June 2024', 'SECTION_8,HCV,PBV', 'HCV_ADMIN_PLAN', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/Administrative-Plan-Effective-June-2024-reupload.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/Administrative-Plan-Effective-June-2024-reupload.pdf', 'https://thda.org/help-for-renters/hcv-administrative-plans-policy-and-rules/', 'application/pdf', 1344336, '2065899b72089e8066e1140f7ba80ba82f95d23465939f32a65ecc450c30dd76', '2026-09-03T19:48:31.788Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'SECTION_8', 'TN_2026_HCV_UTILITY_ALLOWANCE_METHODOLOGY', '2026 Utility Allowance Methodology', 'SECTION_8,HCV,PBV', 'HCV_UTILITY_ALLOWANCE_METHODOLOGY', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/RP_2026-Utility-Allowance-Methodology-Hedgerow-Partners-LLC.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/RP_2026-Utility-Allowance-Methodology-Hedgerow-Partners-LLC.pdf', 'https://thda.org/rental-housing-partn/utility-allowances/', 'application/pdf', 697724, '9bf05ee27c8ff30989420f02517ee81f8ddbe6fb9ee9a87bc545c01ea35e45ec', '2026-09-03T19:48:32.765Z'),
 ('TN', 'Tennessee Housing Development Agency', 'thda.org', 'SECTION_8', 'TN_2026_HCV_UTILITY_ALLOWANCE_INSTRUCTIONS', 'Instructions for 2026 Utility Allowances updated', 'SECTION_8,HCV,PBV', 'HCV_UTILITY_ALLOWANCE_INSTRUCTIONS', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/RP_2026-Utility-Allowance-Instructions.pdf', 'https://dogvxws799i6n.cloudfront.net/wp-content/uploads/RP_2026-Utility-Allowance-Instructions.pdf', 'https://thda.org/rental-housing-partn/utility-allowances/', 'application/pdf', 168558, '02f076ce33b53cda09bacaf759331feb3ee9565f08f8d88a525bdd43f4f3e199', '2026-09-03T19:48:32.774Z')
)
insert into public.state_rule_source_candidates(
 state_code,inventory_generated_at,scope,authority_name,official_domain,origin_file,program,source_type,source_url,
 candidate_status,agent_verification_status,exact_bytes_captured,compliance_activation_allowed,source_sha256,retrieved_at,verification_evidence
)
select state_code,timestamptz '2026-08-27 00:00:00+00','STATEWIDE',authority_name,official_domain,
 'tn-tx-document-level-recrawl-2026-09-03.json',program,source_type,source_url,
 'CAPTURED_EXACT_BYTES_PENDING_INDEPENDENT_VALIDATION','captured_unvalidated',true,false,source_sha256,retrieved_at::timestamptz,
 jsonb_build_object(
  'capture_kind','controlled_document_level_recrawl',
  'artifact_digest','sha256:cd18003ca776e9125429c2b1b878a2149acfe54ed7ce37810ca050aa42c5a524',
  'document_title',document_title,
  'document_roles',string_to_array(roles_csv,','),
  'programs',string_to_array(programs_csv,','),
  'final_url',final_url,
  'discovery_url',discovery_url,
  'content_type',content_type,
  'captured_byte_size',byte_size,
  'source_sha256',source_sha256,
  'evidence_kind','exact_document_bytes',
  'validation_evidence_eligible',true,
  'exact_bytes_captured',true,
  'independent_validation_required',true,
  'independent_validation_completed',false,
  'compliance_activation_allowed',false,
  'recrawl_generated_at','2026-09-03T19:48:32.775Z'
 )
from docs
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

update public.state_rule_pack_candidates
set candidate_manifest=coalesce(candidate_manifest,'{}'::jsonb)||jsonb_build_object(
 'release_critical_document_families_captured',true,
 'document_level_recrawl_required',false,
 'legacy_page_hashes_invalidated',true,
 'document_level_source_artifact_digest','sha256:cd18003ca776e9125429c2b1b878a2149acfe54ed7ce37810ca050aa42c5a524',
 'document_level_source_count',26,
 'document_level_recrawl_generated_at','2026-09-03T19:48:32.775Z',
 'compliance_activation_allowed',false
),
compliance_activation_allowed=false,
status='agent_verification_in_progress',
updated_at=now()
where state_code in('TN','TX');

select public.refresh_state_rule_release_work_item(id)
from public.state_rule_pack_candidates where state_code in('TN','TX');
