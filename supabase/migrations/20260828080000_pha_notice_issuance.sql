-- Derived PHA family notice generation and issuance gate.
-- Issued notices require a validated household calculation and current controlled sources.

alter table public.pha_family_notices
  add column if not exists template_key text,
  add column if not exists delivery_method text check (delivery_method in ('mail','hand_delivery','electronic','other')),
  add column if not exists determination_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists notice_summary text,
  add column if not exists source_validated boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists pha_family_notices_family_action_type_uidx
  on public.pha_family_notices(family_action_id, notice_type);

create or replace function public.prepare_pha_family_notice()
returns trigger language plpgsql security invoker as $$
declare
  action_row public.pha_family_actions%rowtype;
  calc_row public.pha_family_calculations%rowtype;
  calc_found boolean := false;
  derived_template text;
  derived_summary text;
begin
  select * into action_row
    from public.pha_family_actions
   where id = new.family_action_id and user_id = new.user_id;

  if not found then
    raise exception 'PHA family action not found for notice';
  end if;

  select * into calc_row
    from public.pha_family_calculations
   where family_action_id = new.family_action_id
     and user_id = new.user_id;
  calc_found := found;

  derived_template := case action_row.action_type
    when 'admission' then 'PHA_ADMISSION_DETERMINATION'
    when 'annual_reexamination' then 'PHA_ANNUAL_REEXAMINATION_DETERMINATION'
    when 'interim_reexamination' then 'PHA_INTERIM_REEXAMINATION_DETERMINATION'
    when 'portability' then 'PHA_PORTABILITY_DETERMINATION'
    else 'PHA_FAMILY_DETERMINATION'
  end;

  new.template_key := derived_template;
  new.source_validated := action_row.controlled_source_release_approved
    and action_row.current_rule_version_validated
    and not action_row.source_status_conflict;
  new.updated_at := now();

  if calc_found then
    new.determination_snapshot := jsonb_build_object(
      'program_code', action_row.program_code,
      'action_type', action_row.action_type,
      'effective_date', action_row.effective_date,
      'annual_income', calc_row.annual_income,
      'adjusted_income', calc_row.adjusted_income,
      'total_tenant_payment', calc_row.total_tenant_payment,
      'tenant_rent', calc_row.tenant_rent,
      'family_share', calc_row.family_share,
      'housing_assistance_payment', calc_row.housing_assistance_payment,
      'utility_reimbursement', calc_row.utility_reimbursement,
      'contract_rent_to_owner', calc_row.contract_rent_to_owner,
      'calculation_status', calc_row.calculation_status,
      'engine_build', calc_row.engine_build
    );
    derived_summary := concat_ws(' ',
      'Program:', upper(replace(action_row.program_code, '_', ' ')) || '.',
      'Action:', replace(action_row.action_type, '_', ' ') || '.',
      'Effective date:', action_row.effective_date::text || '.',
      'TTP:', coalesce(calc_row.total_tenant_payment::text, 'not determined') || '.',
      'Tenant rent/share:', coalesce(calc_row.tenant_rent::text, calc_row.family_share::text, 'not determined') || '.',
      'HAP:', coalesce(calc_row.housing_assistance_payment::text, 'not applicable') || '.'
    );
    new.notice_summary := derived_summary;
  else
    new.determination_snapshot := '{}'::jsonb;
    new.notice_summary := 'Calculation not yet validated.';
  end if;

  if new.status in ('ready','issued') then
    if not calc_found or calc_row.calculation_status <> 'validated' then
      raise exception 'A validated family calculation is required before a notice can be ready or issued';
    end if;
    if not new.source_validated then
      raise exception 'Approved current controlled sources are required before a notice can be ready or issued';
    end if;
  end if;

  if new.status = 'issued' then
    if new.delivery_method is null then
      raise exception 'Delivery method is required before notice issuance';
    end if;
    new.issued_at := coalesce(new.issued_at, now());
  else
    new.issued_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists pha_family_notice_prepare_before_write on public.pha_family_notices;
create trigger pha_family_notice_prepare_before_write
before insert or update on public.pha_family_notices
for each row execute function public.prepare_pha_family_notice();

create or replace function public.refresh_pha_family_action_from_notice()
returns trigger language plpgsql security invoker as $$
declare
  action_id uuid := coalesce(new.family_action_id, old.family_action_id);
  owner_id uuid := coalesce(new.user_id, old.user_id);
  has_issued_notice boolean := false;
begin
  select exists (
    select 1 from public.pha_family_notices n
     where n.family_action_id = action_id
       and n.user_id = owner_id
       and n.status = 'issued'
       and n.issued_at is not null
       and n.source_validated = true
  ) into has_issued_notice;

  update public.pha_family_actions
     set notice_complete = has_issued_notice,
         updated_at = now()
   where id = action_id and user_id = owner_id;
  return null;
end;
$$;

drop trigger if exists pha_family_notice_refresh_after_write on public.pha_family_notices;
create trigger pha_family_notice_refresh_after_write
after insert or update or delete on public.pha_family_notices
for each row execute function public.refresh_pha_family_action_from_notice();
