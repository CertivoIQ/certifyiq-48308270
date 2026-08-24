-- CertivoIQ supervised autonomous operations control plane.
-- Batch 1: storage, authorization, approval separation, auditability, budgets, and communications staging.

do $$ begin
  create type public.operations_risk_tier as enum ('tier_1_observe','tier_2_prepare','tier_3_reversible','tier_4_human_approval');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.operations_job_status as enum ('queued','running','awaiting_approval','retry_wait','completed','failed','quarantined','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.operations_approval_status as enum ('pending','approved','rejected','expired','revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.operations_incident_status as enum ('open','acknowledged','resolved','rolled_back');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.operations_communication_status as enum ('draft','approved','sending','sent','failed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.operations_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  worker text not null,
  source text,
  risk_tier public.operations_risk_tier not null,
  status public.operations_job_status not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  correlation_id uuid not null default gen_random_uuid(),
  idempotency_key text not null unique,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  lease_owner text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  last_error jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'completed' or completed_at is not null)
);

create table if not exists public.operations_approvals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.operations_jobs(id) on delete restrict,
  action_type text not null,
  status public.operations_approval_status not null default 'pending',
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  reason text,
  action_snapshot jsonb not null,
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique(job_id, action_type, snapshot_sha256),
  check (decided_by is null or decided_by <> requested_by),
  check ((status = 'pending' and decided_by is null and decided_at is null)
      or (status <> 'pending' and decided_by is not null and decided_at is not null))
);

create table if not exists public.operations_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_kind text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  before_sha256 text,
  after_sha256 text,
  evidence_refs jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  correlation_id uuid not null,
  severity text not null default 'info' check (severity in ('debug','info','warning','error','critical')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.operations_incidents (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('low','medium','high','critical')),
  status public.operations_incident_status not null default 'open',
  job_id uuid references public.operations_jobs(id) on delete set null,
  correlation_id uuid not null,
  summary text not null,
  detail jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  retry_count integer not null default 0,
  resolution jsonb,
  rollback_data jsonb,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz
);

create table if not exists public.operations_source_versions (
  id uuid primary key default gen_random_uuid(),
  official_url text not null check (official_url ~ '^https://'),
  authority text not null,
  program text,
  jurisdiction text,
  publication_date date,
  effective_date date,
  retrieved_at timestamptz not null default now(),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_bucket text,
  storage_path text,
  parsing_status text not null default 'pending' check (parsing_status in ('pending','parsed','failed','quarantined')),
  validation_status text not null default 'pending' check (validation_status in ('pending','validated','conflicting','rejected')),
  supersedes_id uuid references public.operations_source_versions(id) on delete restrict,
  evidence_manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(official_url, sha256)
);

create table if not exists public.operations_budget_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  period text not null check (period in ('daily','monthly')),
  amount_limit numeric(12,2) not null check (amount_limit >= 0),
  hard_stop boolean not null default true,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scope, period)
);

create table if not exists public.operations_cost_events (
  id bigint generated always as identity primary key,
  job_id uuid references public.operations_jobs(id) on delete set null,
  provider text not null,
  service text not null,
  amount numeric(12,6) not null check (amount >= 0),
  currency text not null default 'USD',
  units numeric,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  detail jsonb not null default '{}'::jsonb
);

create table if not exists public.operations_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  regulatory_updates boolean not null default true,
  compliance_product_updates boolean not null default true,
  marketing_updates boolean not null default false,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.operations_communications (
  id uuid primary key default gen_random_uuid(),
  release_key text not null,
  channel text not null check (channel in ('platform_email','owner_email','crm_news','in_app')),
  status public.operations_communication_status not null default 'draft',
  subject text,
  body jsonb not null,
  audience_snapshot jsonb not null default '{}'::jsonb,
  recipient_count integer check (recipient_count is null or recipient_count >= 0),
  official_source_refs jsonb not null default '[]'::jsonb,
  requires_approval boolean not null default true,
  approval_id uuid references public.operations_approvals(id) on delete restrict,
  idempotency_key text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('approved','sending','sent') or approval_id is not null)
);

create index if not exists operations_jobs_claim_idx on public.operations_jobs(status, scheduled_at, lease_expires_at);
create index if not exists operations_jobs_correlation_idx on public.operations_jobs(correlation_id);
create index if not exists operations_approvals_pending_idx on public.operations_approvals(status, expires_at);
create index if not exists operations_audit_correlation_idx on public.operations_audit_events(correlation_id, created_at desc);
create index if not exists operations_incidents_open_idx on public.operations_incidents(status, severity, last_seen_at desc);
create index if not exists operations_sources_scope_idx on public.operations_source_versions(authority, program, jurisdiction, effective_date desc);
create index if not exists operations_cost_period_idx on public.operations_cost_events(occurred_at, provider, service);

alter table public.operations_jobs enable row level security;
alter table public.operations_approvals enable row level security;
alter table public.operations_audit_events enable row level security;
alter table public.operations_incidents enable row level security;
alter table public.operations_source_versions enable row level security;
alter table public.operations_budget_limits enable row level security;
alter table public.operations_cost_events enable row level security;
alter table public.operations_notification_preferences enable row level security;
alter table public.operations_communications enable row level security;

grant select on public.operations_jobs, public.operations_approvals, public.operations_audit_events,
  public.operations_incidents, public.operations_source_versions, public.operations_budget_limits,
  public.operations_cost_events, public.operations_communications to authenticated;
grant select, insert, update on public.operations_notification_preferences to authenticated;
grant all on public.operations_jobs, public.operations_approvals, public.operations_audit_events,
  public.operations_incidents, public.operations_source_versions, public.operations_budget_limits,
  public.operations_cost_events, public.operations_notification_preferences,
  public.operations_communications to service_role;

create policy "staff read operations jobs" on public.operations_jobs for select to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'analyst'::public.app_role)));
create policy "staff read operations approvals" on public.operations_approvals for select to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'analyst'::public.app_role)));
create policy "staff read operations audit" on public.operations_audit_events for select to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'analyst'::public.app_role)));
create policy "staff read operations incidents" on public.operations_incidents for select to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'analyst'::public.app_role)));
create policy "staff read operations sources" on public.operations_source_versions for select to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'analyst'::public.app_role)));
create policy "staff read operations budgets" on public.operations_budget_limits for select to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'analyst'::public.app_role)));
create policy "staff read operations costs" on public.operations_cost_events for select to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'analyst'::public.app_role)));
create policy "staff read operations communications" on public.operations_communications for select to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'analyst'::public.app_role)));

create policy "users read own operations preferences" on public.operations_notification_preferences
for select to authenticated using (auth.uid() = user_id);
create policy "users create own operations preferences" on public.operations_notification_preferences
for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own operations preferences" on public.operations_notification_preferences
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.prevent_operations_audit_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'operations audit events are append-only';
end;
$$;
drop trigger if exists prevent_operations_audit_update on public.operations_audit_events;
create trigger prevent_operations_audit_update before update or delete on public.operations_audit_events
for each row execute function public.prevent_operations_audit_mutation();

create or replace function public.operations_approve(
  _approval_id uuid,
  _reason text
) returns public.operations_approvals
language plpgsql security definer set search_path = public as $$
declare
  approval public.operations_approvals;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'admin approval required';
  end if;
  select * into approval from public.operations_approvals where id = _approval_id for update;
  if approval.id is null or approval.status <> 'pending' then raise exception 'approval is not pending'; end if;
  if approval.expires_at <= now() then
    update public.operations_approvals set status='expired', decided_by=auth.uid(), decided_at=now(), reason='Expired before decision' where id=_approval_id;
    raise exception 'approval expired';
  end if;
  if approval.requested_by = auth.uid() then raise exception 'requester cannot approve own action'; end if;
  update public.operations_approvals
  set status='approved', decided_by=auth.uid(), decided_at=now(), reason=nullif(trim(_reason),'')
  where id=_approval_id returning * into approval;
  return approval;
end;
$$;
revoke all on function public.operations_approve(uuid,text) from public;
grant execute on function public.operations_approve(uuid,text) to authenticated;

create or replace function public.operations_reject(
  _approval_id uuid,
  _reason text
) returns public.operations_approvals
language plpgsql security definer set search_path = public as $$
declare approval public.operations_approvals;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'admin approval required'; end if;
  if nullif(trim(_reason),'') is null then raise exception 'rejection reason required'; end if;
  select * into approval from public.operations_approvals where id=_approval_id for update;
  if approval.id is null or approval.status <> 'pending' then raise exception 'approval is not pending'; end if;
  update public.operations_approvals set status='rejected', decided_by=auth.uid(), decided_at=now(), reason=trim(_reason)
  where id=_approval_id returning * into approval;
  return approval;
end;
$$;
revoke all on function public.operations_reject(uuid,text) from public;
grant execute on function public.operations_reject(uuid,text) to authenticated;

comment on table public.operations_jobs is 'Supervised automation jobs. Tier 4 actions require separate human approval.';
comment on table public.operations_audit_events is 'Append-only audit evidence for autonomous operations.';
comment on table public.operations_notification_preferences is 'Platform-authenticated users only; CRM prospects are not a recipient source.';
