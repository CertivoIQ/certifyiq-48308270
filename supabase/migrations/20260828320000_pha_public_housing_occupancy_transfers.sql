-- Public Housing occupancy and transfer controls under 24 CFR 966.4 and validated ACOP policy.

create table if not exists public.pha_public_housing_leases (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  family_action_id uuid not null references public.pha_family_actions(id) on delete cascade,
  unit_offer_id uuid references public.pha_public_housing_unit_offers(id),
  acop_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
  unit_reference text not null,
  lease_start date not null,
  lease_end date,
  required_lease_provisions_confirmed boolean not null default false,
  grievance_procedure_included boolean not null default false,
  signature_complete boolean not null default false,
  status text not null default 'draft' check (status in ('draft','ready','executed','ended','blocked')),
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_user_id,family_action_id,unit_reference,lease_start)
);

create table if not exists public.pha_public_housing_transfers (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  lease_id uuid not null references public.pha_public_housing_leases(id) on delete cascade,
  acop_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
  transfer_reason text not null check (transfer_reason in ('family_composition','reasonable_accommodation','emergency','voluntary','administrative')),
  requested_at date not null default current_date,
  current_unit_reference text not null,
  offered_unit_reference text,
  appropriate_size_confirmed boolean not null default false,
  unit_available_confirmed boolean not null default false,
  accommodation_request_id uuid references public.pha_reasonable_accommodation_requests(id),
  adverse_action_notice_issued_at timestamptz,
  explanation_right_included boolean not null default false,
  grievance_right_included boolean not null default false,
  grievance_request_deadline date,
  grievance_status text not null default 'not_requested' check (grievance_status in ('not_requested','pending','completed','waived_not_applicable')),
  effective_date date,
  status text not null default 'pending' check (status in ('pending','ready','completed','blocked','cancelled')),
  block_reason text,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pha_public_housing_leases enable row level security;
alter table public.pha_public_housing_transfers enable row level security;
grant select,insert,update on public.pha_public_housing_leases,public.pha_public_housing_transfers to authenticated;
grant all on public.pha_public_housing_leases,public.pha_public_housing_transfers to service_role;

create policy "PHA PH users read leases" on public.pha_public_housing_leases for select to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',false));
create policy "PHA PH users manage leases" on public.pha_public_housing_leases for all to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',true)) with check (public.pha_program_access(workspace_user_id,'public_housing',true));
create policy "PHA PH users read transfers" on public.pha_public_housing_transfers for select to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',false));
create policy "PHA PH users manage transfers" on public.pha_public_housing_transfers for all to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',true)) with check (public.pha_program_access(workspace_user_id,'public_housing',true));

create or replace function public.prepare_pha_ph_lease() returns trigger language plpgsql security invoker as $$
declare f public.pha_family_actions%rowtype; o public.pha_public_housing_unit_offers%rowtype;
begin
 select * into f from public.pha_family_actions where id=new.family_action_id;
 if not found or f.program_code<>'public_housing' then raise exception 'Public Housing lease requires a Public Housing family action'; end if;
 perform public.assert_pha_policy_overlay(new.acop_overlay_id,new.workspace_user_id,'public_housing','acop');
 if new.unit_offer_id is not null then
   select * into o from public.pha_public_housing_unit_offers where id=new.unit_offer_id and workspace_user_id=new.workspace_user_id;
   if not found or o.final_selection_status<>'ready' then raise exception 'Public Housing lease requires a ready controlled unit offer'; end if;
 end if;
 if new.status in ('ready','executed') then
   if not new.required_lease_provisions_confirmed then raise exception '24 CFR 966.4 required lease provisions must be confirmed'; end if;
   if not new.grievance_procedure_included then raise exception 'Public Housing lease must include the applicable grievance procedure'; end if;
 end if;
 if new.status='executed' and not new.signature_complete then raise exception 'Executed Public Housing lease requires completed signatures'; end if;
 new.source_snapshot:=jsonb_build_object('authority','24 CFR 966.4','acop_overlay_id',new.acop_overlay_id,'unit_offer_id',new.unit_offer_id);
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_ph_lease_prepare before insert or update on public.pha_public_housing_leases for each row execute function public.prepare_pha_ph_lease();

create or replace function public.prepare_pha_ph_transfer() returns trigger language plpgsql security invoker as $$
declare l public.pha_public_housing_leases%rowtype; ra public.pha_reasonable_accommodation_requests%rowtype; adverse boolean;
begin
 select * into l from public.pha_public_housing_leases where id=new.lease_id and workspace_user_id=new.workspace_user_id;
 if not found or l.status<>'executed' then raise exception 'Public Housing transfer requires an executed Public Housing lease'; end if;
 perform public.assert_pha_policy_overlay(new.acop_overlay_id,new.workspace_user_id,'public_housing','acop');
 if new.transfer_reason='family_composition' then
   if not new.appropriate_size_confirmed or not new.unit_available_confirmed or coalesce(trim(new.offered_unit_reference),'')='' then
     new.status:='blocked'; new.block_reason:='Family-composition transfer requires an available appropriate-size dwelling unit';
   end if;
 end if;
 if new.transfer_reason='reasonable_accommodation' then
   if new.accommodation_request_id is null then raise exception 'Reasonable-accommodation transfer requires an accommodation request'; end if;
   select * into ra from public.pha_reasonable_accommodation_requests where id=new.accommodation_request_id and workspace_user_id=new.workspace_user_id;
   if not found or ra.status not in ('approved','implemented') then new.status:='blocked'; new.block_reason:='Accommodation transfer remains blocked until the accommodation request is approved'; end if;
 end if;
 adverse:=new.transfer_reason in ('family_composition','administrative');
 if adverse then
   if new.adverse_action_notice_issued_at is null or not new.explanation_right_included or not new.grievance_right_included or new.grievance_request_deadline is null then
     new.status:='blocked'; new.block_reason:='Adverse transfer requires specific-ground notice, explanation right, grievance right, and request deadline';
   elsif new.effective_date is not null and (current_date <= new.grievance_request_deadline or new.grievance_status='pending') then
     new.status:='blocked'; new.block_reason:='Adverse transfer cannot take effect before the grievance request period and any requested grievance are complete';
   end if;
 end if;
 if new.status<>'blocked' and coalesce(trim(new.offered_unit_reference),'')<>'' then new.status:='ready'; new.block_reason:=null; end if;
 if new.status='completed' and new.effective_date is null then raise exception 'Completed Public Housing transfer requires an effective date'; end if;
 new.source_snapshot:=jsonb_build_object('authority','24 CFR 966.4(c)(3)-(4), (e)(8)','transfer_reason',new.transfer_reason,'lease_id',new.lease_id,'accommodation_request_id',new.accommodation_request_id);
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_ph_transfer_prepare before insert or update on public.pha_public_housing_transfers for each row execute function public.prepare_pha_ph_transfer();
