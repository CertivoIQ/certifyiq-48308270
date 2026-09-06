-- Discovery-page hashes are provenance only. They cannot be pending validation.
-- Any captured_unvalidated or verified source must be a real exact-byte capture
-- with a valid SHA-256. Any source allowed to activate compliance must also be verified.

with discovery_pages as (
  select id,state_code,agent_verification_status,source_sha256,retrieved_at,source_url,source_type
  from public.state_rule_source_candidates
  where candidate_status <> 'EXCLUDED_REDUNDANT_SOURCE'
    and agent_verification_status='captured_unvalidated'
    and exact_bytes_captured=false
    and coalesce(verification_evidence->>'evidence_kind','')='discovery_page_only'
), events as (
  insert into public.state_rule_source_verification_events (
    source_candidate_id,reviewer_id,decision,prior_status,source_sha256,retrieved_at,notes,evidence
  )
  select id,
         (select id from auth.users where lower(email)='rjwatkins@certivoiq.com' limit 1),
         'blocked',
         agent_verification_status,
         source_sha256,
         retrieved_at,
         'Discovery-page hash retained for provenance only; exact downloadable document bytes are required for validation.',
         jsonb_build_object(
           'correction','DISCOVERY_PAGE_REMOVED_FROM_PENDING_VALIDATION_QUEUE',
           'source_url',source_url,
           'source_type',source_type,
           'page_sha_retained',true,
           'validation_evidence_eligible',false,
           'corrected_at',now()
         )
  from discovery_pages
  where exists (select 1 from auth.users where lower(email)='rjwatkins@certivoiq.com')
  returning source_candidate_id
)
update public.state_rule_source_candidates s
set agent_verification_status='blocked',
    compliance_activation_allowed=false,
    verification_evidence=coalesce(s.verification_evidence,'{}'::jsonb)||jsonb_build_object(
      'validation_evidence_eligible',false,
      'pending_validation_eligible',false,
      'discovery_page_blocked_at',now(),
      'discovery_page_block_reason','Discovery-page hashes are provenance only and cannot enter pending validation; exact downloadable document bytes and SHA-256 are required.'
    ),
    updated_at=now()
where s.id in (select id from discovery_pages);

update public.state_rule_pack_candidates p
set blocked_source_count=(
      select count(*)::int from public.state_rule_source_candidates s
      where s.state_code=p.state_code and s.inventory_generated_at=p.inventory_generated_at
        and s.agent_verification_status in ('blocked','rejected')
        and s.candidate_status <> 'EXCLUDED_REDUNDANT_SOURCE'
    ),
    compliance_activation_allowed=false,
    status=case when p.state_code='US' then p.status else 'agent_verification_in_progress' end,
    candidate_manifest=coalesce(p.candidate_manifest,'{}'::jsonb)||jsonb_build_object(
      'discovery_pages_removed_from_pending_validation',true,
      'discovery_page_pending_queue_correction_at',now()
    ),
    updated_at=now()
where p.state_code <> 'US';

alter table public.state_rule_source_candidates
  drop constraint if exists state_rule_source_validation_status_requires_sha;

alter table public.state_rule_source_candidates
  add constraint state_rule_source_validation_status_requires_sha
  check (
    agent_verification_status not in ('captured_unvalidated','verified')
    or (
      exact_bytes_captured = true
      and source_sha256 is not null
      and source_sha256 ~ '^[0-9a-f]{64}$'
    )
  );

alter table public.state_rule_source_candidates
  drop constraint if exists state_rule_source_activation_requires_verified_sha;

alter table public.state_rule_source_candidates
  add constraint state_rule_source_activation_requires_verified_sha
  check (
    compliance_activation_allowed = false
    or (
      agent_verification_status = 'verified'
      and exact_bytes_captured = true
      and source_sha256 is not null
      and source_sha256 ~ '^[0-9a-f]{64}$'
    )
  );
