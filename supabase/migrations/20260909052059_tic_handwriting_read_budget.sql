create table if not exists public.tic_handwriting_reads (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null references public.certification_import_jobs(id) on delete cascade,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 page_number integer not null check(page_number between 1 and 200),
 image_sha256 text not null check(image_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
alter table public.tic_handwriting_reads enable row level security;
revoke all on public.tic_handwriting_reads from public, anon, authenticated;
grant select,insert on public.tic_handwriting_reads to service_role;
create index if not exists tic_handwriting_reads_user_created on public.tic_handwriting_reads(user_id,created_at);
create index if not exists tic_handwriting_reads_job on public.tic_handwriting_reads(job_id);
create or replace function public.reserve_tic_handwriting_read(_user_id uuid,_job_id uuid,_source_sha256 text,_page_number integer,_image_sha256 text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare _id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('tic-handwriting:'||_user_id::text,0));
 if not exists(select 1 from public.certification_import_jobs where id=_job_id and user_id=_user_id) then raise exception 'SOURCE_ACCESS_DENIED';end if;
 if (select count(*) from public.tic_handwriting_reads where user_id=_user_id and created_at>now()-interval '24 hours')>=100 then raise exception 'HANDWRITING_DAILY_LIMIT';end if;
 if (select count(*) from public.tic_handwriting_reads where user_id=_user_id and created_at>now()-interval '1 minute')>=8 then raise exception 'HANDWRITING_MINUTE_LIMIT';end if;
 insert into public.tic_handwriting_reads(user_id,job_id,source_sha256,page_number,image_sha256) values(_user_id,_job_id,_source_sha256,_page_number,_image_sha256) returning id into _id;
 return _id;
end $$;
revoke all on function public.reserve_tic_handwriting_read(uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.reserve_tic_handwriting_read(uuid,uuid,text,integer,text) to service_role;
