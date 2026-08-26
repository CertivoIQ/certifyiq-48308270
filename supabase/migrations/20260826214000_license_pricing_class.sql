-- CertivoIQ commercial pricing class ---------------------------------------
-- Standard affordable-housing organizations: $65,000/year
-- Public Housing Authorities (PHA):       $150,000/year
--
-- Keep customer classification explicit instead of inferring a material
-- invoice amount from unit count, program mix, or organization name.

alter table public.crm_accounts
  add column if not exists license_pricing_class text not null default 'standard';

alter table public.crm_accounts
  drop constraint if exists crm_accounts_license_pricing_class_check;

alter table public.crm_accounts
  add constraint crm_accounts_license_pricing_class_check
  check (license_pricing_class in ('standard', 'pha'));

comment on column public.crm_accounts.license_pricing_class is
  'Commercial annual license class: standard = $65,000/year; pha = $150,000/year.';

-- PHA campaign records are authoritative PHA leads and can be safely
-- backfilled. Other pre-existing CRM accounts remain standard until explicitly
-- classified by staff.
update public.crm_accounts
set license_pricing_class = 'pha',
    updated_at = now()
where source ilike 'PHA role campaign%';
