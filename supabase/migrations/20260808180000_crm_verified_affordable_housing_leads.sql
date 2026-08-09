-- Replace synthetic research-list rows with a small, source-verifiable starter set.
-- Existing records with activity, contacts, or progressed sales stages are preserved.
-- Public facts verified 2026-08-08; source URLs are stored with each account.

delete from public.crm_accounts a
where a.source in ('Enterprise research list', 'Auto-populated · non-subscriber list')
  and a.stage = 'new'
  and not exists (select 1 from public.crm_contacts c where c.account_id = a.id)
  and not exists (select 1 from public.crm_activities x where x.account_id = a.id);

with verified(name, account_type, hq, states, properties, units, programs, website, source, notes) as (
  values
  (
    'Mercy Housing', 'enterprise'::public.crm_account_type, 'Denver, CO', array['CO','CA','GA','WA'], 0, 0,
    array['Affordable housing','Supportive housing','Senior housing'],
    'https://www.mercyhousing.org/',
    'Verified public research · official portfolio · 2026-08-08',
    E'Official portfolio: https://www.mercyhousing.org/portfolio/\nPublished coverage: portfolio across 20 states. Portfolio totals change over time, so no unsourced current unit total is stored.\nProperty example: 600 Seventh Street, San Francisco, CA — 170 affordable apartment homes. Source: https://www.mercyhousing.org/2025/12/600-seventh-street-opens-in-san-francisco/'
  ),
  (
    'The Community Builders', 'enterprise'::public.crm_account_type, 'Boston, MA', array['MA','IL','OH','NY','DC'], 0, 14000,
    array['Affordable housing','Mixed-income housing','Supportive services'],
    'https://tcbinc.org/',
    'Verified public research · official organization site · 2026-08-08',
    E'Official organization profile: https://tcbinc.org/get-to-know-us/\nPublished portfolio: over 14,000 apartment homes.\nProperty example: A.O. Flats, Jamaica Plain, MA — 78 units affordable to low- and moderate-income residents. Source: https://tcbinc.org/our-communities/'
  ),
  (
    'BRIDGE Housing', 'enterprise'::public.crm_account_type, 'San Francisco, CA', array['CA','OR','WA'], 130, 14000,
    array['Affordable housing','Workforce housing','Senior housing'],
    'https://bridgehousing.com/',
    'Verified public research · official portfolio · 2026-08-08',
    E'Official portfolio: https://bridgehousing.com/our-work/\nPublished portfolio: over 14,000 apartment units in more than 130 properties.\nProperty example: Cornelius Place, Cornelius, OR — 45 homes for low-income seniors. Source: https://bridgehousing.com/properties/cornelius-place/'
  ),
  (
    'Eden Housing', 'company'::public.crm_account_type, 'Hayward, CA', array['CA'], 0, 0,
    array['Affordable housing','Senior housing','Family housing'],
    'https://edenhousing.org/',
    'Verified public research · official property pages · 2026-08-08',
    E'Official property directory: https://edenhousing.org/about-us/all-properties/all-properties-list/\nProperty examples: Vista Verde, Freedom, CA — 76 affordable rental homes; Ford Road Plaza, San Jose, CA — 75 units. Sources: https://edenhousing.org/properties/vista-verde/ and https://edenhousing.org/properties/ford-road-plaza/\nNo organization-wide unit total is stored without a current official total.'
  )
)
insert into public.crm_accounts (
  name, account_type, hq, states, properties, units, programs, website,
  source, notes, stage, arr, lead_score, responded, reminders_sent
)
select v.name, v.account_type, v.hq, v.states, v.properties, v.units, v.programs,
       v.website, v.source, v.notes, 'new'::public.crm_stage, 0, 60, false, 0
from verified v
where not exists (
  select 1 from public.crm_accounts a where lower(a.name) = lower(v.name)
);

-- Refresh public facts for matching preserved opportunities without changing
-- sales stage, owner, ARR, contact history, or follow-up dates.
update public.crm_accounts
set hq = 'Denver, CO',
    states = array['CO','CA','GA','WA'],
    properties = 0,
    units = 0,
    programs = array['Affordable housing','Supportive housing','Senior housing'],
    website = 'https://www.mercyhousing.org/',
    source = 'Verified public research · official portfolio · 2026-08-08',
    notes = E'Official portfolio: https://www.mercyhousing.org/portfolio/\nPublished coverage: portfolio across 20 states. Portfolio totals change over time, so no unsourced current unit total is stored.\nProperty example: 600 Seventh Street, San Francisco, CA — 170 affordable apartment homes. Source: https://www.mercyhousing.org/2025/12/600-seventh-street-opens-in-san-francisco/'
where lower(name) = 'mercy housing';

update public.crm_accounts
set hq = 'Boston, MA', states = array['MA','IL','OH','NY','DC'], properties = 0, units = 14000,
    programs = array['Affordable housing','Mixed-income housing','Supportive services'],
    website = 'https://tcbinc.org/', source = 'Verified public research · official organization site · 2026-08-08',
    notes = E'Official organization profile: https://tcbinc.org/get-to-know-us/\nPublished portfolio: over 14,000 apartment homes.\nProperty example: A.O. Flats, Jamaica Plain, MA — 78 affordable units. Source: https://tcbinc.org/our-communities/'
where lower(name) = 'the community builders';

update public.crm_accounts
set hq = 'San Francisco, CA', states = array['CA','OR','WA'], properties = 130, units = 14000,
    programs = array['Affordable housing','Workforce housing','Senior housing'],
    website = 'https://bridgehousing.com/', source = 'Verified public research · official portfolio · 2026-08-08',
    notes = E'Official portfolio: https://bridgehousing.com/our-work/\nPublished portfolio: over 14,000 apartment units in more than 130 properties.\nProperty example: Cornelius Place, Cornelius, OR — 45 homes for low-income seniors. Source: https://bridgehousing.com/properties/cornelius-place/'
where lower(name) = 'bridge housing';

update public.crm_accounts
set hq = 'Hayward, CA', states = array['CA'], properties = 0, units = 0,
    programs = array['Affordable housing','Senior housing','Family housing'],
    website = 'https://edenhousing.org/', source = 'Verified public research · official property pages · 2026-08-08',
    notes = E'Official property directory: https://edenhousing.org/about-us/all-properties/all-properties-list/\nProperty examples: Vista Verde, Freedom, CA — 76 affordable rental homes; Ford Road Plaza, San Jose, CA — 75 units. Sources: https://edenhousing.org/properties/vista-verde/ and https://edenhousing.org/properties/ford-road-plaza/'
where lower(name) = 'eden housing';
