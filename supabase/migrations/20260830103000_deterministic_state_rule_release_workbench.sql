-- Deterministic state-rule release workbench.
-- Source validation, rule extraction/testing, independent release approval, and
-- certification Final Review remain separate controls.

create table if not exists public.state_rule_release_work_items (
  id uuid primary key default gen_random_uuid(),
  pack_candidate_id uuid not null unique references public.state_rule_pack_candidates(id) on delete restrict,
  state_code text not null,
  source_snapshot_sha256 text not null check (source_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in (
    'SOURCE_DOCUMENT_GAP','RULE_EXTRACTION','FIXTURE_VALIDATION',
    'CONFLICT_VALIDATION','READY_FOR_INDEPENDENT_RELEASE','RELEASED'
  )),
  release_critical_document_gaps jsonb not null default '[]'::jsonb
    check (jsonb_typeof(release_critical_document_gaps)='array'),
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
    'RULES_EXTRACTED','REFERENCE_DATA_EXTRACTED','INDEX_ONLY',
    'NO_EXECUTABLE_RULES','BLOCKED'
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
    'REQUIRE_DOCUMENT','COMPARE_NUMBER','REQUIRE_DATE_ON_OR_BEFORE',
    'REQUIRE_BOOLEAN','REQUIRE_ENUM','CALCULATE_LIMIT','REQUIRE_IF',
    'PROHIBIT_IF','REFERENCE_LIMIT_TABLE'
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

-- Evidence rows are append-only. Work items are server-maintained snapshots.
create or replace function public.block_state_rule_release_evidence_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Deterministic state-rule release evidence is append-only';
end;
$$;

revoke all on function public.block_state_rule_release_evidence_mutation() from public, anon, authenticated;
grant execute on function public.block_state_rule_release_evidence_mutation() to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'state_rule_source_extraction_assessments',
    'state_rule_deterministic_rules',
    'state_rule_test_fixtures',
    'state_rule_source_conflicts',
    'state_rule_pack_release_assessments',
    'state_rule_release_approval_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon', table_name);
    execute format('revoke insert, update, delete, truncate, references, trigger on table public.%I from authenticated', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('drop trigger if exists block_mutation on public.%I', table_name);
    execute format(
      'create trigger block_mutation before update or delete on public.%I for each row execute function public.block_state_rule_release_evidence_mutation()',
      table_name
    );
  end loop;
end;
$$;

alter table public.state_rule_release_work_items enable row level security;
revoke all on table public.state_rule_release_work_items from public, anon;
revoke insert, update, delete, truncate, references, trigger on table public.state_rule_release_work_items from authenticated;
grant select on table public.state_rule_release_work_items to authenticated;
grant all on table public.state_rule_release_work_items to service_role;

-- Manager/Admin read policies for controlled release evidence.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'state_rule_release_work_items',
    'state_rule_source_extraction_assessments',
    'state_rule_deterministic_rules',
    'state_rule_test_fixtures',
    'state_rule_source_conflicts',
    'state_rule_pack_release_assessments',
    'state_rule_release_approval_events'
  ] loop
    execute format('drop policy if exists %L on public.%I', 'Managers can view deterministic rule release evidence', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (exists (select 1 from public.crm_staff_access a where a.user_id = (select auth.uid()) and a.status = ''active'' and a.access_level in (''manager'',''admin'')))',
      'Managers can view deterministic rule release evidence', table_name
    );
  end loop;
end;
$$;

-- Returns the exact current state + shared-federal source scope for a pack.
create or replace function public.state_rule_release_current_sources(p_pack_candidate_id uuid)
returns table(
  source_candidate_id uuid,
  source_state_code text,
  source_type text,
  source_url text,
  source_sha256 text,
  retrieved_at timestamptz,
  content_type text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  with selected_pack as (
    select pack.state_code, pack.inventory_generated_at
    from public.state_rule_pack_candidates pack
    where pack.id = p_pack_candidate_id
  ), current_sources as (
    select source.*
    from public.state_rule_source_candidates source
    join selected_pack pack
      on source.state_code = pack.state_code
     and source.inventory_generated_at = pack.inventory_generated_at
    where not (
      source.agent_verification_status='rejected'
      and source.candidate_status='EXCLUDED_REDUNDANT_SOURCE'
    )
    union all
    select source.*
    from public.state_rule_source_candidates source
    join selected_pack pack on pack.state_code <> 'US'
    where source.state_code='US'
      and source.inventory_generated_at=(
        select max(p.inventory_generated_at)
        from public.state_rule_pack_candidates p where p.state_code='US'
      )
      and not (
        source.agent_verification_status='rejected'
        and source.candidate_status='EXCLUDED_REDUNDANT_SOURCE'
      )
  )
  select
    source.id,
    source.state_code,
    source.source_type,
    source.source_url,
    source.source_sha256,
    source.retrieved_at,
    coalesce(source.verification_evidence->>'content_type','')
  from current_sources source
  where source.agent_verification_status='verified'
    and source.exact_bytes_captured
    and source.source_sha256 is not null
    and source.retrieved_at is not null;
$$;
revoke all on function public.state_rule_release_current_sources(uuid) from public, anon, authenticated;
grant execute on function public.state_rule_release_current_sources(uuid) to service_role;

create or replace function public.refresh_state_rule_release_work_item(p_pack_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pack public.state_rule_pack_candidates%rowtype;
  v_snapshot record;
  v_critical_gaps jsonb := '[]'::jsonb;
  v_current_source_count integer := 0;
  v_assessed_source_count integer := 0;
  v_validated_rule_count integer := 0;
  v_passed_fixture_count integer := 0;
  v_failed_fixture_count integer := 0;
  v_rules_missing_core_fixtures integer := 0;
  v_layered_ok boolean := false;
  v_supersession_ok boolean := false;
  v_unresolved_conflicts integer := 0;
  v_pack_assessment public.state_rule_pack_release_assessments%rowtype;
  v_all_sources_assessed boolean := false;
  v_status text;
  v_blockers jsonb;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'Service role required to refresh deterministic release work items';
  end if;

  select * into v_pack
  from public.state_rule_pack_candidates
  where id=p_pack_candidate_id;
  if not found or v_pack.state_code='US' then
    raise exception 'State rule pack candidate not found';
  end if;

  select * into v_snapshot
  from public.state_rule_pack_source_snapshot(v_pack.id);

  select coalesce(jsonb_agg(gap), '[]'::jsonb)
  into v_critical_gaps
  from jsonb_array_elements_text(
    coalesce(v_pack.candidate_manifest->'required_document_family_gaps','[]'::jsonb)
  ) as gap
  where gap in ('COMPLIANCE_GUIDEBOOK','INCOME_LIMITS','RENT_LIMITS','UTILITY_ALLOWANCE','COMPLIANCE_FORMS');

  select count(*)::integer into v_current_source_count
  from public.state_rule_release_current_sources(v_pack.id);

  with current_sources as (
    select * from public.state_rule_release_current_sources(v_pack.id)
  ), latest_assessment as (
    select distinct on (a.source_candidate_id) a.*
    from public.state_rule_source_extraction_assessments a
    where a.pack_candidate_id=v_pack.id
    order by a.source_candidate_id, a.created_at desc, a.id desc
  )
  select count(*)::integer
  into v_assessed_source_count
  from current_sources source
  join latest_assessment assessment
    on assessment.source_candidate_id=source.source_candidate_id
   and assessment.source_sha256=source.source_sha256
  where assessment.assessment_status <> 'BLOCKED'
    and (
      assessment.assessment_status <> 'RULES_EXTRACTED'
      or exists (
        select 1 from public.state_rule_deterministic_rules rule
        where rule.pack_candidate_id=v_pack.id
          and rule.source_candidate_id=source.source_candidate_id
          and rule.source_sha256=source.source_sha256
          and rule.validation_status='VALIDATED'
      )
    );

  v_all_sources_assessed := v_current_source_count > 0
    and v_assessed_source_count = v_current_source_count;

  select count(*)::integer into v_validated_rule_count
  from public.state_rule_deterministic_rules rule
  where rule.pack_candidate_id=v_pack.id
    and rule.validation_status='VALIDATED'
    and rule.effective_from <= current_date
    and (rule.effective_to is null or rule.effective_to >= current_date)
    and exists (
      select 1 from public.state_rule_release_current_sources(v_pack.id) source
      where source.source_candidate_id=rule.source_candidate_id
        and source.source_sha256=rule.source_sha256
    );

  with latest_fixture as (
    select distinct on (fixture.fixture_key) fixture.*
    from public.state_rule_test_fixtures fixture
    where fixture.pack_candidate_id=v_pack.id
    order by fixture.fixture_key, fixture.created_at desc, fixture.id desc
  )
  select
    count(*) filter (where passed)::integer,
    count(*) filter (where not passed)::integer
  into v_passed_fixture_count, v_failed_fixture_count
  from latest_fixture;

  select count(*)::integer
  into v_rules_missing_core_fixtures
  from public.state_rule_deterministic_rules rule
  where rule.pack_candidate_id=v_pack.id
    and rule.validation_status='VALIDATED'
    and rule.effective_from <= current_date
    and (rule.effective_to is null or rule.effective_to >= current_date)
    and exists (
      select 1 from public.state_rule_release_current_sources(v_pack.id) source
      where source.source_candidate_id=rule.source_candidate_id
        and source.source_sha256=rule.source_sha256
    )
    and exists (
      select 1
      from unnest(array['POSITIVE','NEGATIVE','BOUNDARY']) required_kind
      where not exists (
        select 1
        from (
          select distinct on (fixture.fixture_key) fixture.*
          from public.state_rule_test_fixtures fixture
          where fixture.pack_candidate_id=v_pack.id
            and fixture.rule_id=rule.id
            and fixture.fixture_kind=required_kind
          order by fixture.fixture_key, fixture.created_at desc, fixture.id desc
        ) latest
        where latest.passed
      )
    );

  with latest_fixture as (
    select distinct on (fixture.fixture_key) fixture.*
    from public.state_rule_test_fixtures fixture
    where fixture.pack_candidate_id=v_pack.id
    order by fixture.fixture_key, fixture.created_at desc, fixture.id desc
  )
  select
    coalesce(bool_or(fixture_kind='LAYERED_PROGRAM' and passed),false),
    coalesce(bool_or(fixture_kind='SUPERSESSION' and passed),false)
  into v_layered_ok, v_supersession_ok
  from latest_fixture;

  with latest_conflict as (
    select distinct on (conflict.conflict_key) conflict.*
    from public.state_rule_source_conflicts conflict
    where conflict.pack_candidate_id=v_pack.id
    order by conflict.conflict_key, conflict.created_at desc, conflict.id desc
  )
  select count(*) filter (where resolution_status='UNRESOLVED')::integer
  into v_unresolved_conflicts
  from latest_conflict;

  select * into v_pack_assessment
  from public.state_rule_pack_release_assessments assessment
  where assessment.pack_candidate_id=v_pack.id
    and assessment.source_snapshot_sha256=v_snapshot.source_snapshot_sha256
  order by assessment.created_at desc, assessment.id desc
  limit 1;

  v_status := case
    when not coalesce(v_snapshot.sources_ready,false)
      or jsonb_array_length(v_critical_gaps) > 0 then 'SOURCE_DOCUMENT_GAP'
    when not v_all_sources_assessed
      or v_pack_assessment.id is null
      or not v_pack_assessment.source_extraction_complete
      or v_validated_rule_count=0 then 'RULE_EXTRACTION'
    when v_failed_fixture_count>0
      or v_rules_missing_core_fixtures>0
      or not v_layered_ok
      or not v_supersession_ok then 'FIXTURE_VALIDATION'
    when not v_pack_assessment.conflict_inventory_complete
      or v_unresolved_conflicts>0 then 'CONFLICT_VALIDATION'
    else 'READY_FOR_INDEPENDENT_RELEASE'
  end;

  v_blockers := jsonb_build_object(
    'sources_ready',coalesce(v_snapshot.sources_ready,false),
    'release_critical_document_gaps',v_critical_gaps,
    'current_source_count',v_current_source_count,
    'assessed_source_count',v_assessed_source_count,
    'all_sources_assessed',v_all_sources_assessed,
    'validated_rule_count',v_validated_rule_count,
    'rules_missing_positive_negative_boundary_fixtures',v_rules_missing_core_fixtures,
    'layered_program_fixture_passed',v_layered_ok,
    'supersession_fixture_passed',v_supersession_ok,
    'failed_fixture_count',v_failed_fixture_count,
    'conflict_inventory_complete',coalesce(v_pack_assessment.conflict_inventory_complete,false),
    'unresolved_conflict_count',v_unresolved_conflicts
  );

  insert into public.state_rule_release_work_items(
    pack_candidate_id,state_code,source_snapshot_sha256,status,
    release_critical_document_gaps,current_source_count,assessed_source_count,
    validated_rule_count,passed_fixture_count,failed_fixture_count,
    unresolved_conflict_count,blockers,updated_at
  ) values (
    v_pack.id,v_pack.state_code,v_snapshot.source_snapshot_sha256,v_status,
    v_critical_gaps,v_current_source_count,v_assessed_source_count,
    v_validated_rule_count,v_passed_fixture_count,v_failed_fixture_count,
    v_unresolved_conflicts,v_blockers,now()
  )
  on conflict (pack_candidate_id) do update set
    state_code=excluded.state_code,
    source_snapshot_sha256=excluded.source_snapshot_sha256,
    status=excluded.status,
    release_critical_document_gaps=excluded.release_critical_document_gaps,
    current_source_count=excluded.current_source_count,
    assessed_source_count=excluded.assessed_source_count,
    validated_rule_count=excluded.validated_rule_count,
    passed_fixture_count=excluded.passed_fixture_count,
    failed_fixture_count=excluded.failed_fixture_count,
    unresolved_conflict_count=excluded.unresolved_conflict_count,
    blockers=excluded.blockers,
    updated_at=now();

  return jsonb_build_object(
    'pack_candidate_id',v_pack.id,
    'state_code',v_pack.state_code,
    'source_snapshot_sha256',v_snapshot.source_snapshot_sha256,
    'status',v_status,
    'blockers',v_blockers
  );
end;
$$;
revoke all on function public.refresh_state_rule_release_work_item(uuid) from public, anon, authenticated;
grant execute on function public.refresh_state_rule_release_work_item(uuid) to service_role;

-- Direct caller-supplied release evidence is retired. The workbench finalizer
-- below recomputes all hashes and counts from controlled evidence tables.
create or replace function public.record_validated_state_rule_pack_release(
  p_pack_candidate_id uuid,
  p_version text,
  p_effective_from date,
  p_approved_by uuid,
  p_approved_at timestamptz,
  p_validated_rule_count integer,
  p_fixture_count integer,
  p_failed_fixture_count integer,
  p_unresolved_conflict_count integer,
  p_source_snapshot_sha256 text,
  p_source_manifest_sha256 text,
  p_rule_set_sha256 text,
  p_fixture_set_sha256 text,
  p_conflict_set_sha256 text,
  p_engine_build text,
  p_limitations text default null,
  p_release_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Direct state-rule release recording is disabled; use the deterministic workbench finalizer';
end;
$$;
revoke all on function public.record_validated_state_rule_pack_release(
  uuid,text,date,uuid,timestamptz,integer,integer,integer,integer,
  text,text,text,text,text,text,text,jsonb
) from public, anon, authenticated, service_role;

create or replace function public.approve_state_rule_release_candidate(
  p_pack_candidate_id uuid,
  p_decision text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_work public.state_rule_release_work_items%rowtype;
  v_source_approval public.state_rule_pack_activation_events%rowtype;
  v_decision text := upper(btrim(coalesce(p_decision,'')));
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if v_decision not in ('APPROVED','REJECTED') then raise exception 'decision must be APPROVED or REJECTED'; end if;
  if nullif(btrim(coalesce(p_notes,'')),'') is null then raise exception 'release review notes are required'; end if;
  if not exists (
    select 1 from public.crm_staff_access access
    where access.user_id=v_actor
      and access.status='active'
      and access.access_level in ('manager','admin')
  ) then
    raise exception 'manager or administrator authority required';
  end if;

  perform public.refresh_state_rule_release_work_item(p_pack_candidate_id);
  select * into v_work
  from public.state_rule_release_work_items
  where pack_candidate_id=p_pack_candidate_id
  for update;

  if v_work.status <> 'READY_FOR_INDEPENDENT_RELEASE' then
    raise exception 'state rule pack is not ready for independent release review';
  end if;

  select event.* into v_source_approval
  from public.state_rule_pack_activation_events event
  where event.pack_candidate_id=p_pack_candidate_id
    and event.source_snapshot_sha256=v_work.source_snapshot_sha256
  order by event.created_at desc, event.id desc
  limit 1;

  if v_source_approval.id is null then
    raise exception 'current source snapshot has no independent source approval';
  end if;
  if v_actor=v_source_approval.activator_id or v_actor=any(v_source_approval.first_reviewer_ids) then
    raise exception 'release reviewer must be independent from source reviewers and source approver';
  end if;

  insert into public.state_rule_release_approval_events(
    pack_candidate_id,source_snapshot_sha256,reviewer_id,decision,notes
  ) values (
    p_pack_candidate_id,v_work.source_snapshot_sha256,v_actor,v_decision,btrim(p_notes)
  );

  return jsonb_build_object(
    'ok',true,'state_code',v_work.state_code,'decision',v_decision,
    'source_snapshot_sha256',v_work.source_snapshot_sha256
  );
end;
$$;
revoke all on function public.approve_state_rule_release_candidate(uuid,text,text) from public, anon;
grant execute on function public.approve_state_rule_release_candidate(uuid,text,text) to authenticated;

create or replace function public.finalize_state_rule_pack_release(
  p_pack_candidate_id uuid,
  p_version text,
  p_effective_from date,
  p_engine_build text,
  p_limitations text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pack public.state_rule_pack_candidates%rowtype;
  v_work public.state_rule_release_work_items%rowtype;
  v_source_approval public.state_rule_pack_activation_events%rowtype;
  v_release_approval public.state_rule_release_approval_events%rowtype;
  v_assessment public.state_rule_pack_release_assessments%rowtype;
  v_source_manifest_sha text;
  v_rule_set_sha text;
  v_fixture_set_sha text;
  v_conflict_set_sha text;
  v_rule_count integer;
  v_fixture_count integer;
  v_failed_fixture_count integer;
  v_unresolved_conflict_count integer;
  v_release_id uuid;
  v_result jsonb;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'Service role required to finalize deterministic state-rule releases';
  end if;
  if nullif(btrim(coalesce(p_version,'')),'') is null then raise exception 'release version is required'; end if;
  if p_effective_from is null then raise exception 'release effective date is required'; end if;
  if nullif(btrim(coalesce(p_engine_build,'')),'') is null then raise exception 'release engine build is required'; end if;

  perform public.refresh_state_rule_release_work_item(p_pack_candidate_id);

  select * into v_pack
  from public.state_rule_pack_candidates
  where id=p_pack_candidate_id
  for update;
  if not found or v_pack.state_code='US' then raise exception 'state rule pack candidate not found'; end if;

  select * into v_work
  from public.state_rule_release_work_items
  where pack_candidate_id=p_pack_candidate_id
  for update;
  if v_work.status <> 'READY_FOR_INDEPENDENT_RELEASE' then
    raise exception 'state rule pack is not ready for release';
  end if;

  select event.* into v_source_approval
  from public.state_rule_pack_activation_events event
  where event.pack_candidate_id=v_pack.id
    and event.source_snapshot_sha256=v_work.source_snapshot_sha256
  order by event.created_at desc, event.id desc
  limit 1;
  if v_source_approval.id is null then raise exception 'current source snapshot approval is required'; end if;

  select event.* into v_release_approval
  from public.state_rule_release_approval_events event
  where event.pack_candidate_id=v_pack.id
    and event.source_snapshot_sha256=v_work.source_snapshot_sha256
  order by event.created_at desc, event.id desc
  limit 1;
  if v_release_approval.id is null or v_release_approval.decision <> 'APPROVED' then
    raise exception 'independent deterministic release approval is required';
  end if;
  if v_release_approval.reviewer_id=v_source_approval.activator_id
     or v_release_approval.reviewer_id=any(v_source_approval.first_reviewer_ids) then
    raise exception 'release approval is not independent from source validation';
  end if;

  select * into v_assessment
  from public.state_rule_pack_release_assessments assessment
  where assessment.pack_candidate_id=v_pack.id
    and assessment.source_snapshot_sha256=v_work.source_snapshot_sha256
  order by assessment.created_at desc, assessment.id desc
  limit 1;
  if v_assessment.id is null
     or not v_assessment.source_extraction_complete
     or not v_assessment.conflict_inventory_complete then
    raise exception 'release assessment is incomplete';
  end if;

  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
    'id',source_candidate_id,'state',source_state_code,'type',source_type,
    'url',source_url,'sha256',source_sha256,'retrieved_at',retrieved_at
  ) order by source_candidate_id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
  into v_source_manifest_sha
  from public.state_rule_release_current_sources(v_pack.id);

  select
    count(*)::integer,
    encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
      'rule_key',rule.rule_key,'version',rule.rule_version,'source',rule.source_candidate_id,
      'source_sha256',rule.source_sha256,'page',rule.source_page,'citation',rule.citation,
      'operation_type',rule.operation_type,'input_schema',rule.input_schema,
      'operation',rule.deterministic_operation,'effective_from',rule.effective_from,
      'effective_to',rule.effective_to
    ) order by rule.rule_key,rule.rule_version,rule.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
  into v_rule_count,v_rule_set_sha
  from public.state_rule_deterministic_rules rule
  where rule.pack_candidate_id=v_pack.id
    and rule.validation_status='VALIDATED'
    and rule.effective_from <= current_date
    and (rule.effective_to is null or rule.effective_to >= current_date)
    and exists (
      select 1 from public.state_rule_release_current_sources(v_pack.id) source
      where source.source_candidate_id=rule.source_candidate_id
        and source.source_sha256=rule.source_sha256
    );

  with latest_fixture as (
    select distinct on (fixture.fixture_key) fixture.*
    from public.state_rule_test_fixtures fixture
    where fixture.pack_candidate_id=v_pack.id
    order by fixture.fixture_key,fixture.created_at desc,fixture.id desc
  )
  select
    count(*)::integer,
    count(*) filter (where not passed)::integer,
    encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
      'fixture_key',fixture_key,'kind',fixture_kind,'rule_id',rule_id,
      'input',input_data,'expected',expected_outcome,'observed',observed_outcome,
      'expected_output',expected_output,'observed_output',observed_output,'passed',passed
    ) order by fixture_key),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
  into v_fixture_count,v_failed_fixture_count,v_fixture_set_sha
  from latest_fixture;

  with latest_conflict as (
    select distinct on (conflict.conflict_key) conflict.*
    from public.state_rule_source_conflicts conflict
    where conflict.pack_candidate_id=v_pack.id
    order by conflict.conflict_key,conflict.created_at desc,conflict.id desc
  )
  select
    count(*) filter (where resolution_status='UNRESOLVED')::integer,
    encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
      'conflict_key',conflict_key,'type',conflict_type,'sources',source_candidate_ids,
      'description',description,'status',resolution_status,
      'resolution_citation',resolution_citation,'resolved_by',resolved_by,'resolved_at',resolved_at
    ) order by conflict_key),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
  into v_unresolved_conflict_count,v_conflict_set_sha
  from latest_conflict;

  if v_rule_count <= 0 or v_fixture_count < 5 or v_failed_fixture_count <> 0 or v_unresolved_conflict_count <> 0 then
    raise exception 'workbench evidence changed after readiness validation';
  end if;

  insert into public.state_rule_pack_releases(
    state_code,version,status,effective_from,approved_by,approved_at,
    validated_rule_count,limitations,pack_candidate_id,source_activation_event_id,
    source_snapshot_sha256,source_manifest_sha256,rule_set_sha256,fixture_set_sha256,
    conflict_set_sha256,fixture_count,failed_fixture_count,unresolved_conflict_count,
    engine_build,release_evidence
  ) values (
    v_pack.state_code,btrim(p_version),'validated'::public.coverage_status,p_effective_from,
    v_release_approval.reviewer_id,v_release_approval.created_at,
    v_rule_count,nullif(btrim(coalesce(p_limitations,'')),''),v_pack.id,v_source_approval.id,
    v_work.source_snapshot_sha256,v_source_manifest_sha,v_rule_set_sha,v_fixture_set_sha,
    v_conflict_set_sha,v_fixture_count,v_failed_fixture_count,v_unresolved_conflict_count,
    btrim(p_engine_build),jsonb_build_object(
      'control','deterministic_state_rule_workbench',
      'work_item_id',v_work.id,
      'release_assessment_id',v_assessment.id,
      'release_assessment_sha256',v_assessment.assessment_sha256,
      'release_approval_event_id',v_release_approval.id,
      'source_approval_event_id',v_source_approval.id,
      'source_snapshot_sha256',v_work.source_snapshot_sha256,
      'computed_source_manifest_sha256',v_source_manifest_sha,
      'computed_rule_set_sha256',v_rule_set_sha,
      'computed_fixture_set_sha256',v_fixture_set_sha,
      'computed_conflict_set_sha256',v_conflict_set_sha
    )
  ) returning id into v_release_id;

  v_result := public.refresh_state_rule_pack_activation(v_pack.state_code,v_pack.inventory_generated_at);
  update public.state_rule_release_work_items
  set status='RELEASED',updated_at=now()
  where id=v_work.id;

  return v_result || jsonb_build_object(
    'release_id',v_release_id,
    'release_status','validated',
    'approved_by',v_release_approval.reviewer_id,
    'validated_rule_count',v_rule_count,
    'fixture_count',v_fixture_count,
    'source_manifest_sha256',v_source_manifest_sha,
    'rule_set_sha256',v_rule_set_sha,
    'fixture_set_sha256',v_fixture_set_sha,
    'conflict_set_sha256',v_conflict_set_sha
  );
exception
  when unique_violation then
    raise exception 'this exact deterministic state-rule release is already recorded';
end;
$$;
revoke all on function public.finalize_state_rule_pack_release(uuid,text,date,text,text) from public, anon, authenticated;
grant execute on function public.finalize_state_rule_pack_release(uuid,text,date,text,text) to service_role;

create or replace function public.state_rule_release_readiness()
returns table(
  pack_candidate_id uuid,
  state_code text,
  status text,
  validated_rule_count integer,
  assessed_source_count integer,
  current_source_count integer,
  failed_fixture_count integer,
  unresolved_conflict_count integer,
  release_critical_document_gaps jsonb,
  blockers jsonb,
  updated_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    work.pack_candidate_id,work.state_code,work.status,work.validated_rule_count,
    work.assessed_source_count,work.current_source_count,work.failed_fixture_count,
    work.unresolved_conflict_count,work.release_critical_document_gaps,
    work.blockers,work.updated_at
  from public.state_rule_release_work_items work
  where exists (
    select 1 from public.crm_staff_access access
    where access.user_id=(select auth.uid())
      and access.status='active'
      and access.access_level in ('manager','admin')
  )
  order by
    case work.status
      when 'READY_FOR_INDEPENDENT_RELEASE' then 0
      when 'CONFLICT_VALIDATION' then 1
      when 'FIXTURE_VALIDATION' then 2
      when 'RULE_EXTRACTION' then 3
      when 'SOURCE_DOCUMENT_GAP' then 4
      else 5
    end,
    work.state_code;
$$;
revoke all on function public.state_rule_release_readiness() from public, anon;
grant execute on function public.state_rule_release_readiness() to authenticated;

-- Seed/refresh the workbench for every state pack. No release is created here.
do $$
declare
  pack record;
begin
  for pack in select id from public.state_rule_pack_candidates where state_code <> 'US' loop
    perform public.refresh_state_rule_release_work_item(pack.id);
  end loop;
end;
$$;

-- Fail closed: no state may remain executable unless a workbench-validated release exists.
do $$
declare
  invalid_count integer;
begin
  select count(*)::integer into invalid_count
  from public.state_rule_pack_candidates pack
  where pack.state_code <> 'US'
    and pack.compliance_activation_allowed
    and not exists (
      select 1 from public.state_rule_pack_releases release
      where release.pack_candidate_id=pack.id
        and release.status='validated'::public.coverage_status
        and release.release_evidence->>'control'='deterministic_state_rule_workbench'
        and release.effective_from <= current_date
    );
  if invalid_count <> 0 then
    raise exception 'deterministic release invariant violated for % state packs', invalid_count;
  end if;
end;
$$;
