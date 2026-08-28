-- HUD-50058 submission lifecycle and immutable history.
-- Transport is never assumed: API transmission is blocked unless staff configures a current transport profile.

alter table public.pha_50058_transactions
  add column if not exists routing_status text not null default 'UNCLASSIFIED' check (routing_status in ('UNCLASSIFIED','READY','BLOCKED','PRE_IMPLEMENTATION','NOT_APPLICABLE','AWAITING_HUD_GUIDANCE')),
  add column if not exists submission_status text not null default 'not_prepared' check (submission_status in ('not_prepared','ready_for_transport','transmitted','accepted','rejected','corrected','cancelled')),
  add column if not exists last_submission_at timestamptz,
  add column if not exists last_response_at timestamptz;

create table if not exists public.pha_50058_transport_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null references auth.users(id) on delete cascade,
  reporting_path text not null check (reporting_path in ('HUD_50058_2024','HUD_50058_2020_ALTERNATIVE')),
  transport_mode text not null check (transport_mode in ('manual_external','api')),
  endpoint_label text,
  credential_reference text,
  status text not null default 'pending' check (status in ('pending','validated','blocked')),
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_user_id, reporting_path)
);

create table if not exists public.pha_50058_submission_attempts (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.pha_50058_transactions(id) on delete cascade,
  workspace_user_id uuid not null references auth.users(id) on delete cascade,
  attempt_number integer not null,
  transport_mode text not null check (transport_mode in ('manual_external','api')),
  payload_snapshot jsonb not null,
  status text not null check (status in ('ready_for_transport','transmitted','accepted','rejected','corrected','cancelled')),
  external_submission_reference text,
  response_code text,
  response_message text,
  transmitted_at timestamptz,
  responded_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique(transaction_id, attempt_number)
);

create table if not exists public.pha_50058_submission_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.pha_50058_transactions(id) on delete cascade,
  submission_attempt_id uuid references public.pha_50058_submission_attempts(id) on delete set null,
  event_type text not null check (event_type in ('prepared','transmitted','accepted','rejected','correction_started','corrected','cancelled')),
  event_snapshot jsonb not null,
  actor_user_id uuid not null default auth.uid() references auth.users(id),
  occurred_at timestamptz not null default now()
);

alter table public.pha_50058_transport_profiles enable row level security;
alter table public.pha_50058_submission_attempts enable row level security;
alter table public.pha_50058_submission_events enable row level security;
grant select on public.pha_50058_transport_profiles to authenticated;
grant select,insert,update on public.pha_50058_submission_attempts to authenticated;
grant select on public.pha_50058_submission_events to authenticated;
grant all on public.pha_50058_transport_profiles, public.pha_50058_submission_attempts, public.pha_50058_submission_events to service_role;

create policy "PHA users read 50058 transport profile" on public.pha_50058_transport_profiles for select to authenticated using (workspace_user_id=public.current_pha_workspace_user_id() or public.has_role(auth.uid(),'staff'));
create policy "Staff manage 50058 transport profile" on public.pha_50058_transport_profiles for all to authenticated using (public.has_role(auth.uid(),'staff')) with check (public.has_role(auth.uid(),'staff'));
create policy "PHA users read 50058 submissions" on public.pha_50058_submission_attempts for select to authenticated using (exists(select 1 from public.pha_50058_transactions t where t.id=transaction_id and public.pha_program_access(t.user_id,t.program_code,false)));
create policy "PHA users write 50058 submissions" on public.pha_50058_submission_attempts for insert to authenticated with check (exists(select 1 from public.pha_50058_transactions t where t.id=transaction_id and public.pha_program_access(t.user_id,t.program_code,true)));
create policy "PHA users update 50058 submissions" on public.pha_50058_submission_attempts for update to authenticated using (exists(select 1 from public.pha_50058_transactions t where t.id=transaction_id and public.pha_program_access(t.user_id,t.program_code,true))) with check (exists(select 1 from public.pha_50058_transactions t where t.id=transaction_id and public.pha_program_access(t.user_id,t.program_code,true)));
create policy "PHA users read 50058 submission events" on public.pha_50058_submission_events for select to authenticated using (exists(select 1 from public.pha_50058_transactions t where t.id=transaction_id and public.pha_program_access(t.user_id,t.program_code,false)));

create or replace function public.prepare_pha_50058_submission(target_transaction_id uuid, requested_transport_mode text default 'manual_external')
returns uuid language plpgsql security definer set search_path=public as $$
declare t public.pha_50058_transactions%rowtype; p public.customer_workspace_profiles%rowtype; transport public.pha_50058_transport_profiles%rowtype; attempt_no integer; attempt_id uuid; payload jsonb;
begin
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
 payload:=jsonb_build_object('transaction_id',t.id,'family_reference',t.family_reference,'program_code',t.program_code,'transaction_type',t.transaction_type,'effective_date',t.effective_date,'reporting_path',p.hud_50058_reporting_path,'source_family_action_id',t.source_family_action_id,'prepared_at',now());
 insert into public.pha_50058_submission_attempts(transaction_id,workspace_user_id,attempt_number,transport_mode,payload_snapshot,status) values(t.id,t.user_id,attempt_no,requested_transport_mode,payload,'ready_for_transport') returning id into attempt_id;
 insert into public.pha_50058_submission_events(transaction_id,submission_attempt_id,event_type,event_snapshot) values(t.id,attempt_id,'prepared',payload);
 update public.pha_50058_transactions set submission_status='ready_for_transport',updated_at=now() where id=t.id;
 return attempt_id;
end; $$;
grant execute on function public.prepare_pha_50058_submission(uuid,text) to authenticated;

create or replace function public.record_pha_50058_submission_event(target_attempt_id uuid,new_status text,external_reference text default null,new_response_code text default null,new_response_message text default null)
returns void language plpgsql security definer set search_path=public as $$
declare a public.pha_50058_submission_attempts%rowtype; t public.pha_50058_transactions%rowtype; event_name text;
begin
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
end; $$;
grant execute on function public.record_pha_50058_submission_event(uuid,text,text,text,text) to authenticated;
