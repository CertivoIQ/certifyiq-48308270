-- Correct the per-state document count metadata from the shared 26-document artifact.
-- The underlying exact-byte source rows and hashes are unchanged.
update public.state_rule_pack_candidates
set candidate_manifest = coalesce(candidate_manifest, '{}'::jsonb) || jsonb_build_object(
      'document_level_source_count', case state_code
        when 'TN' then 15
        when 'TX' then 11
      end
    ),
    updated_at = now()
where state_code in ('TN', 'TX');
