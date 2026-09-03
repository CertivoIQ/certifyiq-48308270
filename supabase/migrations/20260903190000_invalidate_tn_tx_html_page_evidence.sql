-- Correct the September 2 TN/TX targeted capture: HTML landing/index pages are
-- discovery sources, not compliance documents. Exact downloadable file bytes and
-- SHA-256 are required before a source may satisfy document-level validation.

update public.state_rule_source_candidates
set agent_verification_status = 'captured_unvalidated',
    compliance_activation_allowed = false,
    verification_evidence = coalesce(verification_evidence, '{}'::jsonb) || jsonb_build_object(
      'evidence_kind', 'discovery_page_only',
      'validation_evidence_eligible', false,
      'page_hash_invalidated_at', now(),
      'page_hash_invalidation_reason',
        'HTML landing pages cannot satisfy document-level state validation; exact downloadable file bytes and SHA-256 are required.'
    ),
    updated_at = now()
where state_code in ('TN', 'TX')
  and origin_file = 'tn-tx-release-critical-documents-2026-09-02.json'
  and coalesce(verification_evidence->>'content_type', '') = 'text/html';

update public.state_rule_pack_candidates
set candidate_manifest = coalesce(candidate_manifest, '{}'::jsonb) || jsonb_build_object(
      'release_critical_document_families_captured', false,
      'document_level_recrawl_required', true,
      'legacy_page_hashes_invalidated', true,
      'legacy_page_hash_invalidation_reason',
        'Prior TN/TX capture counted HTML discovery pages as compliance documents. Exact downloadable file bytes and SHA-256 are now required.'
    ),
    compliance_activation_allowed = false,
    status = 'agent_verification_in_progress',
    updated_at = now()
where state_code in ('TN', 'TX');
