-- Exact official compliance manuals captured by GitHub Actions run 34011686644.
-- Artifact 9982660343, digest sha256:374a3ea8a3d9a1c4179f2b280e094a34dc6cc47e98e63627ae1b5bbe53d799aa.
-- These sources remain fail-closed pending independent validation.

with docs(state_code,authority_name,official_domain,document_title,source_url,content_type,byte_size,source_sha256,retrieved_at,etag,last_modified) as (
 values
 ('LA','Louisiana Housing Corporation','lhc.la.gov','2026 LIHTC Manual','https://www.lhc.la.gov/hubfs/Document%20Libraries/Housing%20Development/Funding%20Opportunities/LIHTC/LIHTC_Manual_2026.pdf','application/pdf',1359091,'e5ac227acc953a68f43a4ede9c5c97a4149dbbea8d42b1b306544e9832b60fa7','2026-09-06T04:31:33.617Z'::timestamptz,'"de0aaff982a30843bce93adea5aa516a"','Wed, 14 Jan 2026 15:21:02 GMT'),
 ('NC','North Carolina Housing Finance Agency','nchfa.com','2026 Rental Investment Compliance Manual','https://www.nchfa.com/sites/default/files/2026-06/ComplianceManual-RentalAssetManagement.pdf','application/pdf',1229632,'c578e7b928292d46f9bd04068481df32c5d3449974bbf3d0ea27f401a928c404','2026-09-06T04:31:34.448Z'::timestamptz,'"12c340-654647f12c7d3"','Tue, 16 Jun 2026 20:07:45 GMT'),
 ('SC','South Carolina State Housing Finance and Development Authority','schousing.sc.gov','LIHTC Compliance Manual revised February 12, 2026','https://schousing.sc.gov/sites/schousing/files/Documents/Development/Manuals%20and%20Forms/LIHTC%20Compliance%20Manual%20-%20Revised%202.12.2026.pdf','application/pdf',1124710,'3c113f780a0b50b9202c6bc53fe9e087368043090cf1c400bff3531bddcdfb79','2026-09-06T04:31:35.082Z'::timestamptz,null,'Fri, 20 Feb 2026 17:45:41 GMT'),
 ('OK','Oklahoma Housing Finance Agency','ohfa.org','Compliance Manual revised September 2024','https://www.ohfa.org/wp-content/uploads/2024/09/2024-Compliance-Manual-revised-Sept-2024.pdf','application/pdf',950041,'998515d1dcd2df0c84114b237b7e1b8df9ce7d2dda6848d3556e614b4cff22a6','2026-09-06T04:31:35.650Z'::timestamptz,'"66eb3785-e7f19"','Wed, 18 Sep 2024 20:26:45 GMT')
),
prepared as (
 select d.*, p.inventory_generated_at
 from docs d join public.state_rule_pack_candidates p using(state_code)
)
insert into public.state_rule_source_candidates(
 state_code,inventory_generated_at,scope,authority_name,official_domain,origin_file,program,source_type,source_url,
 candidate_status,agent_verification_status,exact_bytes_captured,compliance_activation_allowed,source_sha256,retrieved_at,verification_evidence
)
select state_code,inventory_generated_at,'STATEWIDE',authority_name,official_domain,
 'found-state-compliance-manuals-2026-09-06.json','LIHTC','LIHTC_COMPLIANCE_MANUAL',source_url,
 'CAPTURED_EXACT_BYTES_PENDING_INDEPENDENT_VALIDATION','captured_unvalidated',true,false,source_sha256,retrieved_at,
 jsonb_strip_nulls(jsonb_build_object(
  'capture_kind','controlled_document','capture_actor','github_actions',
  'capture_workflow_run_id',34011686644,'capture_artifact_id',9982660343,
  'capture_artifact_digest','sha256:374a3ea8a3d9a1c4179f2b280e094a34dc6cc47e98e63627ae1b5bbe53d799aa',
  'document_title',document_title,
  'document_families',jsonb_build_array('LIHTC_CONTROLLING_AUTHORITY','COMPLIANCE_GUIDEBOOK'),
  'content_type',content_type,'captured_byte_size',byte_size,'etag',etag,'last_modified',last_modified,
  'evidence_kind','exact_document_bytes','exact_bytes_captured',true,'validation_evidence_eligible',true,
  'independent_validation_required',true,'independent_validation_completed',false,
  'compliance_activation_allowed',false
 ))
from prepared
on conflict(state_code,inventory_generated_at,scope,source_url) do update set
 authority_name=excluded.authority_name,official_domain=excluded.official_domain,
 origin_file=excluded.origin_file,program=excluded.program,source_type=excluded.source_type,
 candidate_status=case when public.state_rule_source_candidates.source_sha256 is distinct from excluded.source_sha256
   then 'CAPTURED_EXACT_BYTES_PENDING_INDEPENDENT_VALIDATION'
   else public.state_rule_source_candidates.candidate_status end,
 agent_verification_status=case when public.state_rule_source_candidates.source_sha256 is distinct from excluded.source_sha256
   then 'captured_unvalidated'
   else public.state_rule_source_candidates.agent_verification_status end,
 exact_bytes_captured=true,compliance_activation_allowed=false,source_sha256=excluded.source_sha256,
 retrieved_at=excluded.retrieved_at,verification_evidence=excluded.verification_evidence,updated_at=now();

update public.state_rule_pack_candidates
set status='agent_verification_in_progress',compliance_activation_allowed=false,
 candidate_manifest=coalesce(candidate_manifest,'{}'::jsonb)||jsonb_build_object(
  'found_compliance_manual_captured',true,'found_compliance_manual_capture_date','2026-09-06',
  'found_compliance_manual_pending_independent_validation',true
 ),updated_at=now()
where state_code in ('LA','NC','SC','OK');

select public.refresh_state_rule_release_work_item(id)
from public.state_rule_pack_candidates where state_code in ('LA','NC','SC','OK');
