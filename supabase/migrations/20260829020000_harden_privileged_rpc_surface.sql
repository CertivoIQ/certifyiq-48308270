-- Keep privileged implementations out of the exposed public API schema.
-- Public RPC entry points are SECURITY INVOKER wrappers; each private
-- implementation performs its own auth/authority checks before mutation.

create schema if not exists private;

create or replace function public.claim_certivoiq_founder_admin()
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'claimed', false,
    'reason', 'founder_bootstrap_retired'
  );
$$;

create or replace function private.crm_staff_can_manage_current()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.user_roles ur
      join public.crm_staff_access access on access.user_id = ur.user_id
      where ur.user_id = auth.uid()
        and ur.role = 'staff'::public.app_role
        and access.status = 'active'
        and access.access_level in ('manager', 'admin')
    );
$$;

create or replace function private.crm_staff_is_admin_current()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.user_roles ur
      join public.crm_staff_access access on access.user_id = ur.user_id
      where ur.user_id = auth.uid()
        and ur.role = 'staff'::public.app_role
        and access.status = 'active'
        and access.access_level = 'admin'
    );
$$;

create or replace function public.crm_staff_can_manage(_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select _user_id = auth.uid() and private.crm_staff_can_manage_current();
$$;

create or replace function public.crm_staff_is_admin(_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select _user_id = auth.uid() and private.crm_staff_is_admin_current();
$$;

create or replace function private.claim_crm_staff_invitation_impl()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user auth.users%rowtype;
  invitation public.crm_staff_invitations%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('claimed', false, 'reason', 'authentication_required');
  end if;

  select * into v_user from auth.users where id = auth.uid();
  if not found or v_user.email_confirmed_at is null then
    return jsonb_build_object('claimed', false, 'reason', 'unconfirmed');
  end if;

  if lower(split_part(v_user.email, '@', 2)) <> 'certivoiq.com' then
    return jsonb_build_object('claimed', false, 'reason', 'domain');
  end if;

  select * into invitation
  from public.crm_staff_invitations
  where invite_email = lower(v_user.email)
    and status = 'pending'
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'no_pending_invitation');
  end if;

  insert into public.user_roles (user_id, role)
  values (v_user.id, 'staff')
  on conflict (user_id, role) do nothing;

  insert into public.crm_staff_access (
    user_id, access_level, status, granted_by, granted_at,
    disabled_by, disabled_at, updated_at
  ) values (
    v_user.id, invitation.access_level, 'active', invitation.invited_by, now(),
    null, null, now()
  )
  on conflict (user_id) do update
  set access_level = excluded.access_level,
      status = 'active',
      granted_by = excluded.granted_by,
      granted_at = now(),
      disabled_by = null,
      disabled_at = null,
      updated_at = now();

  update public.crm_staff_invitations
  set status = 'accepted', auth_user_id = v_user.id,
      accepted_at = now(), updated_at = now()
  where id = invitation.id;

  insert into public.crm_staff_access_events (
    actor_id, target_user_id, invitation_id, event_type, access_level
  ) values (
    invitation.invited_by, v_user.id, invitation.id, 'accepted', invitation.access_level
  );

  return jsonb_build_object('claimed', true, 'access_level', invitation.access_level);
end;
$$;

create or replace function public.claim_crm_staff_invitation()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.claim_crm_staff_invitation_impl();
$$;

create or replace function private.operations_approve_impl(_approval_id uuid, _reason text)
returns public.operations_approvals
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  approval public.operations_approvals;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'staff'::public.app_role) then
    raise exception 'staff approval required';
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

create or replace function public.operations_approve(_approval_id uuid, _reason text)
returns public.operations_approvals
language sql
security invoker
set search_path = pg_catalog, private, public
as $$
  select private.operations_approve_impl(_approval_id, _reason);
$$;

create or replace function private.operations_reject_impl(_approval_id uuid, _reason text)
returns public.operations_approvals
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare approval public.operations_approvals;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'staff'::public.app_role) then raise exception 'staff approval required'; end if;
  if nullif(trim(_reason),'') is null then raise exception 'rejection reason required'; end if;
  select * into approval from public.operations_approvals where id=_approval_id for update;
  if approval.id is null or approval.status <> 'pending' then raise exception 'approval is not pending'; end if;
  update public.operations_approvals set status='rejected', decided_by=auth.uid(), decided_at=now(), reason=trim(_reason)
  where id=_approval_id returning * into approval;
  return approval;
end;
$$;

create or replace function public.operations_reject(_approval_id uuid, _reason text)
returns public.operations_approvals
language sql
security invoker
set search_path = pg_catalog, private, public
as $$
  select private.operations_reject_impl(_approval_id, _reason);
$$;

create or replace function private.review_state_rule_source_candidate_impl(
  p_candidate_id uuid,
  p_decision text,
  p_source_sha256 text default null,
  p_retrieved_at timestamptz default null,
  p_notes text default null,
  p_effective_date date default null,
  p_supersession_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_candidate public.state_rule_source_candidates%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_hash text := lower(trim(coalesce(p_source_sha256, '')));
  v_notes text := trim(coalesce(p_notes, ''));
  v_next_status text;
  v_pack_status text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.crm_staff_access access
    where access.user_id = v_user_id
      and access.status = 'active'
      and access.access_level in ('manager', 'admin')
  ) then raise exception 'Active Manager or Administrator authority required'; end if;

  if v_decision not in ('captured_unvalidated', 'verified', 'blocked', 'rejected') then
    raise exception 'Unsupported source-review decision';
  end if;
  if char_length(v_notes) < 10 or char_length(v_notes) > 4000 then
    raise exception 'Review notes must contain 10 to 4000 characters';
  end if;
  if p_retrieved_at is not null and p_retrieved_at > now() + interval '5 minutes' then
    raise exception 'Retrieved time cannot be in the future';
  end if;
  if v_decision in ('captured_unvalidated', 'verified') then
    if v_hash !~ '^[0-9a-f]{64}$' then raise exception 'A lowercase 64-character SHA-256 is required'; end if;
    if p_retrieved_at is null then raise exception 'Retrieved time is required'; end if;
  elsif v_hash <> '' and v_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'SHA-256 must be blank or a lowercase 64-character value';
  end if;

  select * into v_candidate from public.state_rule_source_candidates where id = p_candidate_id for update;
  if not found then raise exception 'State source candidate not found'; end if;

  v_next_status := v_decision;
  update public.state_rule_source_candidates
  set agent_verification_status = v_next_status,
      exact_bytes_captured = case when v_decision in ('captured_unvalidated', 'verified') then true else exact_bytes_captured end,
      source_sha256 = case when v_hash = '' then source_sha256 else v_hash end,
      retrieved_at = coalesce(p_retrieved_at, retrieved_at),
      verification_evidence = coalesce(verification_evidence, '{}'::jsonb) || jsonb_build_object(
        'last_decision', v_decision, 'reviewer_id', v_user_id, 'reviewed_at', now(),
        'notes', v_notes, 'effective_date', p_effective_date,
        'supersession_notes', nullif(trim(coalesce(p_supersession_notes, '')), '')
      ),
      compliance_activation_allowed = false,
      updated_at = now()
  where id = v_candidate.id;

  insert into public.state_rule_source_verification_events (
    source_candidate_id, reviewer_id, decision, prior_status,
    source_sha256, retrieved_at, notes, evidence
  ) values (
    v_candidate.id, v_user_id, v_decision, v_candidate.agent_verification_status,
    nullif(v_hash, ''), p_retrieved_at, v_notes,
    jsonb_build_object(
      'state_code', v_candidate.state_code, 'authority_name', v_candidate.authority_name,
      'source_type', v_candidate.source_type, 'source_url', v_candidate.source_url,
      'effective_date', p_effective_date,
      'supersession_notes', nullif(trim(coalesce(p_supersession_notes, '')), '')
    )
  );

  select case
    when bool_and(agent_verification_status = 'verified') then 'verified'
    when bool_or(agent_verification_status in ('blocked', 'rejected')) then 'blocked'
    when bool_or(agent_verification_status <> 'queued_for_agent_verification') then 'agent_verification_in_progress'
    else 'queued_for_agent_verification'
  end into v_pack_status
  from public.state_rule_source_candidates
  where state_code = v_candidate.state_code
    and inventory_generated_at = v_candidate.inventory_generated_at;

  update public.state_rule_pack_candidates
  set status = v_pack_status, compliance_activation_allowed = false, updated_at = now()
  where state_code = v_candidate.state_code
    and inventory_generated_at = v_candidate.inventory_generated_at;

  return jsonb_build_object(
    'candidate_id', v_candidate.id, 'source_status', v_next_status,
    'pack_status', v_pack_status, 'compliance_activation_allowed', false
  );
end;
$$;

create or replace function public.review_state_rule_source_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_source_sha256 text default null,
  p_retrieved_at timestamptz default null,
  p_notes text default null,
  p_effective_date date default null,
  p_supersession_notes text default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.review_state_rule_source_candidate_impl(
    p_candidate_id, p_decision, p_source_sha256, p_retrieved_at,
    p_notes, p_effective_date, p_supersession_notes
  );
$$;

revoke all on function public.claim_certivoiq_founder_admin() from public, anon;
revoke all on function public.claim_crm_staff_invitation() from public, anon;
revoke all on function public.crm_staff_can_manage(uuid) from public, anon;
revoke all on function public.crm_staff_is_admin(uuid) from public, anon;
revoke all on function public.operations_approve(uuid, text) from public, anon;
revoke all on function public.operations_reject(uuid, text) from public, anon;
revoke all on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) from public, anon;

grant execute on function public.claim_certivoiq_founder_admin() to authenticated, service_role;
grant execute on function public.claim_crm_staff_invitation() to authenticated, service_role;
grant execute on function public.crm_staff_can_manage(uuid) to authenticated, service_role;
grant execute on function public.crm_staff_is_admin(uuid) to authenticated, service_role;
grant execute on function public.operations_approve(uuid, text) to authenticated, service_role;
grant execute on function public.operations_reject(uuid, text) to authenticated, service_role;
grant execute on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) to authenticated, service_role;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

revoke all on function private.crm_staff_can_manage_current() from public, anon;
revoke all on function private.crm_staff_is_admin_current() from public, anon;
revoke all on function private.claim_crm_staff_invitation_impl() from public, anon;
revoke all on function private.operations_approve_impl(uuid, text) from public, anon;
revoke all on function private.operations_reject_impl(uuid, text) from public, anon;
revoke all on function private.review_state_rule_source_candidate_impl(uuid, text, text, timestamptz, text, date, text) from public, anon;

grant execute on function private.crm_staff_can_manage_current() to authenticated, service_role;
grant execute on function private.crm_staff_is_admin_current() to authenticated, service_role;
grant execute on function private.claim_crm_staff_invitation_impl() to authenticated, service_role;
grant execute on function private.operations_approve_impl(uuid, text) to authenticated, service_role;
grant execute on function private.operations_reject_impl(uuid, text) to authenticated, service_role;
grant execute on function private.review_state_rule_source_candidate_impl(uuid, text, text, timestamptz, text, date, text) to authenticated, service_role;

comment on function public.claim_certivoiq_founder_admin() is
  'Retired one-time bootstrap endpoint. Founder access is already established.';
comment on function public.claim_crm_staff_invitation() is
  'Invoker-safe Data API wrapper for the private invitation claim implementation.';
comment on table public.stripe_processed_events is
  'Webhook idempotency ledger. Intentionally service-role-only; RLS has no client policy.';

do $$
declare
  exposed_definers integer;
begin
  select count(*) into exposed_definers
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.proname in (
      'claim_certivoiq_founder_admin', 'claim_crm_staff_invitation',
      'crm_staff_can_manage', 'crm_staff_is_admin', 'operations_approve',
      'operations_reject', 'review_state_rule_source_candidate'
    );
  if exposed_definers <> 0 then
    raise exception 'Privileged public RPC hardening incomplete: % exposed definers remain', exposed_definers;
  end if;
end
$$;
