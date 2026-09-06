-- Nationwide provenance correction for state-rule validation evidence.
-- Landing/index pages and records without proof of exact downloadable bytes cannot
-- remain verified or activation-eligible. History is retained; nothing is deleted.

-- First repair the legacy variant where source_url is a landing page but the hash
-- and byte metadata belong to a different captured final document URL.
create temporary table _state_source_relinks on commit drop as
select *
from public.state_rule_source_candidates
where exact_bytes_captured = true
  and source_sha256 ~ '^[0-9a-f]{64}$'
  and coalesce(verification_evidence->>'final_url', '') <> ''
  and verification_evidence->>'final_url' <> source_url
  and (agent_verification_status = 'verified' or compliance_activation_allowed = true);

insert into public.state_rule_source_candidates (
  state_code, inventory_generated_at, scope, authority_name, official_domain,
  origin_file, program, source_type, source_url, candidate_status,
  agent_verification_status, exact_bytes_captured, compliance_activation_allowed,
  source_sha256, retrieved_at, verification_evidence
)
select
  state_code, inventory_generated_at, scope, authority_name, official_domain,
  'nationwide-source-url-relink-2026-09-03', program, source_type || '_EXACT_DOCUMENT',
  verification_evidence->>'final_url',
  'CAPTURED_EXACT_BYTES_PENDING_INDEPENDENT_VALIDATION',
  'captured_unvalidated', true, false, source_sha256, retrieved_at,
  coalesce(verification_evidence, '{}'::jsonb) || jsonb_build_object(
    'evidence_kind', 'exact_document_bytes',
    'validation_evidence_eligible', true,
    'discovery_url', source_url,
    'source_url_relinked_from', source_url,
    'source_url_relinked_at', now(),
    'independent_validation_required', true,
    'compliance_activation_allowed', false
  )
from _state_source_relinks
on conflict (state_code, inventory_generated_at, scope, source_url) do nothing;

insert into public.state_rule_source_verification_events (
  source_candidate_id, reviewer_id, decision, prior_status, source_sha256,
  retrieved_at, notes, evidence
)
select
  source.id,
  founder.id,
  'captured_unvalidated',
  source.agent_verification_status,
  source.source_sha256,
  source.retrieved_at,
  'Founder-authorized source provenance correction: the prior row pointed to a landing page while its hash represented a different final document URL.',
  jsonb_build_object(
    'control', 'source_url_final_url_relink',
    'prior_source_url', source.source_url,
    'exact_document_url', source.verification_evidence->>'final_url',
    'invalidated_at', now()
  )
from _state_source_relinks source
cross join lateral (
  select id from auth.users where lower(email) = 'rjwatkins@certivoiq.com' limit 1
) founder;

update public.state_rule_source_candidates source
set candidate_status = 'PENDING_EXACT_BYTES_AND_HASHES',
    agent_verification_status = 'captured_unvalidated',
    exact_bytes_captured = false,
    compliance_activation_allowed = false,
    verification_evidence = coalesce(source.verification_evidence, '{}'::jsonb) || jsonb_build_object(
      'evidence_kind', 'discovery_page_only',
      'validation_evidence_eligible', false,
      'relinked_exact_document_url', source.verification_evidence->>'final_url',
      'page_hash_invalidation_reason',
        'This row pointed to a discovery/landing URL while the captured bytes came from a different final document URL. Exact evidence now uses the final document URL.',
      'page_hash_invalidated_at', now()
    ),
    updated_at = now()
from _state_source_relinks relink
where source.id = relink.id;

-- Then fail closed any still-authorized row lacking a direct document URL, document
-- MIME type, or recognized document magic. Stable download endpoints such as
-- /media/123 or /view remain eligible when their captured MIME/magic proves bytes.
create temporary table _state_unproven_sources on commit drop as
select id, state_code, inventory_generated_at, agent_verification_status as prior_status,
       source_sha256, retrieved_at, source_url, source_type
from public.state_rule_source_candidates
where (agent_verification_status = 'verified' or compliance_activation_allowed = true)
  and (
    lower(coalesce(verification_evidence->>'content_type', '')) in ('text/html', 'application/xhtml+xml')
    or (
      lower(split_part(source_url, '?', 1)) !~ '\.(pdf|doc|docx|xls|xlsx|csv|zip)$'
      and lower(coalesce(verification_evidence->>'content_type', '')) not in (
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv', 'application/zip', 'application/octet-stream'
      )
      and lower(coalesce(verification_evidence->>'document_magic', '')) not in
        ('pdf', 'zip_ooxml', 'ole_compound')
    )
  );

insert into public.state_rule_source_verification_events (
  source_candidate_id, reviewer_id, decision, prior_status, source_sha256,
  retrieved_at, notes, evidence
)
select
  source.id,
  founder.id,
  'captured_unvalidated',
  source.prior_status,
  source.source_sha256,
  source.retrieved_at,
  'Founder-authorized nationwide fail-closed correction: this source lacks exact downloadable document-byte evidence and cannot remain verified or activation-eligible.',
  jsonb_build_object(
    'control', 'nationwide_exact_document_evidence_correction',
    'source_url', source.source_url,
    'source_type', source.source_type,
    'evidence_kind', 'discovery_page_only',
    'validation_evidence_eligible', false,
    'exact_document_recrawl_required', true,
    'invalidated_at', now()
  )
from _state_unproven_sources source
cross join lateral (
  select id from auth.users where lower(email) = 'rjwatkins@certivoiq.com' limit 1
) founder;

update public.state_rule_source_candidates source
set candidate_status = 'PENDING_EXACT_BYTES_AND_HASHES',
    agent_verification_status = 'captured_unvalidated',
    exact_bytes_captured = false,
    compliance_activation_allowed = false,
    verification_evidence = coalesce(source.verification_evidence, '{}'::jsonb) || jsonb_build_object(
      'evidence_kind', 'discovery_page_only',
      'validation_evidence_eligible', false,
      'exact_document_bytes', false,
      'page_or_unproven_source_hash_invalidated_at', now(),
      'page_hash_invalidation_reason',
        'A landing/index/non-document source cannot satisfy state compliance validation. Exact downloadable file bytes, MIME/magic validation, byte length, and SHA-256 are required.',
      'document_level_recrawl_required', true
    ),
    updated_at = now()
from _state_unproven_sources invalid
where source.id = invalid.id;

update public.state_rule_pack_candidates pack
set compliance_activation_allowed = false,
    agent_verification_required = true,
    validated_on = null,
    status = 'agent_verification_in_progress',
    candidate_manifest = coalesce(pack.candidate_manifest, '{}'::jsonb) || jsonb_build_object(
      'document_level_recrawl_required', true,
      'legacy_page_hashes_invalidated', true,
      'exact_document_evidence_required', true,
      'nationwide_page_hash_correction_at', now(),
      'nationwide_page_hash_correction_reason',
        'One or more prior sources lacked exact downloadable document-byte evidence and were failed closed.'
    ),
    updated_at = now()
where exists (
  select 1 from _state_unproven_sources source
  where source.state_code = pack.state_code
    and source.inventory_generated_at = pack.inventory_generated_at
)
or exists (
  select 1 from _state_source_relinks source
  where source.state_code = pack.state_code
    and source.inventory_generated_at = pack.inventory_generated_at
);
