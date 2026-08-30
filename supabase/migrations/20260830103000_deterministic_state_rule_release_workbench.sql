-- Deterministic state-rule release workbench.
-- Source validation, rule extraction/testing, independent release approval, and
-- certification Final Review remain separate controls.

create table if not exists public.state_rule_release_work_items (
  id uuid primary key default gen_random_uuid(),
  pack_candidate_id uuid not null unique references public.state_rule_pack_candidates(id) on delete restrict,
  state_code text not null,
  source_snapshot_sha256 text not null check (source_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in (
    'SOURCE_DOCUMENT_GAP',
    'RULE_EXTRACTION',
    'FIXTURE_VALIDATION',
    'CONFLICT_VALIDATION',
    'READY_FOR_INDEPENDENT_RELEASE',
    'RELEASED'
  )),
  release_critical_document_gaps jsonb not null default '[]'::jsonb check (jsonb_typeof(release_critical_document_gaps)='array'),
  current_source_count integer not null default 0 check (current_source_count >= 0),
  assessed_source_count integer not null default 0 check (assessed_source_count >= 0),
  validated_rule_count integer not null default 0 check (validated_rule_count >= 0),
  passed_fixture_count integer not null default 0 check (passed_fixture_count >= 0),
  failed_fixture_count integer not null default 0 check (failed_fixture_count >= 0),
  unresolved_conflict_count integer not null default 0 check (unresolved_conflict_count >= 0),
  blockers jsonb not null default '{}'::jsonb check (jsonb_typeof(blockers)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.state_rule_source_extraction_assessments (
  id uuid primary key default gen_random_uuid(),
  pack_candidate_id uuid not null references public.state_rule_pack_candidates(id) on delete restrict,
  source_candidate_id uuid not null references public.state_rule_source_candidates(id) on delete restrict,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  assessment_status text not null check (assessment_status in (
    'RULES_EXTRACTED',
    'REFERENCE_DATA_EXTRACTED',
    'INDEX_ONLY',
    'NO_EXECUTABLE_RULES',
    'BLOCKED'
  )),
  validated_rule_count integer not null default 0 check (validated_rule_count >= 0),
  reference_data_count integer not null default 0 check (reference_data_count >= 0),
  validator_build text not null check (char_length(btrim(validator_build)) between 3 and 128),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  assessment_sha256 text not null check (assessment_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists state_rule_source_extraction_latest_idx
  on public.state_rule_source_extraction_assessments(pack_candidate_id, source_candidate_id, created_at desc);

create table if not exists public.state_rule_deterministic_rules (
  id uuid primary key default gen_random_uuid(),
  pack_candidate_id uuid not null references public.state_rule_pack_candidates(id) on delete restrict,
  source_candidate_id uuid not null references public.state_rule_source_candidates(id) on delete restrict,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  state_code text not null,
  program_code text not null,
  rule_key text not null check (char_length(btrim(rule_key)) between 3 and 160),
  rule_version text not null check (char_length(btrim(rule_version)) between 1 and 64),
  topic text not null check (char_length(btrim(topic)) between 2 and 160),
  source_page integer not null check (source_page >= 1),
  citation text not null check (char_length(btrim(citation)) between 3 and 500),
  operation_type text not null check (operation_type in (
    'REQUIRE_DOCUMENT',
    'COMPARE_NUMBER',
    'REQUIRE_DATE_ON_OR_BEFORE',
    'REQUIRE_BOOLEAN',
    'REQUIRE_ENUM',
    'CALCULATE_LIMIT',
    'REQUIRE_IF',
    'PROHIBIT_IF',
    'REFERENCE_LIMIT_TABLE'
  )),
  input_schema jsonb not null default '{}'::jsonb check (jsonb_typeof(input_schema)='object'),
  deterministic_operation jsonb not null check (jsonb_typeof(deterministic_operation)='object'),
  effective_from date not null,
  effective_to date,
  validation_status text not null default 'VALIDATED' check (validation_status in ('VALIDATED','REJECTED')),
  validator_build text not null check (char_length(btrim(validator_build)) between 3 and 128),
  extraction_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(extraction_evidence)='object'),
  rule_sha256 text not null check (rule_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create unique index if not exists state_rule_deterministic_rules_identity_idx
  on public.state_rule_deterministic_rules(pack_candidate_id, rule_key, rule_version, rule_sha256)
  where validation_status='VALIDATED';
create index if not exists state_rule_deterministic_rules_pack_source_idx
  on public.state_rule_deterministic_rules(pack_candidate_id, source_candidate_id, validation_status, created_at desc);

create table if not exists public.state_rule_test_fixtures (
  id uuid primary key default gen_random_uuid(),
  pack_candidate_id uuid not null references public.state_rule_pack_candidates(id) on delete restrict,
  rule_id uuid references public.state_rule_deterministic_rules(id) on delete restrict,
  fixture_key text not null check (char_length(btrim(fixture_key)) between 3 and 200),
  fixture_kind text not null check (fixture_kind in ('POSITIVE','NEGATIVE','BOUNDARY','LAYERED_PROGRAM','SUPERSESSION')),
  input_data jsonb not null check (jsonb_typeof(input_data)='object'),
  expected_outcome text not null check (expected_outcome in ('PASS','FAIL','NOT_DETERMINED')),
  observed_outcome text not null check (observed_outcome in ('PASS','FAIL','NOT_DETERMINED')),
  expected_output jsonb not null default '{}'::jsonb,
  observed_output jsonb not null default '{}'::jsonb,
  passed boolean not null,
  validator_build text not null check (char_length(btrim(validator_build)) between 3 and 128),
  fixture_sha256 text not null check (fixture_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (passed = (expected_outcome = observed_outcome))
);

create index if not exists state_rule_test_fixtures_latest_idx
  on public.state_rule_test_fixtures(pack_candidate_id, fixture_key, created_at desc);
create index if not exists state_rule_test_fixtures_rule_kind_idx
  on public.state_rule_test_fixtures(rule_id, fixture_kind, passed, created_at desc);

create table if not exists public.state_rule_source_conflicts (
  id uuid primary key default gen_random_uuid(),
  pack_candidate_id uuid not null references public.state_rule_pack_candidates(id) on delete restrict,
  conflict_key text not null check (char_length(btrim(conflict_key)) between 3 and 200),
  source_candidate_ids uuid[] not null default '{}'::uuid[],
  conflict_type text not null check (conflict_type in ('CURRENCY','SUPERSESSION','SUBSTANTIVE','APPLICABILITY')),
  description text not null check (char_length(btrim(description)) between 3 and 2000),
  resolution_status text not null check (resolution_status in ('RESOLVED','UNRESOLVED')),
  resolution_citation text,
  resolved_by uuid references auth.users(id) on delete restrict,
  resolved_at timestamptz,
  conflict_sha256 text not null check (conflict_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (
    resolution_status <> 'RESOLVED'
    or (nullif(btrim(resolution_citation),'') is not null and resolved_by is not null and resolved_at is not null)
  )
);

create index if not exists state_rule_source_conflicts_latest_idx
  on public.state_rule_source_conflicts(pack_candidate_id, conflict_key, created_at desc);

create table if not exists public.state_rule_pack_release_assessments (
  id uuid primary key default gen_random_uuid(),
  pack_candidate_id uuid not null references public.state_rule_pack_candidates(id) on delete restrict,
  source_snapshot_sha256 text not null check (source_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  source_extraction_complete boolean not null,
  conflict_inventory_complete boolean not null,
  validator_build text not null check (char_length(btrim(validator_build)) between 3 and 128),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  assessment_sha256 text not null check (assessment_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists state_rule_pack_release_assessments_latest_idx
  on public.state_rule_pack_release_assessments(pack_candidate_id, source_snapshot_sha256, created_at desc);

create table if not exists public.state_rule_release_approval_events (
  id uuid primary key default gen_random_uuid(),
  pack_candidate_id uuid not null references public.state_rule_pack_candidates(id) on delete restrict,
  source_snapshot_sha256 text not null check (source_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('APPROVED','REJECTED')),
  notes text not null check (char_length(btrim(notes)) between 3 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists state_rule_release_approval_events_latest_idx
  on public.state_rule_release_approval_events(pack_candidate_id, source_snapshot_sha256, created_at desc);

-- Controlled tables are append-only from the application surface.
foreach_not_supported_placeholder: ;
