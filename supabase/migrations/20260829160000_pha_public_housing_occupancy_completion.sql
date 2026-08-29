-- Close Public Housing occupancy execution gaps with evidence-backed leases and adverse-action notices.

alter table public.pha_family_notices
  add column if not exists specific_reasons text;

alter table public.pha_public_housing_leases
  add column if not exists lease_document_reference text,
  add column if not exists lease_provisions_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists grievance_procedure_version text,
  add column if not exists tenant_signed_at timestamptz,
  add column if not exists pha_signed_at timestamptz;

alter table public.pha_public_housing_transfers
  add column if not exists is_adverse_action boolean not null default false,
  add column if not exists adverse_action_notice_id uuid references public.pha_family_notices(id),
  add column if not exists adverse_action_ground text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='pha_family_notices_specific_reasons_issued') then
    alter table public.pha_family_notices
      add constraint pha_family_notices_specific_reasons_issued
      check (
        status <> 'issued'
        or determination_outcome = 'approval'
        or nullif(btrim(specific_reasons),'') is not null
      );
  end if;
end $$;

create index if not exists pha_ph_leases_family_action_idx on public.pha_public_housing_leases(family_action_id);
create index if not exists pha_ph_leases_overlay_idx on public.pha_public_housing_leases(acop_overlay_id);
create index if not exists pha_ph_transfers_lease_idx on public.pha_public_housing_transfers(lease_id);
create index if not exists pha_ph_transfers_notice_idx on public.pha_public_housing_transfers(adverse_action_notice_id);
create index if not exists pha_ph_transfers_accommodation_idx on public.pha_public_housing_transfers(accommodation_request_id);

create or replace function public.prepare_pha_ph_lease() returns trigger language plpgsql security invoker as $$
declare
  f public.pha_family_actions%rowtype;
  o public.pha_public_housing_unit_offers%rowtype;
begin
  select * into f from public.pha_family_actions
   where id=new.family_action_id and user_id=new.workspace_user_id;
  if not found or f.program_code<>'public_housing' then
    raise exception 'Public Housing lease requires a Public Housing family action in the same workspace';
  end if;
  perform public.assert_pha_policy_overlay(new.acop_overlay_id,new.workspace_user_id,'public_housing','acop');
  if new.unit_offer_id is not null then
    select * into o from public.pha_public_housing_unit_offers
     where id=new.unit_offer_id and workspace_user_id=new.workspace_user_id;
    if not found or o.final_selection_status<>'ready' then
      raise exception 'Public Housing lease requires a ready controlled unit offer';
    end if;
  end if;
  if new.status in ('ready','executed') then
    if not new.required_lease_provisions_confirmed then
      raise exception '24 CFR 966.4 required lease provisions must be confirmed';
    end if;
    if new.lease_provisions_snapshot='{}'::jsonb then
      raise exception 'Controlled lease provisions snapshot is required';
    end if;
    if nullif(btrim(new.lease_document_reference),'') is null then
      raise exception 'Controlled lease document reference is required';
    end if;
    if not new.grievance_procedure_included or nullif(btrim(new.grievance_procedure_version),'') is null then
      raise exception 'Public Housing lease must include the applicable versioned grievance procedure';
    end if;
  end if;
  if new.status='executed' then
    if not new.signature_complete or new.tenant_signed_at is null or new.pha_signed_at is null then
      raise exception 'Executed Public Housing lease requires tenant and PHA signatures';
    end if;
  end if;
  new.source_snapshot:=jsonb_build_object(
    'authority','24 CFR 966.4',
    'acop_overlay_id',new.acop_overlay_id,
    'unit_offer_id',new.unit_offer_id,
    'lease_document_reference',new.lease_document_reference,
    'grievance_procedure_version',new.grievance_procedure_version,
    'lease_provisions_snapshot',new.lease_provisions_snapshot
  );
  new.updated_at:=now();
  return new;
end; $$;

create or replace function public.prepare_pha_ph_transfer() returns trigger language plpgsql security invoker as $$
declare
  l public.pha_public_housing_leases%rowtype;
  ra public.pha_reasonable_accommodation_requests%rowtype;
  n public.pha_family_notices%rowtype;
  adverse boolean;
  requested_status text;
begin
  requested_status:=new.status;
  select * into l from public.pha_public_housing_leases
   where id=new.lease_id and workspace_user_id=new.workspace_user_id;
  if not found or l.status<>'executed' then
    raise exception 'Public Housing transfer requires an executed Public Housing lease';
  end if;
  perform public.assert_pha_policy_overlay(new.acop_overlay_id,new.workspace_user_id,'public_housing','acop');

  new.status:='pending';
  new.block_reason:=null;

  if new.transfer_reason='family_composition' and
     (not new.appropriate_size_confirmed or not new.unit_available_confirmed or nullif(btrim(new.offered_unit_reference),'') is null) then
    new.status:='blocked';
    new.block_reason:='Family-composition transfer requires an available appropriate-size dwelling unit';
  end if;

  if new.transfer_reason='reasonable_accommodation' then
    if new.accommodation_request_id is null then
      raise exception 'Reasonable-accommodation transfer requires an accommodation request';
    end if;
    select * into ra from public.pha_reasonable_accommodation_requests
     where id=new.accommodation_request_id and workspace_user_id=new.workspace_user_id;
    if not found or ra.status not in ('approved','implemented') then
      new.status:='blocked';
      new.block_reason:='Accommodation transfer remains blocked until the accommodation request is approved';
    end if;
  end if;

  adverse:=new.is_adverse_action or new.transfer_reason='administrative';
  new.is_adverse_action:=adverse;
  if adverse then
    if new.adverse_action_notice_id is null or nullif(btrim(new.adverse_action_ground),'') is null then
      new.status:='blocked';
      new.block_reason:='Adverse transfer requires a controlled issued notice and specific ground';
    else
      select * into n from public.pha_family_notices
       where id=new.adverse_action_notice_id
         and user_id=new.workspace_user_id
         and family_action_id=l.family_action_id;
      if not found or n.status<>'issued' or n.issued_at is null
         or n.legal_requirements_validated is not true
         or n.determination_outcome not in ('change','termination')
         or nullif(btrim(n.specific_reasons),'') is null then
        new.status:='blocked';
        new.block_reason:='Adverse transfer notice must be issued, legally validated, and contain specific reasons for this family action';
      elsif position(lower(btrim(new.adverse_action_ground)) in lower(n.specific_reasons))=0
         and position(lower(btrim(n.specific_reasons)) in lower(new.adverse_action_ground))=0 then
        new.status:='blocked';
        new.block_reason:='Transfer ground must match the specific reason in the controlled notice';
      else
        new.adverse_action_notice_issued_at:=n.issued_at;
      end if;
    end if;
    if new.explanation_right_included is not true
       or new.grievance_right_included is not true
       or new.grievance_request_deadline is null then
      new.status:='blocked';
      new.block_reason:='Adverse transfer requires explanation and grievance rights with a request deadline';
    elsif current_date <= new.grievance_request_deadline or new.grievance_status='pending' then
      new.status:='blocked';
      new.block_reason:='Adverse transfer cannot take effect before the grievance request period and any requested grievance are complete';
    end if;
  end if;

  if requested_status in ('ready','completed') and
     (nullif(btrim(new.offered_unit_reference),'') is null or new.unit_available_confirmed is not true) then
    new.status:='blocked';
    new.block_reason:='A ready or completed transfer requires an available offered unit';
  end if;

  if new.status<>'blocked' then
    if requested_status='completed' then
      if new.effective_date is null then
        raise exception 'Completed Public Housing transfer requires an effective date';
      end if;
      new.status:='completed';
    elsif nullif(btrim(new.offered_unit_reference),'') is not null and new.unit_available_confirmed then
      new.status:='ready';
    else
      new.status:='pending';
    end if;
  end if;

  new.source_snapshot:=jsonb_build_object(
    'authority','24 CFR 966.4(c)(3)-(4), (e)(8)',
    'transfer_reason',new.transfer_reason,
    'lease_id',new.lease_id,
    'accommodation_request_id',new.accommodation_request_id,
    'is_adverse_action',new.is_adverse_action,
    'adverse_action_notice_id',new.adverse_action_notice_id,
    'adverse_action_ground',new.adverse_action_ground
  );
  new.updated_at:=now();
  return new;
end; $$;

revoke execute on function public.prepare_pha_ph_lease() from public, anon, authenticated;
revoke execute on function public.prepare_pha_ph_transfer() from public, anon, authenticated;
grant execute on function public.prepare_pha_ph_lease() to service_role;
grant execute on function public.prepare_pha_ph_transfer() to service_role;
