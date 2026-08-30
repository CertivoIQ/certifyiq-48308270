-- Merlin state-procedure knowledge base.
-- Extraction is advisory only. Nothing created here can activate a compliance rule.

create table if not exists public.merlin_procedure_documents (
  id uuid primary key default gen_random_uuid(),
  source_candidate_id uuid not null unique references public.state_rule_source_candidates(id) on delete restrict,
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  program text not null,
  source_type text not null,
  authority_name text not null,
  source_url text not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_effective_date date,
  content_type text,
  status text not null default 'queued' check (status in (
    'queued','processing','extracted','pending_independent_validation',
    'validated','rejected','superseded','failed','blocked_source_mismatch'
  )),
  authority_status text not null default 'NON_AUTHORITATIVE_PENDING_INDEPENDENT_VALIDATION'
    check (authority_status in (
      'NON_AUTHORITATIVE_PENDING_INDEPENDENT_VALIDATION',
      'VALIDATED_PROCEDURAL_GUIDANCE',
      'REJECTED',
      'SUPERSEDED'
    )),
  usable_for_compliance_determination boolean not null default false
    check (usable_for_compliance_determination = false),
  extraction_model text,
  extraction_response_id text,
  extracted_procedure_count integer not null default 0 check (extracted_procedure_count >= 0),
  crawl_attempts integer not null default 0 check (crawl_attempts >= 0),
  last_crawled_at timestamptz,
  last_error jsonb,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  validation_notes text,
  source_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(source_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (authority_status <> 'VALIDATED_PROCEDURAL_GUIDANCE') or
    (validated_by is not null and validated_at is not null and nullif(btrim(validation_notes), '') is not null)
  )
);

create table if not exists public.merlin_procedures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.merlin_procedure_documents(id) on delete cascade,
  source_candidate_id uuid not null references public.state_rule_source_candidates(id) on delete restrict,
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  program text not null,
  procedure_key text not null,
  category text not null,
  title text not null,
  summary text not null,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  responsible_roles jsonb not null default '[]'::jsonb check (jsonb_typeof(responsible_roles) = 'array'),
  triggering_events jsonb not null default '[]'::jsonb check (jsonb_typeof(triggering_events) = 'array'),
  required_inputs jsonb not null default '[]'::jsonb check (jsonb_typeof(required_inputs) = 'array'),
  required_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(required_evidence) = 'array'),
  deadlines jsonb not null default '[]'::jsonb check (jsonb_typeof(deadlines) = 'array'),
  exceptions jsonb not null default '[]'::jsonb check (jsonb_typeof(exceptions) = 'array'),
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  ambiguity_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(ambiguity_flags) = 'array'),
  extraction_confidence numeric(5,4) not null check (extraction_confidence between 0 and 1),
  status text not null default 'pending_independent_validation' check (status in (
    'pending_independent_validation','validated','rejected','superseded'
  )),
  usable_for_compliance_determination boolean not null default false
    check (usable_for_compliance_determination = false),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_effective_date date,
  extracted_at timestamptz not null default now(),
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  validation_notes text,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(category, '') || ' ' || coalesce(program, '') || ' ' || coalesce(state_code, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, procedure_key),
  check (
    (status <> 'validated') or
    (validated_by is not null and validated_at is not null and nullif(btrim(validation_notes), '') is not null)
  )
);

create table if not exists public.merlin_procedure_extraction_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.merlin_procedure_documents(id) on delete restrict,
  job_id uuid references public.operations_jobs(id) on delete set null,
  event_type text not null check (event_type in (
    'queued','started','source_verified','source_mismatch','extracted','failed','validation_decision'
  )),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  model text,
  response_id text,
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  actor_kind text not null default 'worker' check (actor_kind in ('system','worker','reviewer')),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists merlin_documents_state_status_idx
  on public.merlin_procedure_documents(state_code, status);
create index if not exists merlin_documents_sha_idx
  on public.merlin_procedure_documents(source_sha256);
create index if not exists merlin_procedures_state_program_idx
  on public.merlin_procedures(state_code, program, status);
create index if not exists merlin_procedures_document_idx
  on public.merlin_procedures(document_id);
create index if not exists merlin_procedures_search_idx
  on public.merlin_procedures using gin(search_vector);
create index if not exists merlin_extraction_events_document_idx
  on public.merlin_procedure_extraction_events(document_id, created_at desc);

alter table public.merlin_procedure_documents enable row level security;
alter table public.merlin_procedures enable row level security;
alter table public.merlin_procedure_extraction_events enable row level security;

revoke all on public.merlin_procedure_documents from anon, authenticated;
revoke all on public.merlin_procedures from anon, authenticated;
revoke all on public.merlin_procedure_extraction_events from anon, authenticated;
grant select on public.merlin_procedure_documents to authenticated;
grant select on public.merlin_procedures to authenticated;
grant select on public.merlin_procedure_extraction_events to authenticated;

drop policy if exists "Managers can view Merlin procedure documents" on public.merlin_procedure_documents;
create policy "Managers can view Merlin procedure documents"
on public.merlin_procedure_documents for select to authenticated
using (exists (
  select 1 from public.crm_staff_access access
  where access.user_id = (select auth.uid())
    and access.status = 'active'
    and access.access_level in ('manager','admin')
));

drop policy if exists "Managers can view Merlin procedures" on public.merlin_procedures;
create policy "Managers can view Merlin procedures"
on public.merlin_procedures for select to authenticated
using (exists (
  select 1 from public.crm_staff_access access
  where access.user_id = (select auth.uid())
    and access.status = 'active'
    and access.access_level in ('manager','admin')
));

drop policy if exists "Managers can view Merlin extraction events" on public.merlin_procedure_extraction_events;
create policy "Managers can view Merlin extraction events"
on public.merlin_procedure_extraction_events for select to authenticated
using (exists (
  select 1 from public.crm_staff_access access
  where access.user_id = (select auth.uid())
    and access.status = 'active'
    and access.access_level in ('manager','admin')
));

create or replace function public.merlin_search_procedures(
  _query text,
  _state_code text default null,
  _program text default null,
  _limit integer default 20
)
returns table (
  procedure_id uuid,
  state_code text,
  program text,
  category text,
  title text,
  summary text,
  steps jsonb,
  required_evidence jsonb,
  deadlines jsonb,
  exceptions jsonb,
  citations jsonb,
  source_url text,
  source_sha256 text,
  source_effective_date date,
  authority_status text,
  extraction_confidence numeric,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  with query as (select websearch_to_tsquery('english', coalesce(_query, '')) q)
  select
    p.id,
    p.state_code,
    p.program,
    p.category,
    p.title,
    p.summary,
    p.steps,
    p.required_evidence,
    p.deadlines,
    p.exceptions,
    p.citations,
    d.source_url,
    p.source_sha256,
    p.source_effective_date,
    d.authority_status,
    p.extraction_confidence,
    ts_rank_cd(p.search_vector, query.q)
  from public.merlin_procedures p
  join public.merlin_procedure_documents d on d.id = p.document_id
  cross join query
  where (_state_code is null or p.state_code = upper(_state_code))
    and (_program is null or p.program = _program)
    and (nullif(btrim(_query), '') is null or p.search_vector @@ query.q)
    and p.status in ('pending_independent_validation','validated')
  order by
    case when p.status = 'validated' then 0 else 1 end,
    ts_rank_cd(p.search_vector, query.q) desc,
    p.extraction_confidence desc,
    p.title
  limit least(greatest(coalesce(_limit, 20), 1), 100);
$$;

revoke all on function public.merlin_search_procedures(text,text,text,integer) from public, anon;
grant execute on function public.merlin_search_procedures(text,text,text,integer) to authenticated, service_role;

create or replace function public.merlin_claim_procedure_job(
  _worker text,
  _lease_seconds integer default 600
)
returns public.operations_jobs
language plpgsql
security definer
set search_path = public
as $$
declare claimed public.operations_jobs;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service role required';
  end if;
  if nullif(btrim(_worker),'') is null then raise exception 'worker required'; end if;
  if _lease_seconds < 60 or _lease_seconds > 900 then raise exception 'invalid lease duration'; end if;

  select * into claimed
  from public.operations_jobs
  where job_type = 'merlin_state_procedure_crawl'
    and worker = 'certivoiq-merlin-procedure'
    and status in ('queued','retry_wait')
    and scheduled_at <= now()
    and (lease_expires_at is null or lease_expires_at <= now())
  order by scheduled_at, created_at
  for update skip locked
  limit 1;

  if claimed.id is null then return null; end if;
  update public.operations_jobs
  set status='running', lease_owner=btrim(_worker),
      lease_expires_at=now()+make_interval(secs=>_lease_seconds),
      heartbeat_at=now(), started_at=coalesce(started_at,now()),
      attempts=attempts+1, updated_at=now()
  where id=claimed.id returning * into claimed;

  insert into public.operations_audit_events(
    actor_kind,action,target_type,target_id,correlation_id,detail
  ) values (
    'worker','merlin.procedure_job.claimed','operations_job',claimed.id::text,
    claimed.correlation_id,jsonb_build_object('worker',_worker,'attempt',claimed.attempts)
  );
  return claimed;
end;
$$;

revoke all on function public.merlin_claim_procedure_job(text,integer) from public, anon, authenticated;
grant execute on function public.merlin_claim_procedure_job(text,integer) to service_role;

-- Seed one document and one idempotent crawl job for every captured, verified source.
insert into public.merlin_procedure_documents (
  source_candidate_id, state_code, program, source_type, authority_name,
  source_url, source_sha256, source_effective_date, content_type, source_snapshot
)
select
  c.id,
  c.state_code,
  c.program,
  c.source_type,
  c.authority_name,
  coalesce(c.verification_evidence->>'final_url', c.source_url),
  lower(c.source_sha256),
  case
    when (c.verification_evidence->>'effective_date') ~ '^\\d{4}-\\d{2}-\\d{2}$'
      then (c.verification_evidence->>'effective_date')::date
    else null
  end,
  nullif(c.verification_evidence->>'content_type', ''),
  jsonb_build_object(
    'source_candidate_id', c.id,
    'state_code', c.state_code,
    'program', c.program,
    'source_type', c.source_type,
    'authority_name', c.authority_name,
    'source_url', c.source_url,
    'source_sha256', lower(c.source_sha256),
    'retrieved_at', c.retrieved_at,
    'verification_evidence', c.verification_evidence,
    'agent_verification_status', c.agent_verification_status,
    'exact_bytes_captured', c.exact_bytes_captured
  )
from public.state_rule_source_candidates c
where c.agent_verification_status = 'verified'
  and c.exact_bytes_captured = true
  and c.source_sha256 ~ '^[0-9A-Fa-f]{64}$'
on conflict (source_candidate_id) do nothing;

insert into public.operations_jobs (
  job_type, worker, source, risk_tier, payload, idempotency_key, max_attempts
)
select
  'merlin_state_procedure_crawl',
  'certivoiq-merlin-procedure',
  'state_rule_source_candidates',
  'tier_2_prepare',
  jsonb_build_object(
    'procedure_document_id', d.id,
    'source_candidate_id', d.source_candidate_id,
    'state_code', d.state_code,
    'source_sha256', d.source_sha256
  ),
  'merlin-state-procedure:' || d.source_candidate_id::text || ':' || d.source_sha256,
  3
from public.merlin_procedure_documents d
where d.status = 'queued'
on conflict (idempotency_key) do nothing;

insert into public.merlin_procedure_extraction_events (
  document_id, event_type, source_sha256, actor_kind, detail
)
select d.id, 'queued', d.source_sha256, 'system',
  jsonb_build_object('source_candidate_id', d.source_candidate_id, 'state_code', d.state_code)
from public.merlin_procedure_documents d
where not exists (
  select 1 from public.merlin_procedure_extraction_events e
  where e.document_id = d.id and e.event_type = 'queued'
);

comment on table public.merlin_procedure_documents is
  'Source-bound Merlin crawl records. Extraction does not confer compliance authority.';
comment on table public.merlin_procedures is
  'Procedural guidance extracted from hashed sources; unusable for compliance determinations by invariant.';
comment on function public.merlin_search_procedures(text,text,text,integer) is
  'Full-text procedure retrieval with source URL, SHA-256, effective date, and authority status.';
