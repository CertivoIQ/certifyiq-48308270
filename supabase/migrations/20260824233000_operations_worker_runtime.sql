-- Batch 2: atomic worker leasing, health checks, bounded retry, and staff action RPCs.

create or replace function public.operations_claim_job(
  _worker text,
  _lease_seconds integer default 120
) returns public.operations_jobs
language plpgsql security definer set search_path = public as $$
declare claimed public.operations_jobs;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service role required';
  end if;
  if nullif(trim(_worker),'') is null then raise exception 'worker required'; end if;
  if _lease_seconds < 30 or _lease_seconds > 900 then raise exception 'invalid lease duration'; end if;

  select * into claimed
  from public.operations_jobs
  where status in ('queued','retry_wait')
    and scheduled_at <= now()
    and (lease_expires_at is null or lease_expires_at <= now())
  order by risk_tier, scheduled_at, created_at
  for update skip locked
  limit 1;

  if claimed.id is null then return null; end if;

  update public.operations_jobs
  set status='running', lease_owner=trim(_worker),
      lease_expires_at=now()+make_interval(secs=>_lease_seconds),
      heartbeat_at=now(), started_at=coalesce(started_at,now()),
      attempts=attempts+1, updated_at=now()
  where id=claimed.id returning * into claimed;

  insert into public.operations_audit_events(actor_kind,action,target_type,target_id,correlation_id,detail)
  values ('worker','job.claimed','operations_job',claimed.id::text,claimed.correlation_id,
    jsonb_build_object('worker',_worker,'attempt',claimed.attempts,'lease_seconds',_lease_seconds));
  return claimed;
end;
$$;
revoke all on function public.operations_claim_job(text,integer) from public;
grant execute on function public.operations_claim_job(text,integer) to service_role;

create or replace function public.operations_heartbeat(
  _job_id uuid, _worker text, _lease_seconds integer default 120
) returns boolean
language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  if current_user not in ('postgres','service_role') then raise exception 'service role required'; end if;
  update public.operations_jobs
  set heartbeat_at=now(), lease_expires_at=now()+make_interval(secs=>_lease_seconds), updated_at=now()
  where id=_job_id and status='running' and lease_owner=_worker and lease_expires_at>now();
  get diagnostics changed=row_count;
  return changed=1;
end;
$$;
revoke all on function public.operations_heartbeat(uuid,text,integer) from public;
grant execute on function public.operations_heartbeat(uuid,text,integer) to service_role;

create or replace function public.operations_complete_job(
  _job_id uuid, _worker text, _result jsonb default '{}'::jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare job public.operations_jobs;
begin
  if current_user not in ('postgres','service_role') then raise exception 'service role required'; end if;
  select * into job from public.operations_jobs where id=_job_id for update;
  if job.status<>'running' or job.lease_owner<>_worker or job.lease_expires_at<=now() then return false; end if;
  if job.risk_tier='tier_4_human_approval' and not exists (
    select 1 from public.operations_approvals a
    where a.job_id=job.id and a.status='approved' and a.expires_at>now()
      and a.decided_by is distinct from a.requested_by
  ) then raise exception 'valid separate Tier 4 approval required'; end if;
  update public.operations_jobs set status='completed',result=_result,completed_at=now(),
    lease_owner=null,lease_expires_at=null,heartbeat_at=now(),updated_at=now() where id=_job_id;
  insert into public.operations_audit_events(actor_kind,action,target_type,target_id,correlation_id,detail)
  values ('worker','job.completed','operations_job',job.id::text,job.correlation_id,jsonb_build_object('worker',_worker));
  return true;
end;
$$;
revoke all on function public.operations_complete_job(uuid,text,jsonb) from public;
grant execute on function public.operations_complete_job(uuid,text,jsonb) to service_role;

create or replace function public.operations_fail_job(
  _job_id uuid, _worker text, _error jsonb
) returns public.operations_jobs
language plpgsql security definer set search_path = public as $$
declare job public.operations_jobs; delay_seconds integer;
begin
  if current_user not in ('postgres','service_role') then raise exception 'service role required'; end if;
  select * into job from public.operations_jobs where id=_job_id for update;
  if job.status<>'running' or job.lease_owner<>_worker then raise exception 'worker does not own job lease'; end if;

  if job.attempts>=job.max_attempts then
    update public.operations_jobs set status='quarantined',last_error=_error,
      lease_owner=null,lease_expires_at=null,updated_at=now() where id=job.id returning * into job;
    insert into public.operations_incidents(severity,status,job_id,correlation_id,summary,detail,retry_count)
    values ('high','open',job.id,job.correlation_id,'Job quarantined after retry cap',_error,job.attempts)
    on conflict do nothing;
  else
    delay_seconds=least(300, power(2,greatest(0,job.attempts-1))::integer);
    update public.operations_jobs set status='retry_wait',last_error=_error,
      scheduled_at=now()+make_interval(secs=>delay_seconds),lease_owner=null,
      lease_expires_at=null,updated_at=now() where id=job.id returning * into job;
  end if;

  insert into public.operations_audit_events(actor_kind,action,target_type,target_id,correlation_id,severity,detail)
  values ('worker',case when job.status='quarantined' then 'job.quarantined' else 'job.retry_scheduled' end,
    'operations_job',job.id::text,job.correlation_id,'error',jsonb_build_object('worker',_worker,'error',_error));
  return job;
end;
$$;
revoke all on function public.operations_fail_job(uuid,text,jsonb) from public;
grant execute on function public.operations_fail_job(uuid,text,jsonb) to service_role;

create or replace function public.operations_reap_stale_leases()
returns integer language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  if current_user not in ('postgres','service_role') then raise exception 'service role required'; end if;
  update public.operations_jobs set status='retry_wait',scheduled_at=now(),lease_owner=null,
    lease_expires_at=null,last_error=jsonb_build_object('code','STALE_LEASE','message','Worker heartbeat expired'),
    updated_at=now()
  where status='running' and lease_expires_at<=now();
  get diagnostics changed=row_count;
  return changed;
end;
$$;
revoke all on function public.operations_reap_stale_leases() from public;
grant execute on function public.operations_reap_stale_leases() to service_role;

create or replace view public.operations_health as
select
  count(*) filter (where status='running' and heartbeat_at>now()-interval '5 minutes') as healthy_running,
  count(*) filter (where status='running' and (heartbeat_at is null or heartbeat_at<=now()-interval '5 minutes')) as stale_running,
  count(*) filter (where status='awaiting_approval') as awaiting_approval,
  count(*) filter (where status='quarantined') as quarantined,
  min(scheduled_at) filter (where status in ('queued','retry_wait')) as oldest_ready_job,
  now() as checked_at
from public.operations_jobs;
grant select on public.operations_health to authenticated, service_role;

comment on function public.operations_claim_job(text,integer) is 'Atomically leases one ready operations job using SKIP LOCKED.';
comment on function public.operations_reap_stale_leases() is 'Returns expired worker leases to bounded retry processing.';
