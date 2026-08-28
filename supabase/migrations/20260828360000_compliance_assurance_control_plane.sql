-- Supervised compliance assurance for layered programs, regulatory conflicts,
-- audit remediation, escalation-quality measurement, and sustained production
-- customer-file performance. These records do not grant final compliance authority.

create schema if not exists private;

create or replace function private.certivoiq_assurance_reviewer(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.crm_staff_access access
    where access.user_id = _user_id
      and access.status = 'active'
      and access.access_level in ('admin', 'manager')
  );
$$;

revoke all on function private.certivoiq_assurance_reviewer(uuid) from public;
grant execute on function private.certivoiq_assurance_reviewer(uuid) to authenticated, service_role;

create table public.compliance_assurance_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id text not null check (length(trim(organization_id)) > 0),
  property_key text not null check (length(trim(property_key)) > 0),
  unit_key text,
  household_key text,
  event_date date not null,
  applicable_program_codes text[] not null,
  layered_result jsonb not null default '{}'::jsonb,
  regulatory_status text not null default 'NOT_DETERMINED'
    check (regulatory_status in ('NOT_DETERMINED','PENDING','CONFLICTING','CLEAR_FOR_HUMAN_REVIEW')),
  audit_status text not null default 'PENDING'
    check (audit_status in ('PENDING','BLOCKED','AUDIT_READY')),
  escalation_accuracy_status text not null default 'PENDING'
    check (escalation_accuracy_status in ('PENDING','ACCURACY_GATE_MET')),
  production_security_status text not null default 'BLOCKED'
    check (production_security_status in ('BLOCKED','SECURITY_GATE_MET')),
  sustained_performance_status text not null default 'PENDING'
    check (sustained_performance_status in ('PENDING','SUSTAINED_PERFORMANCE_GATE_MET')),
  assurance_status text not null default 'BLOCKED'
    check (assurance_status in ('BLOCKED','READY_FOR_HUMAN_DECISION','APPROVED_BY_HUMAN','REJECTED_BY_HUMAN')),
  engine_build text not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  human_decision text check (human_decision is null or human_decision in ('APPROVE','REJECT','RETURN_FOR_REMEDIATION')),
  human_decision_reason text,
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(applicable_program_codes) > 0),
  check (
    (assurance_status not in ('APPROVED_BY_HUMAN','REJECTED_BY_HUMAN'))
    or (
      human_decision is not null
      and decided_by is not null
      and decided_at is not null
      and human_decision_reason is not null
      and length(trim(human_decision_reason)) > 0
    )
  )
);

create table public.compliance_regulatory_reviews (
  id uuid primary key default gen_random_uuid(),
  assurance_case_id uuid not null references public.compliance_assurance_cases(id) on delete restrict,
  issue_type text not null check (issue_type in ('AUTHORITY_CONFLICT','UNUSUAL_EXCEPTION','SOURCE_CHANGE','EFFECTIVE_DATE_EXCEPTION')),
  rule_key text not null check (length(trim(rule_key)) > 0),
  authority_records jsonb not null,
  source_hashes text[] not null,
  system_status text not null check (system_status in ('PENDING','CONFLICTING','NOT_DETERMINED','CLEAR_FOR_HUMAN_REVIEW')),
  escalation_destination text not null check (escalation_destination in ('COMPLIANCE','LEGAL','LEGAL_AND_COMPLIANCE')),
  human_decision text check (human_decision is null or human_decision in ('UPHOLD_BLOCK','APPROVE_EXCEPTION','REJECT_EXCEPTION','RETURN_FOR_EVIDENCE')),
  decision_reason text,
  reviewer_id uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (cardinality(source_hashes) > 0),
  check (
    human_decision is null
    or (
      reviewer_id is not null
      and reviewed_at is not null
      and decision_reason is not null
      and length(trim(decision_reason)) > 0
    )
  )
);

create table public.compliance_remediation_actions (
  id uuid primary key default gen_random_uuid(),
  assurance_case_id uuid not null references public.compliance_assurance_cases(id) on delete restrict,
  finding_id uuid references public.compliance_findings(id) on delete restrict,
  finding_ref text not null check (length(trim(finding_ref)) > 0),
  rule_id text not null check (length(trim(rule_id)) > 0),
  citation text not null check (length(trim(citation)) > 0),
  severity text not null check (severity in ('critical','major','minor')),
  status text not null default 'OPEN' check (status in ('OPEN','IN_REMEDIATION','READY_FOR_REVIEW','CLOSED')),
  remediation_plan text not null check (length(trim(remediation_plan)) > 0),
  due_at timestamptz,
  assigned_to uuid references auth.users(id) on delete restrict,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  remediation_summary text,
  verified_by uuid references auth.users(id) on delete restrict,
  verified_at timestamptz,
  closed_by uuid references auth.users(id) on delete restrict,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status <> 'CLOSED'
    or (
      jsonb_array_length(evidence_refs) > 0
      and remediation_summary is not null
      and length(trim(remediation_summary)) > 0
      and verified_by is not null
      and verified_at is not null
      and closed_by is not null
      and closed_at is not null
      and verified_by <> closed_by
    )
  )
);

create table public.compliance_escalation_outcomes (
  id uuid primary key default gen_random_uuid(),
  assurance_case_id uuid not null references public.compliance_assurance_cases(id) on delete restrict,
  event_key text not null check (length(trim(event_key)) > 0),
  severity text not null check (severity in ('critical','major','minor','normal')),
  system_decision text not null check (system_decision in ('ESCALATE','DO_NOT_ESCALATE')),
  system_destination text not null,
  system_reason_code text not null,
  human_decision text not null check (human_decision in ('ESCALATE','DO_NOT_ESCALATE')),
  human_destination text,
  human_reason text not null check (length(trim(human_reason)) > 0),
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (assurance_case_id, event_key)
);

create table public.compliance_customer_file_observations (
  id uuid primary key default gen_random_uuid(),
  assurance_case_id uuid not null references public.compliance_assurance_cases(id) on delete restrict,
  customer_key text not null check (length(trim(customer_key)) > 0),
  file_key text not null check (length(trim(file_key)) > 0),
  environment text not null check (environment = 'production'),
  actual_customer_file boolean not null check (actual_customer_file),
  observed_on date not null,
  system_result text not null check (system_result in ('PASS','FAIL','PENDING','NOT_DETERMINED','CONFLICTING')),
  human_result text not null check (human_result in ('PASS','FAIL','PENDING','NOT_DETERMINED','CONFLICTING')),
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  human_review_complete boolean not null check (human_review_complete),
  severity text not null check (severity in ('critical','major','minor','normal')),
  workflow_success boolean not null,
  audit_trail_complete boolean not null,
  cross_tenant_access_denied boolean not null,
  unresolved_evidence_blocked boolean not null,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  engine_build text not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (customer_key, file_key, engine_build, manifest_sha256)
);

create table public.compliance_assurance_events (
  id uuid primary key default gen_random_uuid(),
  assurance_case_id uuid not null references public.compliance_assurance_cases(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  event_type text not null check (length(trim(event_type)) > 0),
  previous_status text,
  next_status text not null,
  reason_code text not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  correlation_id text not null check (length(trim(correlation_id)) > 0),
  created_at timestamptz not null default now()
);

create index compliance_assurance_cases_user_idx on public.compliance_assurance_cases(user_id, created_at desc);
create index compliance_assurance_cases_org_idx on public.compliance_assurance_cases(organization_id, created_at desc);
create index compliance_assurance_cases_decider_idx on public.compliance_assurance_cases(decided_by) where decided_by is not null;
create index compliance_regulatory_reviews_case_idx on public.compliance_regulatory_reviews(assurance_case_id, created_at desc);
create index compliance_regulatory_reviews_reviewer_idx on public.compliance_regulatory_reviews(reviewer_id) where reviewer_id is not null;
create index compliance_remediation_case_idx on public.compliance_remediation_actions(assurance_case_id, status, due_at);
create index compliance_remediation_finding_idx on public.compliance_remediation_actions(finding_id) where finding_id is not null;
create index compliance_remediation_assignee_idx on public.compliance_remediation_actions(assigned_to) where assigned_to is not null;
create index compliance_remediation_verified_idx on public.compliance_remediation_actions(verified_by) where verified_by is not null;
create index compliance_remediation_closed_idx on public.compliance_remediation_actions(closed_by) where closed_by is not null;
create index compliance_escalation_case_idx on public.compliance_escalation_outcomes(assurance_case_id, reviewed_at desc);
create index compliance_escalation_reviewer_idx on public.compliance_escalation_outcomes(reviewer_id);
create index compliance_customer_files_case_idx on public.compliance_customer_file_observations(assurance_case_id, observed_on desc);
create index compliance_customer_files_reviewer_idx on public.compliance_customer_file_observations(reviewer_id);
create index compliance_customer_files_cohort_idx on public.compliance_customer_file_observations(engine_build, observed_on, customer_key);
create index compliance_assurance_events_case_idx on public.compliance_assurance_events(assurance_case_id, created_at desc);
create index compliance_assurance_events_actor_idx on public.compliance_assurance_events(actor_id) where actor_id is not null;

alter table public.compliance_assurance_cases enable row level security;
alter table public.compliance_regulatory_reviews enable row level security;
alter table public.compliance_remediation_actions enable row level security;
alter table public.compliance_escalation_outcomes enable row level security;
alter table public.compliance_customer_file_observations enable row level security;
alter table public.compliance_assurance_events enable row level security;

revoke all on public.compliance_assurance_cases, public.compliance_regulatory_reviews,
  public.compliance_remediation_actions, public.compliance_escalation_outcomes,
  public.compliance_customer_file_observations, public.compliance_assurance_events
from anon, authenticated;

grant select on public.compliance_assurance_cases, public.compliance_regulatory_reviews,
  public.compliance_remediation_actions, public.compliance_escalation_outcomes,
  public.compliance_customer_file_observations, public.compliance_assurance_events
to authenticated;

grant update on public.compliance_assurance_cases, public.compliance_regulatory_reviews,
  public.compliance_remediation_actions
to authenticated;

grant all on public.compliance_assurance_cases, public.compliance_regulatory_reviews,
  public.compliance_remediation_actions, public.compliance_escalation_outcomes,
  public.compliance_customer_file_observations, public.compliance_assurance_events
to service_role;

create policy "owners and reviewers read assurance cases"
on public.compliance_assurance_cases for select to authenticated
using (user_id = (select auth.uid()) or (select private.certivoiq_assurance_reviewer(auth.uid())));

create policy "reviewers update assurance cases"
on public.compliance_assurance_cases for update to authenticated
using ((select private.certivoiq_assurance_reviewer(auth.uid())))
with check ((select private.certivoiq_assurance_reviewer(auth.uid())));

create policy "owners and reviewers read regulatory reviews"
on public.compliance_regulatory_reviews for select to authenticated
using (
  (select private.certivoiq_assurance_reviewer(auth.uid()))
  or exists (
    select 1 from public.compliance_assurance_cases assurance_case
    where assurance_case.id = assurance_case_id and assurance_case.user_id = (select auth.uid())
  )
);

create policy "reviewers update regulatory reviews"
on public.compliance_regulatory_reviews for update to authenticated
using ((select private.certivoiq_assurance_reviewer(auth.uid())))
with check ((select private.certivoiq_assurance_reviewer(auth.uid())));

create policy "owners and reviewers read remediation actions"
on public.compliance_remediation_actions for select to authenticated
using (
  (select private.certivoiq_assurance_reviewer(auth.uid()))
  or exists (
    select 1 from public.compliance_assurance_cases assurance_case
    where assurance_case.id = assurance_case_id and assurance_case.user_id = (select auth.uid())
  )
);

create policy "reviewers update remediation actions"
on public.compliance_remediation_actions for update to authenticated
using ((select private.certivoiq_assurance_reviewer(auth.uid())))
with check ((select private.certivoiq_assurance_reviewer(auth.uid())));

create policy "owners and reviewers read escalation outcomes"
on public.compliance_escalation_outcomes for select to authenticated
using (
  (select private.certivoiq_assurance_reviewer(auth.uid()))
  or exists (
    select 1 from public.compliance_assurance_cases assurance_case
    where assurance_case.id = assurance_case_id and assurance_case.user_id = (select auth.uid())
  )
);

create policy "owners and reviewers read customer file observations"
on public.compliance_customer_file_observations for select to authenticated
using (
  (select private.certivoiq_assurance_reviewer(auth.uid()))
  or exists (
    select 1 from public.compliance_assurance_cases assurance_case
    where assurance_case.id = assurance_case_id and assurance_case.user_id = (select auth.uid())
  )
);

create policy "owners and reviewers read assurance events"
on public.compliance_assurance_events for select to authenticated
using (
  (select private.certivoiq_assurance_reviewer(auth.uid()))
  or exists (
    select 1 from public.compliance_assurance_cases assurance_case
    where assurance_case.id = assurance_case_id and assurance_case.user_id = (select auth.uid())
  )
);

create or replace function private.prevent_compliance_assurance_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'compliance assurance events are append-only';
end;
$$;

revoke all on function private.prevent_compliance_assurance_event_mutation() from public;

create trigger prevent_compliance_assurance_event_update
before update or delete on public.compliance_assurance_events
for each row execute function private.prevent_compliance_assurance_event_mutation();

comment on table public.compliance_assurance_cases is
  'Supervised release gate. READY_FOR_HUMAN_DECISION is not a final compliance determination.';
comment on table public.compliance_regulatory_reviews is
  'Cited regulatory conflicts and unusual exceptions requiring documented human disposition.';
comment on table public.compliance_remediation_actions is
  'Evidence-bound audit finding remediation with closure separation of duties.';
comment on table public.compliance_escalation_outcomes is
  'Human-labeled outcomes used to measure escalation recall, precision, and critical false negatives.';
comment on table public.compliance_customer_file_observations is
  'De-identified, human-reviewed production observations used for sustained customer-file performance gates.';
comment on table public.compliance_assurance_events is
  'Append-only assurance case transition history.';
