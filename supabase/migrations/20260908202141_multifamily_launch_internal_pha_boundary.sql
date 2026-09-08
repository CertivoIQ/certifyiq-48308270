-- Multifamily launch boundary: additive restrictive policies and 13 named public RPC guards.
-- Private PHA implementations, existing tenant policies and session enforcement stay intact.
create or replace function private.is_internal_segment_user()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u where u.id = auth.uid()
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
      and u.email ~* '^[^@[:space:]]+@certivoiq[.]com$'
  );
$$;
revoke all on function private.is_internal_segment_user() from public;
grant execute on function private.is_internal_segment_user() to authenticated, anon, service_role;

create policy internal_segment_boundary on public.pha_50058_submission_attempts
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_50058_submission_events
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_50058_transactions
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_50058_transport_profiles
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_agency_settings
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_authoritative_control_state
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_controlled_templates
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_family_actions
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_family_calculations
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_family_eiv_exceptions
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_family_evidence
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_family_notices
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_hcv_hap_contracts
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_hcv_rfta_requests
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_hcv_vouchers
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_inspection_deficiencies
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_inspection_transition_profiles
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_inspections
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_integration_profiles
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_mod_rehab_contracts
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_mod_rehab_hap_actions
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_notice_policy_overlays
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_notice_requirement_profiles
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_nspire_deficiency_standards
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_nspire_release_attestations
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_nspire_source_artifacts
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_nspire_standard_releases
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_pbv_hap_contracts
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_pbv_move_requests
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_pbv_rent_actions
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_pbv_waiting_list_applicants
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_pbv_waiting_list_decisions
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_pbv_waiting_lists
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_portability_billing
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_portability_cases
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_public_housing_admission_year_controls
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_public_housing_development_profiles
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_public_housing_leases
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_public_housing_non_public_leases
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_public_housing_over_income_cases
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_public_housing_over_income_notices
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_public_housing_rent_elections
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_public_housing_transfers
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_public_housing_unit_offers
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_reasonable_accommodation_requests
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_source_library
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_verification_requirement_matrix
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_waiting_list_applicants
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_waiting_list_preferences
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_waiting_list_selection_events
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_waiting_lists
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_workspace_invitations
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.pha_workspace_memberships
as restrictive for all to authenticated, anon
using ((select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()));

create policy internal_segment_boundary on public.customer_workspace_profiles
as restrictive for all to authenticated
using (organization_type <> 'pha' or (select private.is_internal_segment_user()))
with check ((select private.is_internal_segment_user()) or
(organization_type = 'multifamily_owner_agent' and coalesce(cardinality(pha_programs),0)=0
and pha_hotma_cohort is null and hud_50058_reporting_path is null));

create policy internal_segment_boundary on public.platform_dashboard_access
as restrictive for all to authenticated
using (dashboard_key <> 'pha' or (select private.is_internal_segment_user()))
with check (dashboard_key <> 'pha' or (select private.is_internal_segment_user()));

CREATE OR REPLACE FUNCTION public.accept_pha_workspace_invitation(target_invitation_id uuid)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select case when private.is_internal_segment_user() then private.accept_pha_workspace_invitation(target_invitation_id) else null end;
$function$;

CREATE OR REPLACE FUNCTION public.activate_pha_nspire_standard_release(target_release_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case when private.is_internal_segment_user() then private.activate_pha_nspire_standard_release(target_release_id) else null end;
$function$;

CREATE OR REPLACE FUNCTION public.attest_and_activate_pha_nspire_release(target_release_id uuid, expected_sha256 text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case when private.is_internal_segment_user() then private.attest_and_activate_pha_nspire_release(
    target_release_id,
    expected_sha256
  ) else null end;
$function$;

CREATE OR REPLACE FUNCTION public.build_pha_family_evidence_manifest(target_family_action_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select case when private.is_internal_segment_user() then private.build_pha_family_evidence_manifest(target_family_action_id) else null end;
$function$;

CREATE OR REPLACE FUNCTION public.current_pha_workspace_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case when private.is_internal_segment_user() then private.current_pha_workspace_user_id() else null end;
$function$;

CREATE OR REPLACE FUNCTION public.is_pha_workspace_owner(target_workspace_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case when private.is_internal_segment_user() then private.is_pha_workspace_owner(target_workspace_user_id) else false end;
$function$;

CREATE OR REPLACE FUNCTION public.pha_family_access(target_family_action_id uuid, write_access boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case when private.is_internal_segment_user() then private.pha_family_access(target_family_action_id, write_access) else false end;
$function$;

CREATE OR REPLACE FUNCTION public.pha_program_access(target_workspace_user_id uuid, target_program_code text, write_access boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case when private.is_internal_segment_user() then private.pha_program_access(
  target_workspace_user_id, target_program_code, write_access
) else false end;
$function$;

CREATE OR REPLACE FUNCTION public.pha_workspace_admin_access(target_workspace_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case when private.is_internal_segment_user() then private.pha_workspace_admin_access(target_workspace_user_id) else false end;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_pha_50058_submission(target_transaction_id uuid, requested_transport_mode text DEFAULT 'manual_external'::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select case when private.is_internal_segment_user() then private.prepare_pha_50058_submission(
  target_transaction_id, requested_transport_mode
) else null end;
$function$;

CREATE OR REPLACE FUNCTION public.record_pha_50058_submission_event(target_attempt_id uuid, new_status text, external_reference text DEFAULT NULL::text, new_response_code text DEFAULT NULL::text, new_response_message text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select case when private.is_internal_segment_user() then private.record_pha_50058_submission_event(
  target_attempt_id, new_status, external_reference, new_response_code, new_response_message
) else null end;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_pha_nspire_release_counts(target_release_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case when private.is_internal_segment_user() then private.refresh_pha_nspire_release_counts(target_release_id) else null end;
$function$;

CREATE OR REPLACE FUNCTION public.select_next_pha_waiting_list_applicant(target_waiting_list_id uuid)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select case when private.is_internal_segment_user() then private.select_next_pha_waiting_list_applicant(target_waiting_list_id) else null end;
$function$;


-- Defense in depth: private entry points also verify the current internal identity.
CREATE OR REPLACE FUNCTION private.accept_pha_workspace_invitation(target_invitation_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  invitation public.pha_workspace_invitations%rowtype;
  signed_in_user auth.users%rowtype;
  signed_in_email text;
begin
  if not private.is_internal_segment_user() then raise exception 'Internal workspace access required' using errcode = '42501'; end if;
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

CREATE OR REPLACE FUNCTION private.activate_pha_nspire_standard_release(target_release_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.pha_nspire_standard_releases%rowtype; standard_count integer; deficiency_count integer; bundle_ok boolean;
begin
  if not private.is_internal_segment_user() then raise exception 'Internal workspace access required' using errcode = '42501'; end if;
  if not public.has_role(auth.uid(),'staff') then raise exception 'Staff authority required to activate NSPIRE standards'; end if;
  select * into r from public.pha_nspire_standard_releases where id=target_release_id;
  if not found then raise exception 'NSPIRE standards release not found'; end if;
  if r.verified_by is null or r.verified_at is null or coalesce(trim(r.source_checksum),'')='' then raise exception 'NSPIRE release verification is incomplete'; end if;
  if r.expected_standard_count is null then raise exception 'NSPIRE release requires the expected HUD standard count before activation'; end if;
  if coalesce(trim(r.bundle_url),'')='' or (r.bundle_url not like 'https://www.hud.gov/%' and r.bundle_url not like 'https://hud.gov/%') then raise exception 'NSPIRE release requires an official HUD bundle URL'; end if;
  select count(distinct standard_name),count(*) into standard_count,deficiency_count from public.pha_nspire_deficiency_standards where release_id=r.id;
  if deficiency_count=0 then raise exception 'NSPIRE release cannot activate with an empty deficiency registry'; end if;
  if standard_count<>r.expected_standard_count then raise exception 'NSPIRE release standard count does not match the controlled HUD manifest'; end if;
  select exists(select 1 from public.pha_nspire_source_artifacts a where a.release_id=r.id and a.artifact_type='bundle_zip' and a.import_status='verified' and coalesce(trim(a.sha256),'')<>'') into bundle_ok;
  if not bundle_ok then raise exception 'Verified HUD NSPIRE bundle artifact and checksum are required before activation'; end if;
  if exists(select 1 from public.pha_nspire_deficiency_standards s where s.release_id=r.id and (coalesce(trim(s.standard_name),'')='' or coalesce(trim(s.deficiency_reference),'')='' or coalesce(trim(s.source_url),'')='')) then raise exception 'NSPIRE deficiency rows are incomplete'; end if;
  update public.pha_nspire_standard_releases set status='superseded' where status='current' and id<>r.id;
  update public.pha_nspire_deficiency_standards set source_status='superseded',active=false where source_status='current' and release_id is distinct from r.id;
  update public.pha_nspire_deficiency_standards set source_status='current',active=true,source_version=r.source_version,source_checksum=r.source_checksum,updated_at=now() where release_id=r.id;
  update public.pha_nspire_standard_releases set status='current',imported_standard_count=standard_count,imported_deficiency_count=deficiency_count,activated_at=now(),updated_at=now() where id=r.id;
end; $function$;

CREATE OR REPLACE FUNCTION private.attest_and_activate_pha_nspire_release(target_release_id uuid, expected_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_id uuid:=auth.uid();
  release_row public.pha_nspire_standard_releases%rowtype;
  standard_count integer;
  deficiency_count integer;
  attestation_count integer;
  artifact_ok boolean;
  is_activated boolean:=false;
begin
  if not private.is_internal_segment_user() then raise exception 'Internal workspace access required' using errcode = '42501'; end if;
  if caller_id is null or not public.has_role(caller_id,'staff') then
    raise exception 'Staff authority required to attest to NSPIRE source integrity';
  end if;

  select * into release_row
  from public.pha_nspire_standard_releases
  where id=target_release_id
  for update;

  if not found then raise exception 'NSPIRE standards release not found'; end if;
  if expected_sha256 is distinct from release_row.source_checksum
     or expected_sha256<>'9758d7703e574eb3f0ab923b58dc9040cf5f6e7a671db2785ebd4ec7ebee6254' then
    raise exception 'NSPIRE checksum does not match the controlled HUD bundle';
  end if;

  select count(distinct standard_name),count(*)
    into standard_count,deficiency_count
  from public.pha_nspire_deficiency_standards
  where release_id=target_release_id;

  if standard_count<>release_row.expected_standard_count
     or deficiency_count<>release_row.expected_deficiency_count then
    raise exception 'NSPIRE imported counts do not match the controlled manifest';
  end if;

  select exists(
    select 1 from public.pha_nspire_source_artifacts
    where release_id=target_release_id
      and artifact_type='bundle_zip'
      and sha256=expected_sha256
      and import_status in ('parsed','verified')
      and parsed_row_count=release_row.expected_deficiency_count
  ) into artifact_ok;

  if not artifact_ok then
    raise exception 'Parsed HUD bundle artifact is incomplete or has the wrong checksum';
  end if;

  insert into public.pha_nspire_release_attestations(
    release_id,verifier_id,attested_sha256
  )
  values(target_release_id,caller_id,expected_sha256)
  on conflict (release_id,verifier_id) do update set
    attested_sha256=excluded.attested_sha256,
    attested_at=now();

  select count(distinct verifier_id) into attestation_count
  from public.pha_nspire_release_attestations
  where release_id=target_release_id and attested_sha256=expected_sha256;

  if attestation_count>=2 then
    update public.pha_nspire_source_artifacts
       set import_status='verified',verified_by=caller_id,verified_at=now(),updated_at=now()
     where release_id=target_release_id and artifact_type='bundle_zip' and sha256=expected_sha256;
    update public.pha_nspire_standard_releases
       set verified_by=caller_id,verified_at=now(),updated_at=now()
     where id=target_release_id;
    perform public.activate_pha_nspire_standard_release(target_release_id);
    is_activated:=true;
  end if;

  return jsonb_build_object(
    'release_id',target_release_id,
    'attestations',attestation_count,
    'required_attestations',2,
    'activated',is_activated
  );
end $function$;

CREATE OR REPLACE FUNCTION private.build_pha_family_evidence_manifest(target_family_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  action_row public.pha_family_actions%rowtype;
  calculation jsonb;
  evidence jsonb;
  notices jsonb;
  tx jsonb;
  controls jsonb;
begin
  if not private.is_internal_segment_user() then raise exception 'Internal workspace access required' using errcode = '42501'; end if;
  select * into action_row from public.pha_family_actions where id=target_family_action_id;
  if not found then raise exception 'PHA family action not found'; end if;
  if not public.pha_program_access(action_row.user_id,action_row.program_code,false) then raise exception 'Not authorized to export this PHA family record'; end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at),'[]'::jsonb) into evidence from public.pha_family_evidence e where e.family_action_id=target_family_action_id;
  select coalesce(to_jsonb(c),'null'::jsonb) into calculation from public.pha_family_calculations c where c.family_action_id=target_family_action_id limit 1;
  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at),'[]'::jsonb) into notices from public.pha_family_notices n where n.family_action_id=target_family_action_id;
  select coalesce(to_jsonb(t),'null'::jsonb) into tx from public.pha_50058_transactions t where t.source_family_action_id=target_family_action_id limit 1;
  select coalesce(to_jsonb(c),'null'::jsonb) into controls from public.pha_authoritative_control_state c where c.user_id=action_row.user_id and c.program_code=action_row.program_code limit 1;

  return jsonb_build_object(
    'manifest_version','2026.08.1',
    'generated_at',now(),
    'family_action',to_jsonb(action_row),
    'evidence',evidence,
    'calculation',calculation,
    'notices',notices,
    'hud_50058_transaction',tx,
    'authoritative_controls',controls,
    'integrity',jsonb_build_object(
      'verification_complete',action_row.verification_complete,
      'eiv_review_complete',action_row.eiv_review_complete,
      'calculation_complete',action_row.calculation_complete,
      'notice_complete',action_row.notice_complete,
      'controlled_source_release_approved',action_row.controlled_source_release_approved,
      'current_rule_version_validated',action_row.current_rule_version_validated,
      'source_status_conflict',action_row.source_status_conflict,
      'reporting_path_validated',action_row.reporting_path_validated,
      'software_compatibility_validated',action_row.software_compatibility_validated
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.current_pha_workspace_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when private.is_internal_segment_user() then (select coalesce(
    (select p.user_id from public.customer_workspace_profiles p
      where p.user_id = auth.uid() and p.organization_type = 'pha' limit 1),
    (select m.workspace_user_id from public.pha_workspace_memberships m
      where m.member_user_id = auth.uid() and m.active = true limit 1),
    auth.uid()
  )) else null end;
$function$;

CREATE OR REPLACE FUNCTION private.is_pha_workspace_owner(target_workspace_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when private.is_internal_segment_user() then (select target_workspace_user_id = auth.uid()
     and exists (
       select 1 from public.customer_workspace_profiles p
        where p.user_id = target_workspace_user_id
          and p.organization_type = 'pha'
     )) else false end;
$function$;

CREATE OR REPLACE FUNCTION private.pha_family_access(target_family_action_id uuid, write_access boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when private.is_internal_segment_user() then (select exists (
    select 1 from public.pha_family_actions a
     where a.id = target_family_action_id
       and public.pha_program_access(a.user_id, a.program_code, write_access)
  )) else false end;
$function$;

CREATE OR REPLACE FUNCTION private.pha_program_access(target_workspace_user_id uuid, target_program_code text, write_access boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when private.is_internal_segment_user() then (select case
    when auth.uid() = target_workspace_user_id then true
    when public.has_role(auth.uid(), 'staff') then true
    else exists (
      select 1 from public.pha_workspace_memberships m
       where m.workspace_user_id = target_workspace_user_id
         and m.member_user_id = auth.uid()
         and m.active = true
         and (
           (m.agency_role in ('agency_admin','compliance_admin'))
           or (write_access = false and m.agency_role = 'executive')
           or (m.agency_role = 'hcv_pbv_specialist' and target_program_code in ('hcv','pbv','mod_rehab'))
           or (m.agency_role = 'public_housing_specialist' and target_program_code = 'public_housing')
         )
    )
  end) else false end;
$function$;

CREATE OR REPLACE FUNCTION private.pha_workspace_admin_access(target_workspace_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when private.is_internal_segment_user() then (select public.is_pha_workspace_owner(target_workspace_user_id)
    or public.has_role(auth.uid(), 'staff')
    or exists (
      select 1 from public.pha_workspace_memberships m
       where m.workspace_user_id = target_workspace_user_id
         and m.member_user_id = auth.uid()
         and m.active = true
         and m.agency_role = 'agency_admin'
    )) else false end;
$function$;

CREATE OR REPLACE FUNCTION private.prepare_pha_50058_submission(target_transaction_id uuid, requested_transport_mode text DEFAULT 'manual_external'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.pha_50058_transactions%rowtype; p public.customer_workspace_profiles%rowtype; transport public.pha_50058_transport_profiles%rowtype; attempt_no integer; attempt_id uuid; payload jsonb;
begin
  if not private.is_internal_segment_user() then raise exception 'Internal workspace access required' using errcode = '42501'; end if;
 select * into t from public.pha_50058_transactions where id=target_transaction_id;
 if not found then raise exception 'HUD-50058 transaction not found'; end if;
 if not public.pha_program_access(t.user_id,t.program_code,true) then raise exception 'Not authorized to prepare this HUD-50058 transaction'; end if;
 if not (t.program_applicability_validated and t.controlled_source_release_approved and t.current_rule_version_validated and not t.source_status_conflict and t.reporting_path_validated and t.software_compatibility_validated) then raise exception 'HUD-50058 transaction controls are not ready for submission'; end if;
 select * into p from public.customer_workspace_profiles where user_id=t.user_id;
 if p.hud_50058_reporting_path is null then raise exception 'HUD-50058 reporting path is not configured'; end if;
 if requested_transport_mode not in ('manual_external','api') then raise exception 'Unsupported HUD-50058 transport mode'; end if;
 if requested_transport_mode='api' then
   select * into transport from public.pha_50058_transport_profiles where workspace_user_id=t.user_id and reporting_path=p.hud_50058_reporting_path and transport_mode='api' and status='validated';
   if not found then raise exception 'Validated HUD-50058 API transport is not configured'; end if;
 end if;
 select coalesce(max(attempt_number),0)+1 into attempt_no from public.pha_50058_submission_attempts where transaction_id=t.id;
 payload:=jsonb_build_object('transaction_id',t.id,'family_reference',t.family_reference,'program_code',t.program_code,'transaction_type',t.transaction_type,'effective_date',t.effective_date,'reporting_path',p.hud_50058_reporting_path,'source_family_action_id',t.source_family_action_id,'routing_status',t.routing_status,'prepared_at',now());
 insert into public.pha_50058_submission_attempts(transaction_id,workspace_user_id,attempt_number,transport_mode,payload_snapshot,status) values(t.id,t.user_id,attempt_no,requested_transport_mode,payload,'ready_for_transport') returning id into attempt_id;
 insert into public.pha_50058_submission_events(transaction_id,submission_attempt_id,event_type,event_snapshot) values(t.id,attempt_id,'prepared',payload);
 update public.pha_50058_transactions set submission_status='ready_for_transport',updated_at=now() where id=t.id;
 return attempt_id;
end; $function$;

CREATE OR REPLACE FUNCTION private.record_pha_50058_submission_event(target_attempt_id uuid, new_status text, external_reference text DEFAULT NULL::text, new_response_code text DEFAULT NULL::text, new_response_message text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.pha_50058_submission_attempts%rowtype; t public.pha_50058_transactions%rowtype; event_name text;
begin
  if not private.is_internal_segment_user() then raise exception 'Internal workspace access required' using errcode = '42501'; end if;
 select * into a from public.pha_50058_submission_attempts where id=target_attempt_id; if not found then raise exception 'HUD-50058 submission attempt not found'; end if;
 select * into t from public.pha_50058_transactions where id=a.transaction_id; if not public.pha_program_access(t.user_id,t.program_code,true) then raise exception 'Not authorized to update this HUD-50058 submission'; end if;
 if new_status not in ('transmitted','accepted','rejected','corrected','cancelled') then raise exception 'Unsupported HUD-50058 submission status'; end if;
 if a.status in ('accepted','cancelled') then raise exception 'Final HUD-50058 submission state is immutable'; end if;
 if new_status in ('accepted','rejected') and a.status <> 'transmitted' then raise exception 'HUD-50058 response requires a transmitted submission'; end if;
 if new_status='transmitted' and coalesce(trim(external_reference),'')='' then raise exception 'External submission reference is required when recording transmission'; end if;
 event_name:=case new_status when 'transmitted' then 'transmitted' when 'accepted' then 'accepted' when 'rejected' then 'rejected' when 'corrected' then 'corrected' else 'cancelled' end;
 update public.pha_50058_submission_attempts set status=new_status,external_submission_reference=coalesce(external_reference,external_submission_reference),response_code=coalesce(new_response_code,response_code),response_message=coalesce(new_response_message,response_message),transmitted_at=case when new_status='transmitted' then coalesce(transmitted_at,now()) else transmitted_at end,responded_at=case when new_status in ('accepted','rejected') then now() else responded_at end where id=a.id;
 insert into public.pha_50058_submission_events(transaction_id,submission_attempt_id,event_type,event_snapshot) values(t.id,a.id,event_name,jsonb_build_object('status',new_status,'external_reference',external_reference,'response_code',new_response_code,'response_message',new_response_message));
 update public.pha_50058_transactions set submission_status=new_status,last_submission_at=case when new_status='transmitted' then now() else last_submission_at end,last_response_at=case when new_status in ('accepted','rejected') then now() else last_response_at end,updated_at=now() where id=t.id;
end; $function$;

CREATE OR REPLACE FUNCTION private.refresh_pha_nspire_release_counts(target_release_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare standard_count integer; deficiency_count integer;
begin
  if not private.is_internal_segment_user() then raise exception 'Internal workspace access required' using errcode = '42501'; end if;
  if not public.has_role(auth.uid(),'staff') then raise exception 'Staff authority required to refresh NSPIRE release counts'; end if;
  select count(distinct standard_name),count(*) into standard_count,deficiency_count
    from public.pha_nspire_deficiency_standards where release_id=target_release_id;
  update public.pha_nspire_standard_releases
     set imported_standard_count=standard_count, imported_deficiency_count=deficiency_count,
         import_completed_at=case when deficiency_count>0 then coalesce(import_completed_at,now()) else null end,
         updated_at=now()
   where id=target_release_id;
end; $function$;

CREATE OR REPLACE FUNCTION private.select_next_pha_waiting_list_applicant(target_waiting_list_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare list_row public.pha_waiting_lists%rowtype; overlay_row public.pha_notice_policy_overlays%rowtype; selected_row public.pha_waiting_list_applicants%rowtype; minimum_priority integer; candidates jsonb; candidate_total integer;
begin
  if not private.is_internal_segment_user() then raise exception 'Internal workspace access required' using errcode = '42501'; end if;
  select * into list_row from public.pha_waiting_lists where id=target_waiting_list_id;
  if not found then raise exception 'Waiting list not found'; end if;
  if not public.pha_program_access(list_row.workspace_user_id,list_row.program_code,true) then raise exception 'Not authorized to select from this waiting list'; end if;
  if list_row.status <> 'closed' then raise exception 'Waiting list must be closed before selection to preserve the candidate pool'; end if;
  select * into overlay_row from public.pha_notice_policy_overlays where id=list_row.policy_overlay_id and active=true and validated=true;
  if not found then raise exception 'Validated agency admission policy is required before selection'; end if;
  select min(preference_priority) into minimum_priority from public.pha_waiting_list_applicants where waiting_list_id=target_waiting_list_id and status='active' and preference_verified=true;
  if minimum_priority is null then raise exception 'No verified active applicants are available for selection'; end if;
  select count(*), jsonb_agg(jsonb_build_object('applicant_id',id,'application_received_at',application_received_at,'preference_priority',preference_priority) order by application_received_at,id)
    into candidate_total,candidates from public.pha_waiting_list_applicants where waiting_list_id=target_waiting_list_id and status='active' and preference_verified=true and preference_priority=minimum_priority;
  if list_row.selection_method='date_time' then
    select * into selected_row from public.pha_waiting_list_applicants where waiting_list_id=target_waiting_list_id and status='active' and preference_verified=true and preference_priority=minimum_priority order by application_received_at,id limit 1 for update;
  else
    select * into selected_row from public.pha_waiting_list_applicants where waiting_list_id=target_waiting_list_id and status='active' and preference_verified=true and preference_priority=minimum_priority order by random() limit 1 for update;
  end if;
  update public.pha_waiting_list_applicants set status='selected',updated_at=now() where id=selected_row.id;
  insert into public.pha_waiting_list_selection_events(waiting_list_id,applicant_id,selected_by,selection_method,preference_priority,candidate_count,candidate_snapshot,policy_snapshot)
  values(list_row.id,selected_row.id,auth.uid(),list_row.selection_method,minimum_priority,candidate_total,candidates,jsonb_build_object('policy_overlay_id',overlay_row.id,'policy_version',overlay_row.policy_version,'source_reference',overlay_row.source_reference,'program_code',list_row.program_code));
  return selected_row.id;
end;
$function$;

grant execute on function private.accept_pha_workspace_invitation(uuid) to authenticated;
grant execute on function private.activate_pha_nspire_standard_release(uuid) to authenticated;
grant execute on function private.attest_and_activate_pha_nspire_release(uuid,text) to authenticated;
grant execute on function private.build_pha_family_evidence_manifest(uuid) to authenticated;
grant execute on function private.current_pha_workspace_user_id() to authenticated;
grant execute on function private.is_pha_workspace_owner(uuid) to authenticated;
grant execute on function private.pha_family_access(uuid,boolean) to authenticated;
grant execute on function private.pha_program_access(uuid,text,boolean) to authenticated;
grant execute on function private.pha_workspace_admin_access(uuid) to authenticated;
grant execute on function private.prepare_pha_50058_submission(uuid,text) to authenticated;
grant execute on function private.record_pha_50058_submission_event(uuid,text,text,text,text) to authenticated;
grant execute on function private.refresh_pha_nspire_release_counts(uuid) to authenticated;
grant execute on function private.select_next_pha_waiting_list_applicant(uuid) to authenticated;
