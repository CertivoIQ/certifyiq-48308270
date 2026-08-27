alter table public.account_access
  add column if not exists license_kind text,
  add column if not exists licensed_state_codes text[] not null default '{}';

alter table public.account_access
  drop constraint if exists account_access_license_kind_check,
  add constraint account_access_license_kind_check
    check (license_kind is null or license_kind in ('multifamily_enterprise', 'pha')),
  drop constraint if exists account_access_license_state_scope_check,
  add constraint account_access_license_state_scope_check check (
    license_kind is null
    or (license_kind = 'pha' and cardinality(licensed_state_codes) = 1)
    or (license_kind = 'multifamily_enterprise' and cardinality(licensed_state_codes) >= 1)
  );

comment on column public.account_access.licensed_state_codes is
  'Paid, webhook-verified state rule-pack jurisdictions. Multifamily price quantity must match this cardinality; PHA is flat fee and exactly one state.';

alter table public.crm_accounts
  add column if not exists licensed_state_codes text[] not null default '{}';

comment on column public.crm_accounts.licensed_state_codes is
  'Prospective state rule-pack scope. Invoice issuance still requires and validates an explicit current selection.';

alter table public.enterprise_licenses
  add column if not exists license_kind text,
  add column if not exists licensed_state_codes text[] not null default '{}';

alter table public.enterprise_licenses
  drop constraint if exists enterprise_licenses_license_kind_check,
  add constraint enterprise_licenses_license_kind_check
    check (license_kind is null or license_kind in ('multifamily_enterprise', 'pha')),
  drop constraint if exists enterprise_licenses_license_state_scope_check,
  add constraint enterprise_licenses_license_state_scope_check check (
    license_kind is null
    or (license_kind = 'pha' and cardinality(licensed_state_codes) = 1)
    or (license_kind = 'multifamily_enterprise' and cardinality(licensed_state_codes) >= 1)
  ),
  drop constraint if exists enterprise_licenses_authoritative_price_check,
  add constraint enterprise_licenses_authoritative_price_check check (
    license_kind is null
    or (license_kind = 'pha' and annual_price_cents = 15000000)
    or (
      license_kind = 'multifamily_enterprise'
      and annual_price_cents = 6500000 * cardinality(licensed_state_codes)
    )
  );

comment on column public.enterprise_licenses.licensed_state_codes is
  'Paid-invoice scope for the active license term. Multifamily is $65,000 per state; PHA is $150,000 flat with one operating state.';

