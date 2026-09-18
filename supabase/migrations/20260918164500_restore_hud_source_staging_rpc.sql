-- Restore the controlled HUD USER source-staging RPC as a forward-only production migration.
-- Historical migration 20260825060000_hud_source_pipeline.sql was not present in the
-- production migration history. This function stages validated source evidence only;
-- it cannot activate compliance rules or send communications.

create or replace function public.operations_stage_hud_source_v1(
  worker_secret text,
  source_url text,
  final_url text,
  source_sha256 text,
  retrieved_at timestamptz,
  content_type text,
  content_length bigint,
  parser_build text,
  dataset_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  expected_hash text;
  supplied_hash text;
  source_id uuid;
  inserted boolean := false;
  correlation uuid := gen_random_uuid();
  row_count integer;
begin
  if nullif(worker_secret, '') is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select secret_sha256 into expected_hash
  from public.operations_runtime_secrets
  where name = 'github_operations_worker';

  supplied_hash := encode(extensions.digest(convert_to(worker_secret, 'UTF8'), 'sha256'), 'hex');
  if expected_hash is null or expected_hash <> supplied_hash then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  if source_url !~ '^https://(www\.)?huduser\.gov/'
     or final_url !~ '^https://(www\.)?huduser\.gov/' then
    raise exception 'official HUD USER HTTPS source required';
  end if;
  if source_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid source sha256'; end if;
  if content_length <= 0 or content_length > 5242880 then raise exception 'invalid content length'; end if;
  if content_type <> 'text/html' then raise exception 'invalid content type'; end if;
  if parser_build !~ '^hud-source-pipeline-' then raise exception 'uncontrolled parser build'; end if;
  if jsonb_typeof(dataset_rows) <> 'array' then raise exception 'dataset rows must be an array'; end if;

  row_count := jsonb_array_length(dataset_rows);
  if row_count < 20 then raise exception 'tracked dataset rows incomplete'; end if;

  if exists (
    select 1 from jsonb_array_elements(dataset_rows) row
    where nullif(row->>'dataset_id','') is null
       or nullif(row->>'dataset_name','') is null
       or not (row ? 'most_recent_release')
       or not (row ? 'expected_next_update')
  ) then
    raise exception 'invalid dataset row';
  end if;

  select id into source_id
  from public.operations_source_versions
  where official_url = source_url
    and sha256 = source_sha256
    and authority = 'HUD USER'
    and coalesce(program,'') = 'Dataset Update Schedule'
  order by retrieved_at desc
  limit 1;

  if source_id is null then
    insert into public.operations_source_versions(
      official_url, authority, program, retrieved_at, sha256,
      parsing_status, validation_status, evidence_manifest
    ) values (
      source_url, 'HUD USER', 'Dataset Update Schedule', retrieved_at, source_sha256,
      'parsed', 'validated',
      jsonb_build_object(
        'final_url', final_url,
        'content_type', content_type,
        'content_length', content_length,
        'parser_build', parser_build,
        'dataset_rows', dataset_rows,
        'validation_scope', 'SOURCE_IDENTITY_AND_SCHEDULE_STRUCTURE_ONLY',
        'compliance_activation_allowed', false,
        'communication_allowed', false
      )
    )
    returning id into source_id;
    inserted := true;
  end if;

  insert into public.operations_audit_events(
    actor_kind, action, target_type, target_id, after_sha256,
    evidence_refs, source_refs, correlation_id, detail
  ) values (
    'worker',
    case when inserted then 'source.staged' else 'source.unchanged' end,
    'operations_source_version',
    source_id::text,
    source_sha256,
    jsonb_build_array(jsonb_build_object('source_version_id', source_id)),
    jsonb_build_array(source_url),
    correlation,
    jsonb_build_object(
      'parser_build', parser_build,
      'tracked_dataset_count', row_count,
      'compliance_activation_allowed', false,
      'communication_allowed', false
    )
  );

  return jsonb_build_object(
    'ok', true,
    'staged', inserted,
    'sourceVersionId', source_id,
    'sha256', source_sha256,
    'trackedDatasetCount', row_count,
    'complianceActivationAllowed', false,
    'communicationAllowed', false
  );
end;
$function$;

revoke all on function public.operations_stage_hud_source_v1(
  text,text,text,text,timestamptz,text,bigint,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.operations_stage_hud_source_v1(
  text,text,text,text,timestamptz,text,bigint,text,jsonb
) to anon, service_role;

comment on function public.operations_stage_hud_source_v1(
  text,text,text,text,timestamptz,text,bigint,text,jsonb
) is 'Secret-authenticated staging of validated HUD USER schedule evidence only. Cannot activate compliance rules or communications.';

notify pgrst, 'reload schema';
