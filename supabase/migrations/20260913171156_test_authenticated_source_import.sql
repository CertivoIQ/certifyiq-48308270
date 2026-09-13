-- Deployment SQL draft: register through the project's normal migration workflow.
-- No candidate is imported by installing this schema or staging a package.
begin;

create table private.state_source_import_batches (
  run_id text not null,
  pack_id uuid not null references public.state_rule_pack_candidates(id),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  expected_pack_updated_at timestamptz not null,
  expected_inventory_generated_at timestamptz not null,
  rows jsonb not null check (jsonb_typeof(rows) = 'array' and jsonb_array_length(rows) between 1 and 500),
  staged_at timestamptz not null default now(),
  staged_by text not null default current_user,
  primary key (run_id, pack_id)
);
create table private.state_source_import_receipts (
  run_id text not null,
  pack_id uuid not null,
  actor_id uuid not null references auth.users(id),
  manifest_sha256 text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (run_id, pack_id),
  foreign key (run_id, pack_id) references private.state_source_import_batches(run_id, pack_id)
);
alter table private.state_source_import_batches enable row level security;
alter table private.state_source_import_receipts enable row level security;
revoke all on private.state_source_import_batches, private.state_source_import_receipts
  from public, anon, authenticated, service_role;

create function private.reject_state_source_import_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Import packages and receipts are immutable; stage a new reconciliation run';
end;
$$;
revoke all on function private.reject_state_source_import_mutation() from public, anon, authenticated, service_role;
create trigger immutable_import_batches before update or delete on private.state_source_import_batches
for each row execute function private.reject_state_source_import_mutation();
create trigger immutable_import_receipts before update or delete on private.state_source_import_receipts
for each row execute function private.reject_state_source_import_mutation();
create trigger no_truncate_import_batches before truncate on private.state_source_import_batches
for each statement execute function private.reject_state_source_import_mutation();
create trigger no_truncate_import_receipts before truncate on private.state_source_import_receipts
for each statement execute function private.reject_state_source_import_mutation();

create function private.require_state_source_import_admin()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  perform 1 from public.crm_staff_access a
    where a.user_id = v_actor and a.status = 'active' and a.access_level = 'admin'
    for share;
  if not found then raise exception 'Active Administrator authority required'; end if;
  return v_actor;
end;
$$;
revoke all on function private.require_state_source_import_admin() from public, anon, authenticated, service_role;

create function private.state_source_import_queue()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_state_source_import_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'run_id', b.run_id, 'pack_id', b.pack_id, 'state_code', b.state_code,
      'manifest_sha256', b.manifest_sha256, 'source_records', jsonb_array_length(b.rows),
      'processed', r.run_id is not null, 'result', r.result,
      'snapshot_changed', p.updated_at is distinct from b.expected_pack_updated_at,
      'pack_protected', p.compliance_activation_allowed or p.status in ('verified', 'active', 'rejected'),
      'staged_at', b.staged_at
    ) order by b.run_id, b.state_code)
    from private.state_source_import_batches b
    join public.state_rule_pack_candidates p on p.id = b.pack_id
    left join private.state_source_import_receipts r using (run_id, pack_id)
  ), '[]'::jsonb);
end;
$$;

create function private.apply_state_source_import(p_run_id text, p_pack_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_state_source_import_admin();
  v_batch private.state_source_import_batches%rowtype;
  v_pack public.state_rule_pack_candidates%rowtype;
  v_source public.state_rule_source_candidates%rowtype;
  v_row jsonb;
  v_capture jsonb;
  v_metadata jsonb;
  v_evidence jsonb;
  v_result jsonb;
  v_outcomes jsonb := '[]'::jsonb;
  v_id uuid;
  v_action text;
  v_outcome text;
  v_created integer := 0;
  v_attached integer := 0;
  v_held integer := 0;
  v_preserved integer := 0;
  v_count integer;
  v_blocked integer;
begin
  select * into v_batch from private.state_source_import_batches
    where run_id = p_run_id and pack_id = p_pack_id for update;
  if not found then raise exception 'Trusted staged import package not found'; end if;
  select result into v_result from private.state_source_import_receipts
    where run_id = p_run_id and pack_id = p_pack_id;
  if found then return v_result; end if;

  select * into v_pack from public.state_rule_pack_candidates where id = p_pack_id for update;
  if not found then raise exception 'Pack not found'; end if;
  if v_pack.updated_at is distinct from v_batch.expected_pack_updated_at
    or v_pack.inventory_generated_at is distinct from v_batch.expected_inventory_generated_at
    or v_pack.state_code is distinct from v_batch.state_code
    or exists (select 1 from public.state_rule_pack_candidates p
      where p.state_code = v_pack.state_code and p.inventory_generated_at > v_pack.inventory_generated_at)
  then raise exception 'Pack snapshot changed; prepare a fresh reconciliation without overwriting reviewer work'; end if;
  if v_pack.compliance_activation_allowed or v_pack.status in ('verified', 'active', 'rejected') then
    raise exception 'Completed, active, or rejected packs are protected';
  end if;

  for v_row in select value from jsonb_array_elements(v_batch.rows)
  loop
    v_id := null;
    v_capture := v_row->'capture';
    v_metadata := v_row->'intake_metadata';
    v_action := v_row->>'action';
    v_outcome := 'HELD_MANUAL_REVIEW';
    if v_action = 'PRESERVE_REVIEWER_DECISION' then
      v_outcome := 'PRESERVED_REVIEWER_DECISION';
    elsif v_action not in (
      'ATTACH_CAPTURE_EVIDENCE_PENDING_AUTHENTICATED_REVIEW',
      'CREATE_CANDIDATE_PENDING_AUTHENTICATED_ADMIN'
    ) or v_action is null then
      v_outcome := 'HELD_UNRESOLVED';
    elsif (v_row->>'target_state') is distinct from v_batch.state_code
      or (v_row->>'pack_candidate_id') is distinct from p_pack_id::text
      or (v_row->>'scope') not in ('FEDERAL_SHARED','STATEWIDE','LOCAL_PHA','PROPERTY_SPECIFIC')
      or (v_row->>'scope') is null
      or ((v_row->>'scope' = 'FEDERAL_SHARED') is distinct from (v_batch.state_code = 'US'))
      or (v_row->>'proposed_activation_allowed') is distinct from 'false'
      or (v_row->>'independent_validation_complete') is distinct from 'false'
    then v_outcome := 'HELD_SCOPE_OR_FLAGS';
    elsif (v_capture->>'exact') is distinct from 'true'
      or (v_capture->>'custody_audit_pass') is distinct from 'true'
      or coalesce(v_capture->>'sha256', '') !~ '^[a-f0-9]{64}$'
      or coalesce(v_capture->>'byte_length', '') !~ '^[0-9]{1,8}$'
      or (v_capture->>'byte_length')::bigint not between 1 and 67108864
      or coalesce(v_capture->>'mime_type', '') = ''
      or coalesce(v_capture->>'magic_signature', '') !~ '^[a-fA-F0-9]{8,}$'
      or coalesce(v_capture->>'retrieval_time', '') = ''
      or (v_capture->>'source_url') is distinct from (v_row->>'source_url')
      or coalesce(v_row->>'source_url', '') !~ '^https://[^[:space:]]+$'
      or coalesce(v_capture->>'final_url', '') !~ '^https://[^[:space:]]+$'
      or coalesce(v_capture->>'storage_key', '') !~ '^validation/v1/(recrawls|triage)/'
      or coalesce(v_capture->>'evidence_key', '') !~ '^validation/v1/(recrawls|triage)/'
    then v_outcome := 'HELD_MISSING_CUSTODY_EVIDENCE';
    else
      -- Only the privileged, immutable staged package supplies evidence.
      -- Capture receipts are NOT independent source/rule validation.
      v_evidence := jsonb_build_object(
        'run_id', p_run_id, 'manifest_sha256', v_batch.manifest_sha256,
        'acquisition_source_id', v_row->>'acquisition_source_id',
        'prior_source_id', v_row->>'prior_source_id',
        'capture', v_capture, 'provenance_mapping', v_row->'provenance_mapping',
        'firecrawl_restricted', coalesce((v_row->>'firecrawl_restricted')::boolean, true),
        'independent_validation_complete', false, 'activation_allowed', false,
        'disposition', 'MANUAL_REVIEW_REQUIRED', 'imported_by', v_actor, 'imported_at', now()
      );
      if v_action = 'ATTACH_CAPTURE_EVIDENCE_PENDING_AUTHENTICATED_REVIEW' then
        select * into v_source from public.state_rule_source_candidates
          where id = (v_row->>'existing_source_id')::uuid for update;
        if not found then
          v_outcome := 'HELD_SOURCE_MISSING';
        elsif v_source.compliance_activation_allowed
          or v_source.agent_verification_status in ('verified', 'rejected') then
          v_outcome := 'PRESERVED_REVIEWER_DECISION';
        elsif v_source.updated_at is distinct from (v_row->>'expected_source_updated_at')::timestamptz
          or v_source.state_code is distinct from v_pack.state_code
          or v_source.inventory_generated_at is distinct from v_pack.inventory_generated_at
          or v_source.scope is distinct from (v_row->>'scope')
          or v_source.source_url is distinct from (v_row->>'source_url')
          or v_source.agent_verification_status is distinct from (v_row->>'existing_review_status')
        then v_outcome := 'HELD_SOURCE_CHANGED';
        elsif jsonb_typeof(v_source.verification_evidence) is distinct from 'object'
          or (v_source.verification_evidence ? 'acquisition_imports'
            and jsonb_typeof(v_source.verification_evidence->'acquisition_imports') is distinct from 'array')
        then v_outcome := 'HELD_EXISTING_EVIDENCE_SHAPE';
        else
          v_id := v_source.id;
          update public.state_rule_source_candidates
            set verification_evidence = jsonb_set(verification_evidence, '{acquisition_imports}',
                coalesce(verification_evidence->'acquisition_imports', '[]'::jsonb) || jsonb_build_array(v_evidence)),
                updated_at = now()
            where id = v_id;
          -- Existing review status, hash, retrieval time and activation flags stay untouched.
          v_outcome := 'CAPTURE_EVIDENCE_ATTACHED_UNVALIDATED';
        end if;
      else
        if (v_row->>'metadata_review_required') is distinct from 'false' then
          v_outcome := 'HELD_METADATA_REVIEW';
        elsif exists (select 1 from public.state_rule_source_candidates s
          where s.state_code = v_pack.state_code and s.inventory_generated_at = v_pack.inventory_generated_at
            and s.scope = v_row->>'scope' and s.source_url = v_row->>'source_url')
        then v_outcome := 'HELD_EXISTING_URL_SCOPE';
        else
          v_result := private.create_state_rule_source_candidate(
            v_pack.state_code, v_row->>'scope', v_metadata->>'authority_name',
            v_metadata->>'official_domain', v_metadata->>'program',
            v_metadata->>'source_type', v_row->>'source_url', 'MANUAL_REVIEW_REQUIRED'
          );
          v_id := (v_result->>'candidate_id')::uuid;
          update public.state_rule_source_candidates
          set verification_evidence = verification_evidence || jsonb_build_object(
                'acquisition_imports', jsonb_build_array(v_evidence),
                'firecrawl_restricted', coalesce((v_row->>'firecrawl_restricted')::boolean, true)),
              exact_bytes_captured = true, source_sha256 = v_capture->>'sha256',
              retrieved_at = (v_capture->>'retrieval_time')::timestamptz,
              agent_verification_status = case when upper(coalesce(v_capture->>'format', '')) in ('HTML','HTM')
                then 'blocked' else 'captured_unvalidated' end,
              candidate_status = 'MANUAL_REVIEW_REQUIRED',
              compliance_activation_allowed = false, updated_at = now()
          where id = v_id;
          v_outcome := 'CANDIDATE_CREATED_UNVALIDATED';
        end if;
      end if;
    end if;
    if v_outcome = 'CANDIDATE_CREATED_UNVALIDATED' then v_created := v_created + 1;
    elsif v_outcome = 'CAPTURE_EVIDENCE_ATTACHED_UNVALIDATED' then v_attached := v_attached + 1;
    elsif v_outcome = 'PRESERVED_REVIEWER_DECISION' then v_preserved := v_preserved + 1;
    else v_held := v_held + 1;
    end if;
    v_outcomes := v_outcomes || jsonb_build_array(jsonb_build_object(
      'acquisition_source_id', v_row->>'acquisition_source_id', 'candidate_id', v_id,
      'outcome', v_outcome));
  end loop;

  if v_created > 0 then
    select count(*)::integer, count(*) filter (
      where s.candidate_status like 'BLOCKED%' or s.agent_verification_status in ('blocked','rejected')
    )::integer into v_count, v_blocked
    from public.state_rule_source_candidates s
    where s.state_code = v_pack.state_code and s.inventory_generated_at = v_pack.inventory_generated_at;
    update public.state_rule_pack_candidates
    set source_candidate_count = v_count, blocked_source_count = v_blocked,
        candidate_manifest = coalesce(candidate_manifest, '{}'::jsonb) || jsonb_build_object('source_count', v_count),
        status = case when v_blocked > 0 then 'blocked' else 'agent_verification_in_progress' end,
        compliance_activation_allowed = false, updated_at = now()
    where id = p_pack_id;
  end if;
  v_result := jsonb_build_object(
    'run_id', p_run_id, 'state_code', v_pack.state_code, 'pack_id', p_pack_id,
    'created', v_created, 'attached', v_attached, 'held', v_held, 'preserved', v_preserved,
    'independent_validation_complete', false, 'activation_allowed', false, 'outcomes', v_outcomes);
  insert into private.state_source_import_receipts(run_id, pack_id, actor_id, manifest_sha256, result)
  values (p_run_id, p_pack_id, v_actor, v_batch.manifest_sha256, v_result);
  return v_result;
end;
$$;

create function public.state_source_import_queue()
returns jsonb language sql security invoker set search_path = ''
as $$ select private.state_source_import_queue(); $$;
create function public.apply_state_source_import(p_run_id text, p_pack_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.apply_state_source_import(p_run_id, p_pack_id); $$;

revoke all on function private.state_source_import_queue(),
 private.apply_state_source_import(text,uuid),
 public.state_source_import_queue(), public.apply_state_source_import(text,uuid)
 from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.state_source_import_queue(),
 private.apply_state_source_import(text,uuid),
 public.state_source_import_queue(), public.apply_state_source_import(text,uuid)
 to authenticated;
comment on table private.state_source_import_batches is
 'Privileged offline staging only. No client payload uploads. Custody audit is not independent validation.';
notify pgrst, 'reload schema';
commit;
