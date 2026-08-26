create or replace function public.operations_stage_source_version_v1(
  worker_secret text,
  source_url text,
  authority_name text,
  program_code text default null,
  jurisdiction_code text default null,
  source_effective_date date default null,
  source_retrieved_at timestamptz default now(),
  source_sha256 text default null,
  source_evidence_manifest jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  expected_hash text;
  supplied_hash text;
  existing_id uuid;
  inserted_id uuid;
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

  if source_url !~ '^https://[^[:space:]]+$' then
    raise exception 'official HTTPS source URL required';
  end if;
  if nullif(btrim(authority_name), '') is null then
    raise exception 'authority required';
  end if;
  if source_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'lowercase SHA-256 required';
  end if;
  if source_retrieved_at > now() + interval '5 minutes' then
    raise exception 'retrieved_at cannot be in the future';
  end if;

  select id into existing_id
  from public.operations_source_versions
  where official_url = source_url
    and sha256 = source_sha256
    and authority = authority_name
    and coalesce(program, '') = coalesce(program_code, '')
    and coalesce(jurisdiction, '') = coalesce(jurisdiction_code, '')
  order by retrieved_at desc
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.operations_source_versions(
    official_url,
    authority,
    program,
    jurisdiction,
    effective_date,
    retrieved_at,
    sha256,
    parsing_status,
    validation_status,
    evidence_manifest
  ) values (
    source_url,
    authority_name,
    nullif(program_code, ''),
    nullif(jurisdiction_code, ''),
    source_effective_date,
    source_retrieved_at,
    source_sha256,
    'pending',
    'pending',
    coalesce(source_evidence_manifest, '{}'::jsonb)
  ) returning id into inserted_id;

  return inserted_id;
end;
$function$;

revoke all on function public.operations_stage_source_version_v1(text,text,text,text,text,date,timestamptz,text,jsonb) from public;
grant execute on function public.operations_stage_source_version_v1(text,text,text,text,text,date,timestamptz,text,jsonb) to anon, authenticated, service_role;
