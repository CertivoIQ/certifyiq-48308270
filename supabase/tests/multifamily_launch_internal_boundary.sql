-- Rollback-only production authorization test; no customer records are changed.
do $test$
declare external_id uuid; internal_id uuid; target text; visible bigint; affected bigint;
begin
 select id into external_id from auth.users where email !~* '@certivoiq[.]com$' and email_confirmed_at is not null limit 1;
 select id into internal_id from auth.users where email ~* '^[^@[:space:]]+@certivoiq[.]com$' and email_confirmed_at is not null and not coalesce(is_anonymous,false) limit 1;
 if external_id is null or internal_id is null then raise exception 'Missing test identities'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',external_id,'role','authenticated','email','spoof@certivoiq.com')::text,true);
 execute 'set local role authenticated';
 if private.is_internal_segment_user() then raise exception 'Spoofed email authorized'; end if;
 foreach target in array ARRAY['pha_50058_submission_attempts','pha_50058_submission_events','pha_50058_transactions','pha_50058_transport_profiles','pha_agency_settings','pha_authoritative_control_state','pha_controlled_templates','pha_family_actions','pha_family_calculations','pha_family_eiv_exceptions','pha_family_evidence','pha_family_notices','pha_hcv_hap_contracts','pha_hcv_rfta_requests','pha_hcv_vouchers','pha_inspection_deficiencies','pha_inspection_transition_profiles','pha_inspections','pha_integration_profiles','pha_mod_rehab_contracts','pha_mod_rehab_hap_actions','pha_notice_policy_overlays','pha_notice_requirement_profiles','pha_nspire_deficiency_standards','pha_nspire_release_attestations','pha_nspire_source_artifacts','pha_nspire_standard_releases','pha_pbv_hap_contracts','pha_pbv_move_requests','pha_pbv_rent_actions','pha_pbv_waiting_list_applicants','pha_pbv_waiting_list_decisions','pha_pbv_waiting_lists','pha_portability_billing','pha_portability_cases','pha_public_housing_admission_year_controls','pha_public_housing_development_profiles','pha_public_housing_leases','pha_public_housing_non_public_leases','pha_public_housing_over_income_cases','pha_public_housing_over_income_notices','pha_public_housing_rent_elections','pha_public_housing_transfers','pha_public_housing_unit_offers','pha_reasonable_accommodation_requests','pha_source_library','pha_verification_requirement_matrix','pha_waiting_list_applicants','pha_waiting_list_preferences','pha_waiting_list_selection_events','pha_waiting_lists','pha_workspace_invitations','pha_workspace_memberships']
 loop
   execute format('select count(*) from public.%I',target) into visible;
   if visible<>0 then raise exception 'Customer can read %',target; end if;
 end loop;
 if public.current_pha_workspace_user_id() is not null then raise exception 'Customer RPC returned workspace'; end if;
 if public.pha_program_access(external_id,'hcv',true) then raise exception 'Customer program RPC allowed'; end if;
 if public.build_pha_family_evidence_manifest(gen_random_uuid()) is not null then raise exception 'Customer evidence RPC allowed'; end if;
 begin
   insert into public.pha_workspace_memberships(workspace_user_id,member_user_id,agency_role,active,created_by)
   values(external_id,external_id,'agency_admin',true,external_id);
   raise exception 'Customer membership insertion was allowed';
 exception when insufficient_privilege then null; end;
 update public.pha_nspire_deficiency_standards set standard_name=standard_name;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Customer updated internal standards'; end if;
 delete from public.pha_nspire_deficiency_standards;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Customer deleted internal standards'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',internal_id,'role','authenticated')::text,true);
 if not private.is_internal_segment_user() then raise exception 'Verified internal user denied'; end if;
 if public.current_pha_workspace_user_id() is null then raise exception 'Internal workspace RPC denied'; end if;
 select count(*) into visible from public.pha_nspire_deficiency_standards;
 if visible=0 then raise exception 'Internal reference standards denied or missing'; end if;
 execute 'reset role';
end $test$;
select 'PASS: external read blocked across 53 tables; spoofed JWT email denied; direct RPC and writes blocked; verified internal user retains access; transaction rolled back' as result;
rollback;
