create schema if not exists private;

create table public.audit_review_confirmations (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null references public.mock_audit_runs(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  responsible_party_name text not null
    check (char_length(btrim(responsible_party_name)) between 2 and 200),
  responsible_party_position text not null
    check (char_length(btrim(responsible_party_position)) between 2 and 200),
  signature_text text not null
    check (char_length(btrim(signature_text)) between 2 and 200),
  attestation text not null
    check (char_length(btrim(attestation)) between 40 and 1000),
  confirmation_snapshot jsonb not null
    check (jsonb_typeof(confirmation_snapshot) = 'object'),
  confirmed_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  unique (audit_run_id)
);

create index audit_review_confirmations_user_id_idx
  on public.audit_review_confirmations(user_id);

alter table public.audit_review_confirmations enable row level security;

revoke all on public.audit_review_confirmations from anon, authenticated;
grant select, insert on public.audit_review_confirmations to authenticated;

create policy "Users can view their own audit review confirmations"
  on public.audit_review_confirmations
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

create policy "Users can insert their own audit review confirmations"
  on public.audit_review_confirmations
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

create or replace function private.finalize_audit_review_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_run_id uuid;
begin
  new.responsible_party_name := btrim(new.responsible_party_name);
  new.responsible_party_position := btrim(new.responsible_party_position);
  new.signature_text := btrim(new.signature_text);
  new.attestation := btrim(new.attestation);
  new.confirmed_at := clock_timestamp();
  new.created_at := new.confirmed_at;

  if coalesce((new.confirmation_snapshot #>> '{package_gate,required_items_confirmed}')::boolean, false) is not true
     or coalesce((new.confirmation_snapshot #>> '{package_gate,critical_open_findings}')::integer, -1) <> 0
     or coalesce((new.confirmation_snapshot #>> '{package_gate,open_remediation_actions}')::integer, -1) <> 0
     or coalesce((new.confirmation_snapshot #>> '{package_gate,evidence_manifest_count}')::integer, 0) < 1 then
    raise exception 'Every audit-preparation gate must pass before final review can be confirmed';
  end if;

  update public.mock_audit_runs
  set status = 'completed',
      completed_at = new.confirmed_at
  where id = new.audit_run_id
    and user_id = (select auth.uid())
    and user_id = new.user_id
    and status = 'running'
    and readiness_score = 100
    and critical_count = 0
  returning id into updated_run_id;

  if updated_run_id is null then
    raise exception 'Audit-preparation run is not eligible for final review confirmation';
  end if;

  return new;
end;
$$;

create trigger finalize_audit_review_confirmation
before insert on public.audit_review_confirmations
for each row execute function private.finalize_audit_review_confirmation();

create or replace function private.prevent_audit_confirmation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Signed final review confirmations are append-only';
end;
$$;

create trigger prevent_audit_confirmation_mutation
before update or delete on public.audit_review_confirmations
for each row execute function private.prevent_audit_confirmation_mutation();

create or replace function private.prevent_confirmed_audit_run_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.audit_review_confirmations confirmation
    where confirmation.audit_run_id = old.id
  ) then
    raise exception 'A preparation run with a signed final review confirmation is locked';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger prevent_confirmed_audit_run_mutation
before update or delete on public.mock_audit_runs
for each row execute function private.prevent_confirmed_audit_run_mutation();

revoke all on function private.finalize_audit_review_confirmation() from public, anon, authenticated;
revoke all on function private.prevent_audit_confirmation_mutation() from public, anon, authenticated;
revoke all on function private.prevent_confirmed_audit_run_mutation() from public, anon, authenticated;
