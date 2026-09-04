-- Remove elevated functions from the exposed API schema while preserving
-- their existing public RPC signatures through SECURITY INVOKER wrappers.
-- Every private implementation retains its caller authorization checks.
-- The invitation claim additionally verifies auth.users.email_confirmed_at.

create schema if not exists private;

alter function public.accept_pha_workspace_invitation(uuid) set schema private;
alter function public.activate_state_rule_pack(uuid, text) set schema private;
alter function public.approve_certification_final(uuid, text, text, text) set schema private;
alter function public.approve_state_rule_release_candidate(uuid, text, text) set schema private;
alter function public.build_pha_family_evidence_manifest(uuid) set schema private;
alter function public.certification_task_queue() set schema private;
alter function public.create_state_rule_source_candidate(text, text, text, text, text, text, text, text) set schema private;
alter function public.current_pha_workspace_user_id() set schema private;
alter function public.is_pha_workspace_owner(uuid) set schema private;
alter function public.pha_family_access(uuid, boolean) set schema private;
alter function public.pha_program_access(uuid, text, boolean) set schema private;
alter function public.pha_workspace_admin_access(uuid) set schema private;
alter function public.prepare_pha_50058_submission(uuid, text) set schema private;
alter function public.record_pha_50058_submission_event(uuid, text, text, text, text) set schema private;
alter function public.resolve_certification_finding(uuid, text) set schema private;
alter function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) set schema private;
alter function public.select_next_pha_waiting_list_applicant(uuid) set schema private;
alter function public.state_rule_pack_activation_readiness() set schema private;
alter function public.state_rule_release_readiness() set schema private;

alter function private.accept_pha_workspace_invitation(uuid) set search_path = '';
alter function private.activate_state_rule_pack(uuid, text) set search_path = '';
alter function private.approve_certification_final(uuid, text, text, text) set search_path = '';
alter function private.approve_state_rule_release_candidate(uuid, text, text) set search_path = '';
alter function private.build_pha_family_evidence_manifest(uuid) set search_path = '';
alter function private.certification_task_queue() set search_path = '';
alter function private.create_state_rule_source_candidate(text, text, text, text, text, text, text, text) set search_path = '';
alter function private.current_pha_workspace_user_id() set search_path = '';
alter function private.is_pha_workspace_owner(uuid) set search_path = '';
alter function private.pha_family_access(uuid, boolean) set search_path = '';
alter function private.pha_program_access(uuid, text, boolean) set search_path = '';
alter function private.pha_workspace_admin_access(uuid) set search_path = '';
alter function private.prepare_pha_50058_submission(uuid, text) set search_path = '';
alter function private.record_pha_50058_submission_event(uuid, text, text, text, text) set search_path = '';
alter function private.resolve_certification_finding(uuid, text) set search_path = '';
alter function private.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) set search_path = '';
alter function private.select_next_pha_waiting_list_applicant(uuid) set search_path = '';
alter function private.state_rule_pack_activation_readiness() set search_path = '';
alter function private.state_rule_release_readiness() set search_path = '';

create or replace function private.accept_pha_workspace_invitation(target_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invitation public.pha_workspace_invitations%rowtype;
  signed_in_user auth.users%rowtype;
  signed_in_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication with a verified email is required';
  end if;

  select * into signed_in_user from auth.users where id = auth.uid();
  if not found or signed_in_user.email_confirmed_at is null then
    raise exception 'Authentication with a verified email is required';
  end if;

  signed_in_email := lower(coalesce(signed_in_user.email, ''));
  if signed_in_email = '' then
    raise exception 'Authentication with a verified email is required';
  end if;

  select * into invitation
  from public.pha_workspace_invitations
  where id = target_invitation_id
  for update;

  if not found then raise exception 'PHA invitation not found'; end if;
  if invitation.status <> 'pending' then raise exception 'PHA invitation is no longer pending'; end if;
  if invitation.expires_at <= now() then
    update public.pha_workspace_invitations
    set status = 'expired', updated_at = now()
    where id = invitation.id;
    raise exception 'PHA invitation has expired';
  end if;
  if lower(invitation.invite_email) <> signed_in_email then
    raise exception 'PHA invitation email does not match the signed-in user';
  end if;
  if invitation.workspace_user_id = auth.uid() then
    raise exception 'PHA workspace owner cannot accept a self invitation';
  end if;

  insert into public.pha_workspace_memberships (
    workspace_user_id, member_user_id, agency_role, active, created_by
  )
  values (
    invitation.workspace_user_id, auth.uid(), invitation.agency_role, true, invitation.created_by
  )
  on conflict (workspace_user_id, member_user_id) do update
    set agency_role = excluded.agency_role,
        active = true,
        updated_at = now();

  update public.pha_workspace_invitations
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  where id = invitation.id;

  return invitation.workspace_user_id;
end;
$function$;

create or replace function public.accept_pha_workspace_invitation(target_invitation_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.accept_pha_workspace_invitation(target_invitation_id); $$;

create or replace function public.activate_state_rule_pack(p_pack_candidate_id uuid, p_notes text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.activate_state_rule_pack(p_pack_candidate_id, p_notes); $$;

create or replace function public.approve_certification_final(
  _case_id uuid, _responsible_party_name text,
  _responsible_party_position text, _signature text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.approve_certification_final(
  _case_id, _responsible_party_name, _responsible_party_position, _signature
); $$;

create or replace function public.approve_state_rule_release_candidate(
  p_pack_candidate_id uuid, p_decision text, p_notes text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.approve_state_rule_release_candidate(
  p_pack_candidate_id, p_decision, p_notes
); $$;

create or replace function public.build_pha_family_evidence_manifest(target_family_action_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.build_pha_family_evidence_manifest(target_family_action_id); $$;

create or replace function public.certification_task_queue()
returns table(
  id text, task_type text, title text, description text, status text,
  active boolean, occurred_at timestamptz, destination text,
  action_label text, finding_id uuid, case_id uuid, workflow_role text,
  attention boolean
)
language sql stable security invoker set search_path = ''
as $$ select * from private.certification_task_queue(); $$;

create or replace function public.create_state_rule_source_candidate(
  p_state_code text, p_scope text, p_authority_name text,
  p_official_domain text, p_program text, p_source_type text,
  p_source_url text,
  p_candidate_status text default 'PENDING_EXACT_BYTES_AND_HASHES'::text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.create_state_rule_source_candidate(
  p_state_code, p_scope, p_authority_name, p_official_domain,
  p_program, p_source_type, p_source_url, p_candidate_status
); $$;

create or replace function public.current_pha_workspace_user_id()
returns uuid language sql stable security invoker set search_path = ''
as $$ select private.current_pha_workspace_user_id(); $$;

create or replace function public.is_pha_workspace_owner(target_workspace_user_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_pha_workspace_owner(target_workspace_user_id); $$;

create or replace function public.pha_family_access(
  target_family_action_id uuid, write_access boolean default false
)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.pha_family_access(target_family_action_id, write_access); $$;

create or replace function public.pha_program_access(
  target_workspace_user_id uuid, target_program_code text,
  write_access boolean default false
)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.pha_program_access(
  target_workspace_user_id, target_program_code, write_access
); $$;

create or replace function public.pha_workspace_admin_access(target_workspace_user_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.pha_workspace_admin_access(target_workspace_user_id); $$;

create or replace function public.prepare_pha_50058_submission(
  target_transaction_id uuid,
  requested_transport_mode text default 'manual_external'::text
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.prepare_pha_50058_submission(
  target_transaction_id, requested_transport_mode
); $$;

create or replace function public.record_pha_50058_submission_event(
  target_attempt_id uuid, new_status text,
  external_reference text default null,
  new_response_code text default null,
  new_response_message text default null
)
returns void language sql security invoker set search_path = ''
as $$ select private.record_pha_50058_submission_event(
  target_attempt_id, new_status, external_reference, new_response_code, new_response_message
); $$;

create or replace function public.resolve_certification_finding(
  _finding_id uuid, _resolution_notes text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.resolve_certification_finding(_finding_id, _resolution_notes); $$;

create or replace function public.review_state_rule_source_candidate(
  p_candidate_id uuid, p_decision text,
  p_source_sha256 text default null,
  p_retrieved_at timestamptz default null,
  p_notes text default null,
  p_effective_date date default null,
  p_supersession_notes text default null
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.review_state_rule_source_candidate(
  p_candidate_id, p_decision, p_source_sha256, p_retrieved_at,
  p_notes, p_effective_date, p_supersession_notes
); $$;

create or replace function public.select_next_pha_waiting_list_applicant(target_waiting_list_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.select_next_pha_waiting_list_applicant(target_waiting_list_id); $$;

create or replace function public.state_rule_pack_activation_readiness()
returns table(
  pack_candidate_id uuid, state_code text, inventory_generated_at timestamptz,
  pack_status text, sources_ready boolean, activation_recorded boolean,
  first_reviewer_count integer, viewer_is_first_reviewer boolean,
  viewer_can_activate boolean, validated_on date, activated_on date
)
language sql security invoker set search_path = ''
as $$ select * from private.state_rule_pack_activation_readiness(); $$;

create or replace function public.state_rule_release_readiness()
returns table(
  pack_candidate_id uuid, state_code text, status text,
  release_critical_document_gaps jsonb, blockers jsonb, updated_at timestamptz
)
language sql security invoker set search_path = ''
as $$ select * from private.state_rule_release_readiness(); $$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

revoke all on function public.accept_pha_workspace_invitation(uuid) from public, anon;
revoke all on function public.activate_state_rule_pack(uuid, text) from public, anon;
revoke all on function public.approve_certification_final(uuid, text, text, text) from public, anon;
revoke all on function public.approve_state_rule_release_candidate(uuid, text, text) from public, anon;
revoke all on function public.build_pha_family_evidence_manifest(uuid) from public, anon;
revoke all on function public.certification_task_queue() from public, anon;
revoke all on function public.create_state_rule_source_candidate(text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.current_pha_workspace_user_id() from public, anon;
revoke all on function public.is_pha_workspace_owner(uuid) from public, anon;
revoke all on function public.pha_family_access(uuid, boolean) from public, anon;
revoke all on function public.pha_program_access(uuid, text, boolean) from public, anon;
revoke all on function public.pha_workspace_admin_access(uuid) from public, anon;
revoke all on function public.prepare_pha_50058_submission(uuid, text) from public, anon;
revoke all on function public.record_pha_50058_submission_event(uuid, text, text, text, text) from public, anon;
revoke all on function public.resolve_certification_finding(uuid, text) from public, anon;
revoke all on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) from public, anon;
revoke all on function public.select_next_pha_waiting_list_applicant(uuid) from public, anon;
revoke all on function public.state_rule_pack_activation_readiness() from public, anon;
revoke all on function public.state_rule_release_readiness() from public, anon;

grant execute on function public.accept_pha_workspace_invitation(uuid) to authenticated, service_role;
grant execute on function public.activate_state_rule_pack(uuid, text) to authenticated, service_role;
grant execute on function public.approve_certification_final(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.approve_state_rule_release_candidate(uuid, text, text) to authenticated, service_role;
grant execute on function public.build_pha_family_evidence_manifest(uuid) to authenticated, service_role;
grant execute on function public.certification_task_queue() to authenticated, service_role;
grant execute on function public.create_state_rule_source_candidate(text, text, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.current_pha_workspace_user_id() to authenticated, service_role;
grant execute on function public.is_pha_workspace_owner(uuid) to authenticated, service_role;
grant execute on function public.pha_family_access(uuid, boolean) to authenticated, service_role;
grant execute on function public.pha_program_access(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.pha_workspace_admin_access(uuid) to authenticated, service_role;
grant execute on function public.prepare_pha_50058_submission(uuid, text) to authenticated, service_role;
grant execute on function public.record_pha_50058_submission_event(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.resolve_certification_finding(uuid, text) to authenticated, service_role;
grant execute on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) to authenticated, service_role;
grant execute on function public.select_next_pha_waiting_list_applicant(uuid) to authenticated, service_role;
grant execute on function public.state_rule_pack_activation_readiness() to authenticated, service_role;
grant execute on function public.state_rule_release_readiness() to authenticated, service_role;

revoke all on function private.accept_pha_workspace_invitation(uuid) from public, anon;
revoke all on function private.activate_state_rule_pack(uuid, text) from public, anon;
revoke all on function private.approve_certification_final(uuid, text, text, text) from public, anon;
revoke all on function private.approve_state_rule_release_candidate(uuid, text, text) from public, anon;
revoke all on function private.build_pha_family_evidence_manifest(uuid) from public, anon;
revoke all on function private.certification_task_queue() from public, anon;
revoke all on function private.create_state_rule_source_candidate(text, text, text, text, text, text, text, text) from public, anon;
revoke all on function private.current_pha_workspace_user_id() from public, anon;
revoke all on function private.is_pha_workspace_owner(uuid) from public, anon;
revoke all on function private.pha_family_access(uuid, boolean) from public, anon;
revoke all on function private.pha_program_access(uuid, text, boolean) from public, anon;
revoke all on function private.pha_workspace_admin_access(uuid) from public, anon;
revoke all on function private.prepare_pha_50058_submission(uuid, text) from public, anon;
revoke all on function private.record_pha_50058_submission_event(uuid, text, text, text, text) from public, anon;
revoke all on function private.resolve_certification_finding(uuid, text) from public, anon;
revoke all on function private.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) from public, anon;
revoke all on function private.select_next_pha_waiting_list_applicant(uuid) from public, anon;
revoke all on function private.state_rule_pack_activation_readiness() from public, anon;
revoke all on function private.state_rule_release_readiness() from public, anon;

grant execute on function private.accept_pha_workspace_invitation(uuid) to authenticated, service_role;
grant execute on function private.activate_state_rule_pack(uuid, text) to authenticated, service_role;
grant execute on function private.approve_certification_final(uuid, text, text, text) to authenticated, service_role;
grant execute on function private.approve_state_rule_release_candidate(uuid, text, text) to authenticated, service_role;
grant execute on function private.build_pha_family_evidence_manifest(uuid) to authenticated, service_role;
grant execute on function private.certification_task_queue() to authenticated, service_role;
grant execute on function private.create_state_rule_source_candidate(text, text, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function private.current_pha_workspace_user_id() to authenticated, service_role;
grant execute on function private.is_pha_workspace_owner(uuid) to authenticated, service_role;
grant execute on function private.pha_family_access(uuid, boolean) to authenticated, service_role;
grant execute on function private.pha_program_access(uuid, text, boolean) to authenticated, service_role;
grant execute on function private.pha_workspace_admin_access(uuid) to authenticated, service_role;
grant execute on function private.prepare_pha_50058_submission(uuid, text) to authenticated, service_role;
grant execute on function private.record_pha_50058_submission_event(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function private.resolve_certification_finding(uuid, text) to authenticated, service_role;
grant execute on function private.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) to authenticated, service_role;
grant execute on function private.select_next_pha_waiting_list_applicant(uuid) to authenticated, service_role;
grant execute on function private.state_rule_pack_activation_readiness() to authenticated, service_role;
grant execute on function private.state_rule_release_readiness() to authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

comment on function public.accept_pha_workspace_invitation(uuid) is
  'Invoker-safe Data API wrapper for the private, verified-email invitation claim.';
comment on function public.pha_program_access(uuid, text, boolean) is
  'Invoker-safe wrapper for the private PHA authorization helper.';
comment on function public.review_state_rule_source_candidate(uuid, text, text, timestamptz, text, date, text) is
  'Invoker-safe Data API wrapper for controlled state-source review.';

do $$
declare
  exposed_authenticated_definers integer;
  hardened_public_wrappers integer;
  hardened_private_implementations integer;
begin
  select count(*) into exposed_authenticated_definers
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'execute');

  if exposed_authenticated_definers <> 0 then
    raise exception 'Authenticated SECURITY DEFINER functions remain in public: %',
      exposed_authenticated_definers;
  end if;

  select count(*) into hardened_public_wrappers
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any (array[
      'accept_pha_workspace_invitation', 'activate_state_rule_pack',
      'approve_certification_final', 'approve_state_rule_release_candidate',
      'build_pha_family_evidence_manifest', 'certification_task_queue',
      'create_state_rule_source_candidate', 'current_pha_workspace_user_id',
      'is_pha_workspace_owner', 'pha_family_access', 'pha_program_access',
      'pha_workspace_admin_access', 'prepare_pha_50058_submission',
      'record_pha_50058_submission_event', 'resolve_certification_finding',
      'review_state_rule_source_candidate', 'select_next_pha_waiting_list_applicant',
      'state_rule_pack_activation_readiness', 'state_rule_release_readiness'
    ])
    and not p.prosecdef
    and coalesce(array_to_string(p.proconfig, ','), '') = 'search_path=""'
    and has_function_privilege('authenticated', p.oid, 'execute')
    and not has_function_privilege('anon', p.oid, 'execute');

  if hardened_public_wrappers <> 19 then
    raise exception 'Expected 19 hardened public wrappers, found %',
      hardened_public_wrappers;
  end if;

  select count(*) into hardened_private_implementations
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = any (array[
      'accept_pha_workspace_invitation', 'activate_state_rule_pack',
      'approve_certification_final', 'approve_state_rule_release_candidate',
      'build_pha_family_evidence_manifest', 'certification_task_queue',
      'create_state_rule_source_candidate', 'current_pha_workspace_user_id',
      'is_pha_workspace_owner', 'pha_family_access', 'pha_program_access',
      'pha_workspace_admin_access', 'prepare_pha_50058_submission',
      'record_pha_50058_submission_event', 'resolve_certification_finding',
      'review_state_rule_source_candidate', 'select_next_pha_waiting_list_applicant',
      'state_rule_pack_activation_readiness', 'state_rule_release_readiness'
    ])
    and p.prosecdef
    and coalesce(array_to_string(p.proconfig, ','), '') = 'search_path=""'
    and has_function_privilege('authenticated', p.oid, 'execute')
    and not has_function_privilege('anon', p.oid, 'execute');

  if hardened_private_implementations <> 19 then
    raise exception 'Expected 19 hardened private implementations, found %',
      hardened_private_implementations;
  end if;
end
$$;