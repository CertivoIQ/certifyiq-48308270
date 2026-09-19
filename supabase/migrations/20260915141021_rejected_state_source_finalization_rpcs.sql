create table if not exists public.state_rule_source_rejection_audit (
  id uuid primary key default gen_random_uuid(),
  source_candidate_id uuid not null,
  action text not null check (action in ('returned_to_validation','finalized_delete')),
  actor_id uuid not null,
  actor_email text,
  reason text not null check (char_length(reason) between 10 and 4000),
  state_code text not null,
  authority_name text not null,
  source_type text not null,
  source_url text not null,
  prior_updated_at timestamptz not null,
  candidate_snapshot jsonb not null,
  related_evidence jsonb not null default '{}'::jsonb,
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists state_rule_source_rejection_audit_candidate_created_idx
  on public.state_rule_source_rejection_audit(source_candidate_id, created_at desc);
create index if not exists state_rule_source_rejection_audit_state_created_idx
  on public.state_rule_source_rejection_audit(state_code, created_at desc);
create unique index if not exists state_rule_source_rejection_audit_finalized_once_idx
  on public.state_rule_source_rejection_audit(source_candidate_id)
  where action = 'finalized_delete';

alter table public.state_rule_source_rejection_audit enable row level security;
revoke all on table public.state_rule_source_rejection_audit from public, anon, authenticated;

create or replace function private.return_state_rule_source_to_validation(
  p_candidate_id uuid,
  p_expected_updated_at timestamptz,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_actor_email text;
  v_candidate public.state_rule_source_candidates%rowtype;
  v_notes text := trim(coalesce(p_notes, ''));
  v_snapshot jsonb;
  v_digest text;
  v_refresh jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.crm_staff_access access
    where access.user_id = v_user_id
      and access.status = 'active'
      and access.access_level in ('manager','admin')
  ) then
    raise exception 'Active Manager or Administrator authority required';
  end if;

  if char_length(v_notes) < 10 or char_length(v_notes) > 4000 then
    raise exception 'Return notes must contain 10 to 4000 characters';
  end if;

  select *
  into v_candidate
  from public.state_rule_source_candidates source
  where source.id = p_candidate_id
  for update;

  if not found then
    raise exception 'Rejected state source record not found';
  end if;

  if v_candidate.updated_at is distinct from p_expected_updated_at then
    raise exception 'This source record changed after the page loaded. Refresh and review it again before continuing';
  end if;

  if v_candidate.agent_verification_status <> 'rejected'
     or v_candidate.candidate_status = 'EXCLUDED_REDUNDANT_SOURCE' then
    raise exception 'Only reviewer-rejected source records can be returned to validation';
  end if;

  select lower(trim(user_account.email))
  into v_actor_email
  from auth.users user_account
  where user_account.id = v_user_id;

  v_snapshot := to_jsonb(v_candidate);
  v_digest := encode(
    extensions.digest(
      (v_snapshot || jsonb_build_object('action','returned_to_validation','reason',v_notes))::text,
      'sha256'::text
    ),
    'hex'
  );

  update public.state_rule_source_candidates source
  set agent_verification_status = 'queued_for_agent_verification',
      compliance_activation_allowed = false,
      verification_evidence = coalesce(source.verification_evidence, '{}'::jsonb)
        || jsonb_build_object(
          'returned_from_rejection_at', now(),
          'returned_from_rejection_by', v_user_id,
          'returned_from_rejection_reason', v_notes
        ),
      updated_at = now()
  where source.id = v_candidate.id;

  insert into public.state_rule_source_rejection_audit(
    source_candidate_id, action, actor_id, actor_email, reason,
    state_code, authority_name, source_type, source_url, prior_updated_at,
    candidate_snapshot, related_evidence, snapshot_sha256
  ) values (
    v_candidate.id, 'returned_to_validation', v_user_id, v_actor_email, v_notes,
    v_candidate.state_code, v_candidate.authority_name, v_candidate.source_type,
    v_candidate.source_url, v_candidate.updated_at, v_snapshot,
    jsonb_build_object('preserved_in_place', true), v_digest
  );

  v_refresh := public.refresh_state_rule_pack_activation(
    v_candidate.state_code,
    v_candidate.inventory_generated_at
  );

  return jsonb_build_object(
    'candidate_id', v_candidate.id,
    'source_status', 'queued_for_agent_verification',
    'pack_status', v_refresh ->> 'pack_status',
    'returned_to_validation', true
  );
end;
$function$;

create or replace function private.finalize_state_rule_source_rejection(
  p_candidate_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_actor_email text;
  v_candidate public.state_rule_source_candidates%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
  v_snapshot jsonb;
  v_related jsonb;
  v_digest text;
  v_source_count integer;
  v_latest_federal_inventory timestamptz;
  v_pack record;
  v_refresh jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.crm_staff_access access
    where access.user_id = v_user_id
      and access.status = 'active'
      and access.access_level = 'admin'
  ) then
    raise exception 'Active Administrator authority required for permanent rejected-source finalization';
  end if;

  if char_length(v_reason) < 10 or char_length(v_reason) > 4000 then
    raise exception 'Finalization reason must contain 10 to 4000 characters';
  end if;

  select *
  into v_candidate
  from public.state_rule_source_candidates source
  where source.id = p_candidate_id
  for update;

  if not found then
    raise exception 'Rejected state source record not found';
  end if;

  if v_candidate.updated_at is distinct from p_expected_updated_at then
    raise exception 'This source record changed after the page loaded. Refresh and review it again before continuing';
  end if;

  if v_candidate.agent_verification_status <> 'rejected'
     or v_candidate.candidate_status = 'EXCLUDED_REDUNDANT_SOURCE' then
    raise exception 'Only reviewer-rejected source records can be permanently finalized';
  end if;

  if exists (
       select 1 from public.state_rule_deterministic_rules rule
       where rule.source_candidate_id = v_candidate.id
     )
     or exists (
       select 1 from public.merlin_procedures procedure
       where procedure.source_candidate_id = v_candidate.id
     )
     or exists (
       select 1 from public.merlin_procedure_documents document
       where document.source_candidate_id = v_candidate.id
         and (
           coalesce(document.usable_for_compliance_determination, false)
           or lower(coalesce(document.status, '')) = 'validated'
         )
     ) then
    raise exception 'Finalization blocked because this rejected source is still linked to a production rule or validated procedure artifact. Supersede or detach that production artifact through its controlled workflow first';
  end if;

  select lower(trim(user_account.email))
  into v_actor_email
  from auth.users user_account
  where user_account.id = v_user_id;

  v_snapshot := to_jsonb(v_candidate);

  v_related := jsonb_build_object(
    'creation_events', coalesce((
      select jsonb_agg(to_jsonb(event) order by event.created_at, event.id)
      from public.state_rule_source_creation_events event
      where event.source_candidate_id = v_candidate.id
    ), '[]'::jsonb),
    'verification_events', coalesce((
      select jsonb_agg(to_jsonb(event) order by event.created_at, event.id)
      from public.state_rule_source_verification_events event
      where event.source_candidate_id = v_candidate.id
    ), '[]'::jsonb),
    'extraction_assessments', coalesce((
      select jsonb_agg(to_jsonb(assessment) order by assessment.created_at, assessment.id)
      from public.state_rule_source_extraction_assessments assessment
      where assessment.source_candidate_id = v_candidate.id
    ), '[]'::jsonb),
    'nonproduction_procedure_documents', coalesce((
      select jsonb_agg(to_jsonb(document) order by document.created_at, document.id)
      from public.merlin_procedure_documents document
      where document.source_candidate_id = v_candidate.id
    ), '[]'::jsonb),
    'storage_objects_deleted', false,
    'production_rules_deleted', false,
    'production_procedures_deleted', false
  );

  v_digest := encode(
    extensions.digest(
      (v_snapshot || jsonb_build_object('related_evidence',v_related,'action','finalized_delete','reason',v_reason))::text,
      'sha256'::text
    ),
    'hex'
  );

  insert into public.state_rule_source_rejection_audit(
    source_candidate_id, action, actor_id, actor_email, reason,
    state_code, authority_name, source_type, source_url, prior_updated_at,
    candidate_snapshot, related_evidence, snapshot_sha256
  ) values (
    v_candidate.id, 'finalized_delete', v_user_id, v_actor_email, v_reason,
    v_candidate.state_code, v_candidate.authority_name, v_candidate.source_type,
    v_candidate.source_url, v_candidate.updated_at, v_snapshot, v_related, v_digest
  );

  delete from public.state_rule_source_creation_events event
  where event.source_candidate_id = v_candidate.id;

  delete from public.state_rule_source_verification_events event
  where event.source_candidate_id = v_candidate.id;

  delete from public.state_rule_source_extraction_assessments assessment
  where assessment.source_candidate_id = v_candidate.id;

  delete from public.merlin_procedure_documents document
  where document.source_candidate_id = v_candidate.id;

  delete from public.state_rule_source_candidates source
  where source.id = v_candidate.id;

  select count(*)::integer
  into v_source_count
  from public.state_rule_source_candidates source
  where source.state_code = v_candidate.state_code
    and source.inventory_generated_at = v_candidate.inventory_generated_at;

  update public.state_rule_pack_candidates pack
  set source_candidate_count = v_source_count,
      candidate_manifest = coalesce(pack.candidate_manifest, '{}'::jsonb)
        || jsonb_build_object('source_count', v_source_count),
      updated_at = now()
  where pack.state_code = v_candidate.state_code
    and pack.inventory_generated_at = v_candidate.inventory_generated_at;

  if v_candidate.state_code = 'US' then
    select max(pack.inventory_generated_at)
    into v_latest_federal_inventory
    from public.state_rule_pack_candidates pack
    where pack.state_code = 'US';

    if v_candidate.inventory_generated_at = v_latest_federal_inventory then
      for v_pack in
        select pack.state_code, pack.inventory_generated_at
        from public.state_rule_pack_candidates pack
      loop
        v_refresh := public.refresh_state_rule_pack_activation(
          v_pack.state_code,
          v_pack.inventory_generated_at
        );
      end loop;
    else
      v_refresh := public.refresh_state_rule_pack_activation(
        v_candidate.state_code,
        v_candidate.inventory_generated_at
      );
    end if;
  else
    v_refresh := public.refresh_state_rule_pack_activation(
      v_candidate.state_code,
      v_candidate.inventory_generated_at
    );
  end if;

  return jsonb_build_object(
    'candidate_id', v_candidate.id,
    'finalized_delete', true,
    'state_code', v_candidate.state_code,
    'source_candidate_count', v_source_count,
    'audit_sha256', v_digest,
    'pack_status', v_refresh ->> 'pack_status'
  );
end;
$function$;

create or replace function public.return_state_rule_source_to_validation(
  p_candidate_id uuid,
  p_expected_updated_at timestamptz,
  p_notes text
)
returns jsonb
language sql
set search_path = ''
as $function$
  select private.return_state_rule_source_to_validation(
    p_candidate_id, p_expected_updated_at, p_notes
  );
$function$;

create or replace function public.finalize_state_rule_source_rejection(
  p_candidate_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
)
returns jsonb
language sql
set search_path = ''
as $function$
  select private.finalize_state_rule_source_rejection(
    p_candidate_id, p_expected_updated_at, p_reason
  );
$function$;

revoke all on function private.return_state_rule_source_to_validation(uuid,timestamptz,text) from public, anon;
revoke all on function private.finalize_state_rule_source_rejection(uuid,timestamptz,text) from public, anon;
grant execute on function private.return_state_rule_source_to_validation(uuid,timestamptz,text) to authenticated, service_role;
grant execute on function private.finalize_state_rule_source_rejection(uuid,timestamptz,text) to authenticated, service_role;

revoke all on function public.return_state_rule_source_to_validation(uuid,timestamptz,text) from public, anon;
revoke all on function public.finalize_state_rule_source_rejection(uuid,timestamptz,text) from public, anon;
grant execute on function public.return_state_rule_source_to_validation(uuid,timestamptz,text) to authenticated, service_role;
grant execute on function public.finalize_state_rule_source_rejection(uuid,timestamptz,text) to authenticated, service_role;

comment on table public.state_rule_source_rejection_audit is
  'Append-only internal audit snapshots for rejected state-source return and irreversible finalization actions.';
comment on function public.return_state_rule_source_to_validation(uuid,timestamptz,text) is
  'Returns a reviewer-rejected state source to queued validation with optimistic concurrency and an audit snapshot.';
comment on function public.finalize_state_rule_source_rejection(uuid,timestamptz,text) is
  'Permanently removes an eligible rejected source record after preserving its evidence metadata in an audit snapshot. Active production rules/procedures block finalization.';

notify pgrst, 'reload schema';