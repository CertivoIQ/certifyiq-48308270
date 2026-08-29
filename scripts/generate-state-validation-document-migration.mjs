import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve(process.argv[2] ?? "artifacts/state-validation-document-families.json");
const outputPath = resolve(process.argv[3] ?? "supabase/migrations/20260829203000_add_state_validation_document_families.sql");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const rawDocuments = manifest.states
  .flatMap((state) => state.documents)
  .filter((document) => document.capture_status === "captured_unvalidated")
  .map((document) => ({
    state_code: document.state_code,
    scope: document.scope,
    agency: document.agency,
    document_title: document.document_title,
    document_families: document.document_families,
    source_type: document.source_type.slice(0, 150),
    source_url: document.final_url,
    discovery_url: document.discovery_url,
    official_domains: document.official_domains,
    content_type: document.content_type,
    byte_size: document.byte_size,
    source_sha256: document.source_sha256,
    retrieved_at: document.retrieved_at,
    etag: document.etag,
    last_modified: document.last_modified,
    declared_year: document.declared_year,
    effective_date: document.effective_date,
    effective_date_status: document.effective_date_status,
    effective_date_evidence: document.effective_date_evidence,
    tls_peer_verification: document.tls_peer_verification,
    tls_exception_scope: document.tls_exception_scope,
  }));

const documentsBySource = new Map();
for (const document of rawDocuments) {
  const key = [document.state_code, document.scope, document.source_url].join("|");
  const existing = documentsBySource.get(key);
  if (!existing) {
    documentsBySource.set(key, document);
    continue;
  }
  if (existing.source_sha256 !== document.source_sha256) {
    throw new Error("Duplicate source URL produced conflicting hashes: " + document.source_url);
  }
  existing.document_families = [...new Set([
    ...existing.document_families,
    ...document.document_families,
  ])].sort();
  existing.source_type = existing.document_families.join("_AND_").slice(0, 150);
}
const documents = [...documentsBySource.values()];

const stateCoverage = manifest.states.map((state) => ({
  state_code: state.state_code,
  captured_count: state.captured_count,
  blocked_count: state.blocked_count,
  required_document_family_gaps: state.coverage_gaps.map((gap) => gap.document_family),
}));
const payload = JSON.stringify(documents).replaceAll("$state_docs$", "$state_docs_escape$");
const coveragePayload = JSON.stringify(stateCoverage).replaceAll("$state_coverage$", "$state_coverage_escape$");
const sql = `-- Generated from artifacts/state-validation-document-families.json.
-- Each row is an exact official document capture with an independent SHA-256.
-- Captures remain fail-closed pending human validation and cannot activate rules.

with captured as (
  select *
  from jsonb_to_recordset(\$state_docs\$${payload}\$state_docs\$::jsonb) as source(
    state_code text,
    scope text,
    agency text,
    document_title text,
    document_families jsonb,
    source_type text,
    source_url text,
    discovery_url text,
    official_domains jsonb,
    content_type text,
    byte_size bigint,
    source_sha256 text,
    retrieved_at timestamptz,
    etag text,
    last_modified text,
    declared_year integer,
    effective_date date,
    effective_date_status text,
    effective_date_evidence text,
    tls_peer_verification boolean,
    tls_exception_scope text
  )
),
prepared as (
  select
    source.*,
    pack.inventory_generated_at,
    coalesce(source.official_domains ->> 0, split_part(split_part(source.source_url, '://', 2), '/', 1)) as official_domain
  from captured source
  join public.state_rule_pack_candidates pack
    on pack.state_code = source.state_code
)
insert into public.state_rule_source_candidates (
  state_code,
  inventory_generated_at,
  scope,
  authority_name,
  official_domain,
  origin_file,
  program,
  source_type,
  source_url,
  candidate_status,
  agent_verification_status,
  exact_bytes_captured,
  compliance_activation_allowed,
  source_sha256,
  retrieved_at,
  verification_evidence
)
select
  state_code,
  inventory_generated_at,
  coalesce(nullif(scope, ''), 'STATEWIDE'),
  agency,
  official_domain,
  'artifacts/state-validation-document-families.json',
  'LIHTC_LAYERED_STATE_COMPLIANCE',
  source_type,
  source_url,
  'CAPTURED_EXACT_BYTES_PENDING_INDEPENDENT_VALIDATION',
  'captured_unvalidated',
  true,
  false,
  source_sha256,
  retrieved_at,
  jsonb_strip_nulls(jsonb_build_object(
    'capture_kind', 'controlled_document',
    'capture_actor', 'github_actions',
    'capture_manifest', 'artifacts/state-validation-document-families.json',
    'document_title', document_title,
    'document_families', document_families,
    'discovery_url', discovery_url,
    'content_type', content_type,
    'captured_byte_size', byte_size,
    'etag', etag,
    'last_modified', last_modified,
    'declared_year', declared_year,
    'effective_date', effective_date,
    'effective_date_status', effective_date_status,
    'effective_date_evidence', effective_date_evidence,
    'tls_peer_verification', tls_peer_verification,
    'tls_exception_scope', tls_exception_scope,
    'independent_validation_required', true,
    'human_verified', false,
    'compliance_activation_allowed', false
  ))
from prepared
on conflict (state_code, inventory_generated_at, scope, source_url)
do update set
  source_type = excluded.source_type,
  candidate_status = excluded.candidate_status,
  exact_bytes_captured = true,
  compliance_activation_allowed = false,
  source_sha256 = excluded.source_sha256,
  retrieved_at = excluded.retrieved_at,
  verification_evidence = public.state_rule_source_candidates.verification_evidence
    || excluded.verification_evidence,
  updated_at = now()
where public.state_rule_source_candidates.agent_verification_status <> 'verified';

update public.state_rule_pack_candidates pack
set
  source_candidate_count = counts.source_count,
  blocked_source_count = counts.blocked_count,
  status = case
    when counts.blocked_count > 0 then 'blocked'
    when counts.remaining_count > 0 then 'agent_verification_in_progress'
    else pack.status
  end,
  compliance_activation_allowed = false,
  candidate_manifest = coalesce(pack.candidate_manifest, '{}'::jsonb)
    || jsonb_build_object(
      'source_count', counts.source_count,
      'required_document_family_capture', true,
      'required_document_family_manifest', 'artifacts/state-validation-document-families.json'
    ),
  updated_at = now()
from (
  select
    state_code,
    inventory_generated_at,
    count(*)::integer as source_count,
    count(*) filter (
      where candidate_status like 'BLOCKED%'
         or agent_verification_status in ('blocked', 'rejected')
    )::integer as blocked_count,
    count(*) filter (
      where agent_verification_status <> 'verified'
    )::integer as remaining_count
  from public.state_rule_source_candidates
  group by state_code, inventory_generated_at
) counts
where pack.state_code = counts.state_code
  and pack.inventory_generated_at = counts.inventory_generated_at;

with coverage as (
  select *
  from jsonb_to_recordset(\$state_coverage\$${coveragePayload}\$state_coverage\$::jsonb) as state(
    state_code text,
    captured_count integer,
    blocked_count integer,
    required_document_family_gaps jsonb
  )
)
update public.state_rule_pack_candidates pack
set
  status = case
    when jsonb_array_length(coverage.required_document_family_gaps) > 0 then 'blocked'
    else pack.status
  end,
  compliance_activation_allowed = false,
  candidate_manifest = coalesce(pack.candidate_manifest, '{}'::jsonb)
    || jsonb_build_object(
      'required_document_family_capture', true,
      'required_document_family_manifest', 'artifacts/state-validation-document-families.json',
      'required_document_family_captured_count', coverage.captured_count,
      'required_document_family_blocked_count', coverage.blocked_count,
      'required_document_family_gaps', coverage.required_document_family_gaps,
      'required_document_family_complete', jsonb_array_length(coverage.required_document_family_gaps) = 0
    ),
  updated_at = now()
from coverage
where pack.state_code = coverage.state_code;

do \$\$
begin
  if exists (
    select 1
    from public.state_rule_source_candidates
    where origin_file = 'artifacts/state-validation-document-families.json'
      and (
        source_sha256 is null
        or source_sha256 !~ '^[0-9a-f]{64}$'
        or exact_bytes_captured is not true
        or compliance_activation_allowed is not false
        or agent_verification_status = 'verified'
      )
  ) then
    raise exception 'Nationwide document-family capture violated fail-closed evidence controls';
  end if;
end
\$\$;
`;

await writeFile(outputPath, sql);
console.log(JSON.stringify({
  manifestPath,
  outputPath,
  capturedDocumentCount: documents.length,
  stateCount: manifest.state_count,
  statesWithCapturedDocuments: new Set(documents.map((document) => document.state_code)).size,
  coverageGapCount: manifest.coverage_gap_count,
}));
