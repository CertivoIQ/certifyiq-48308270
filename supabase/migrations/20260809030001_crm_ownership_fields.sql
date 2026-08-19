-- Add structured ownership and management verification to CRM account records.
alter table public.crm_accounts
  add column if not exists property_owner_name text,
  add column if not exists management_company_name text,
  add column if not exists owner_manager_website text,
  add column if not exists ownership_verification_status text not null default 'unverified',
  add column if not exists ownership_confidence smallint,
  add column if not exists ownership_sources text[] not null default '{}'::text[],
  add column if not exists ownership_verified_at date;

do $$
begin
  alter table public.crm_accounts
    add constraint crm_accounts_ownership_verification_status_check
    check (ownership_verification_status in ('unverified', 'partially verified', 'verified', 'unable to determine'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.crm_accounts
    add constraint crm_accounts_ownership_confidence_check
    check (ownership_confidence is null or ownership_confidence between 0 and 100);
exception
  when duplicate_object then null;
end
$$;

create index if not exists crm_accounts_ownership_verification_status_idx
  on public.crm_accounts (ownership_verification_status);

-- Backfill only records whose ownership research was already verified manually.
update public.crm_accounts
set property_owner_name = 'Hope Gardens I LLC / Bushwick II LLC (developer entities); NYCHA retains an interest',
    ownership_verification_status = 'partially verified',
    ownership_confidence = 75,
    ownership_sources = array[
      'https://www.nyc.gov/assets/hpd/downloads/pdfs/services/hope-gardens-rfp-designation.pdf',
      'https://hcr.ny.gov/system/files/documents/2024/12/hcr-multifamily-finance-9percent-awards-fall-2024.pdf'
    ],
    ownership_verified_at = date '2026-08-08'
where lower(name) = 'hope gardens';

update public.crm_accounts
set property_owner_name = 'Klein Financial',
    management_company_name = 'SRG Residential',
    owner_manager_website = 'https://klein-financial.com/properties/current/vaseo/',
    ownership_verification_status = 'verified',
    ownership_confidence = 95,
    ownership_sources = array[
      'https://klein-financial.com/properties/current/vaseo/',
      'https://www.vaseoapartments.com/'
    ],
    ownership_verified_at = date '2026-08-08'
where lower(name) = 'vaseo';

update public.crm_accounts
set property_owner_name = 'Michaels Development Co',
    management_company_name = 'Michaels Management - Affordable, LLC',
    ownership_verification_status = 'verified',
    ownership_confidence = 95,
    ownership_sources = array[
      'https://www.phfa.org/forms/multifamily_inventory/dv/2025-all-properties.pdf'
    ],
    ownership_verified_at = date '2026-08-08'
where lower(name) = 'courtyard preservation';

update public.crm_accounts
set property_owner_name = 'The View by Vintage, LP',
    management_company_name = 'FPI Management, Inc.',
    owner_manager_website = 'https://www.fpimgt.com/',
    ownership_verification_status = 'verified',
    ownership_confidence = 90,
    ownership_sources = array[
      'https://www.wshfc.org/managers/Other/CurrentPortfolio.xlsx',
      'https://affordablehousingonline.com/housing-search/Washington/Vancouver/The-View-by-Vintage/10059394'
    ],
    ownership_verified_at = date '2026-08-08'
where lower(name) in ('view by vintage, the', 'the view by vintage');

update public.crm_accounts
set management_company_name = 'Prudent Property Managers, Inc.',
    owner_manager_website = 'https://prudentproperty.com/',
    ownership_verification_status = 'partially verified',
    ownership_confidence = 85,
    ownership_sources = array[
      'https://prudentproperty.com/property/sanford-hildebrandt-towers/'
    ],
    ownership_verified_at = date '2026-08-08'
where lower(name) = 'sanford hildebrandt towers';

update public.crm_accounts
set property_owner_name = 'Greenstreet Companies / Vintage Housing',
    management_company_name = 'FPI Management, Inc.',
    owner_manager_website = 'https://www.fpimgt.com/',
    ownership_verification_status = 'partially verified',
    ownership_confidence = 85,
    ownership_sources = array[
      'https://www.wshfc.org/managers/Other/CurrentPortfolio.xlsx',
      'https://www.fpimgt.com/'
    ],
    ownership_verified_at = date '2026-08-08'
where lower(name) = 'steamboat by vintage';

update public.crm_accounts
set property_owner_name = 'LHP Capital, LLC',
    management_company_name = 'LHP Capital, LLC',
    owner_manager_website = 'https://www.lhp.net/',
    ownership_verification_status = 'verified',
    ownership_confidence = 95,
    ownership_sources = array[
      'https://www.lhp.net/',
      'https://www.lhp.net/communities/trevecca-towers/'
    ],
    ownership_verified_at = date '2026-08-08'
where lower(name) in ('trevecca towers i/east', 'trevecca towers east', 'trevecca towers i');
