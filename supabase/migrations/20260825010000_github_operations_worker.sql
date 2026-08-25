-- GitHub-hosted operations worker entrypoint for Lovable Cloud static deployments.
-- Authenticates a dedicated worker secret before invoking Batch 2 RPCs.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.operations_runtime_secrets (
  name text primary key,
  secret_sha256 text not null check (secret_sha256 ~ '^[0-9a-f]{64}$'),
  rotated_at timestamptz not null default now()
);

revoke all on public.operations_runtime_secrets from public, anon, authenticated;
grant all on public.operations_runtime_secrets to service_role;

create or replace function public.operations_github_tick(_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  expected_hash text;
  supplied_hash text;
  reaped integer;
  job public.operations_jobs;
  completed boolean;
begin
  if nullif(_secret, '') is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select secret_sha256 into expected_hash
  from public.operations_runtime_secrets
  where name = 'github_operations_worker';

  supplied_hash := encode(extensions.digest(convert_to(_secret, 'UTF8'), 'sha256'), 'hex');
  if expected_hash is null or expected_hash <> supplied_hash then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  reaped := public.operations_reap_stale_leases();
  job := public.operations_claim_job('github-actions-control-plane', 120);

  if job.id is null then
    return jsonb_build_object('ok', true, 'reaped', coalesce(reaped, 0), 'claimed', false);
  end if;

  if job.job_type <> 'operations_health_check' then
    perform public.operations_fail_job(
      job.id,
      'github-actions-control-plane',
      jsonb_build_object(
        'code', 'HANDLER_NOT_ACTIVE',
        'message', 'No approved Batch 2 handler for ' || job.job_type
      )
    );
    return jsonb_build_object(
      'ok', true, 'reaped', coalesce(reaped, 0), 'claimed', true,
      'jobId', job.id, 'status', 'retry_or_quarantine'
    );
  end if;

  completed := public.operations_complete_job(
    job.id,
    'github-actions-control-plane',
    jsonb_build_object('checkedAt', now(), 'status', 'healthy')
  );

  return jsonb_build_object(
    'ok', completed, 'reaped', coalesce(reaped, 0), 'claimed', true,
    'jobId', job.id, 'status', case when completed then 'completed' else 'lease_lost' end
  );
exception
  when sqlstate '28000' then
    raise;
  when others then
    if job.id is not null then
      begin
        perform public.operations_fail_job(
          job.id,
          'github-actions-control-plane',
          jsonb_build_object('code', 'WORKER_FAILURE', 'message', sqlerrm)
        );
      exception when others then null;
      end;
    end if;
    raise;
end;
$$;

revoke all on function public.operations_github_tick(text) from public;
grant execute on function public.operations_github_tick(text) to anon, service_role;

comment on function public.operations_github_tick(text) is
  'Secret-authenticated GitHub Actions entrypoint. Batch 2 activates health jobs only.';
