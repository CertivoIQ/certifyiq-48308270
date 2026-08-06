-- roles ---------------------------------------------------------------
create type public.app_role as enum ('staff', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile write" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do update set email = excluded.email;

  if new.email_confirmed_at is not null
     and lower(split_part(new.email, '@', 2)) = 'certifyiq.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'staff')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger on_auth_user_confirmed
after update of email_confirmed_at on auth.users
for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- crm -----------------------------------------------------------------
create type public.crm_account_type as enum ('enterprise', 'company');
create type public.crm_stage as enum ('new', 'trialing', 'trial ended', 'negotiation', 'won', 'lost');

create table public.crm_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type public.crm_account_type not null default 'company',
  units integer not null default 0,
  hq text,
  website text,
  linkedin_url text,
  stage public.crm_stage not null default 'new',
  arr numeric not null default 0,
  plan text,
  owner text,
  source text,
  trial_ended_on date,
  reminders_sent integer not null default 0,
  last_touch text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.crm_accounts(id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  linkedin_url text,
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  compliance_event text,
  subject text not null,
  body text not null,
  cta_label text,
  created_at timestamptz not null default now()
);

create table public.crm_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null default 'email',
  audience text,
  compliance_event text,
  subject text,
  body text,
  status text not null default 'draft',
  automated boolean not null default false,
  scheduled_for timestamptz,
  sent integer not null default 0,
  opened integer not null default 0,
  clicked integer not null default 0,
  converted integer not null default 0,
  template_id uuid references public.crm_templates(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_news (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'federal',
  headline text not null,
  detail text,
  source text,
  url text,
  published_at timestamptz not null default now()
);

grant select, insert, update, delete on public.crm_accounts to authenticated;
grant select, insert, update, delete on public.crm_contacts to authenticated;
grant select, insert, update, delete on public.crm_campaigns to authenticated;
grant select, insert, update, delete on public.crm_templates to authenticated;
grant select, insert, update, delete on public.crm_news to authenticated;
grant all on public.crm_accounts, public.crm_contacts, public.crm_campaigns, public.crm_templates, public.crm_news to service_role;

alter table public.crm_accounts enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_campaigns enable row level security;
alter table public.crm_templates enable row level security;
alter table public.crm_news enable row level security;

create policy "staff manage accounts" on public.crm_accounts for all to authenticated
  using (public.has_role(auth.uid(), 'staff')) with check (public.has_role(auth.uid(), 'staff'));
create policy "staff manage contacts" on public.crm_contacts for all to authenticated
  using (public.has_role(auth.uid(), 'staff')) with check (public.has_role(auth.uid(), 'staff'));
create policy "staff manage campaigns" on public.crm_campaigns for all to authenticated
  using (public.has_role(auth.uid(), 'staff')) with check (public.has_role(auth.uid(), 'staff'));
create policy "staff manage templates" on public.crm_templates for all to authenticated
  using (public.has_role(auth.uid(), 'staff')) with check (public.has_role(auth.uid(), 'staff'));
create policy "staff manage news" on public.crm_news for all to authenticated
  using (public.has_role(auth.uid(), 'staff')) with check (public.has_role(auth.uid(), 'staff'));

create trigger t_accounts_updated before update on public.crm_accounts for each row execute function public.touch_updated_at();
create trigger t_contacts_updated before update on public.crm_contacts for each row execute function public.touch_updated_at();
create trigger t_campaigns_updated before update on public.crm_campaigns for each row execute function public.touch_updated_at();

-- seed: real affordable-housing owner/operator accounts -----------------
insert into public.crm_accounts (name, account_type, units, hq, website, linkedin_url, stage, arr, plan, owner, source, last_touch, reminders_sent, trial_ended_on, notes) values
('Greystar Real Estate Partners','enterprise',108000,'Charleston, SC','greystar.com','linkedin.com/company/greystar','negotiation',59988,'Enterprise','R. Ortiz','Auto-populated · non-subscriber list','Security review scheduled with compliance ops',2,null,'National operator with a large affordable portfolio; needs multi-program blended occupancy support.'),
('The Michaels Organization','enterprise',60000,'Camden, NJ','themichaelsorg.com','linkedin.com/company/the-michaels-organization','trialing',59988,'Enterprise','R. Ortiz','Marketing email · LaunchPad landing page','Trial in progress — 3 regionals invited',0,null,'LIHTC + PBS8 + HOME blended sites. Strong HOTMA readiness interest.'),
('WinnCompanies','enterprise',115000,'Boston, MA','winncompanies.com','linkedin.com/company/winncompanies','trial ended',59988,'Enterprise','K. Adeyemi','Webinar · HOTMA readiness','Reminder email sent 24h after trial end',1,current_date - 1,'Largest manager of affordable housing in the US. TRACS + MOR volume is the hook.'),
('The NRP Group','enterprise',26000,'Cleveland, OH','nrpgroup.com','linkedin.com/company/the-nrp-group','new',59988,'Enterprise','Unassigned','Auto-populated · non-subscriber list','Never contacted',0,null,'Heavy LIHTC developer/operator. Target VP of Property Management.'),
('Dominium','enterprise',38000,'Plymouth, MN','dominiumapartments.com','linkedin.com/company/dominium','new',59988,'Enterprise','Unassigned','Auto-populated · non-subscriber list','Never contacted',0,null,'Large LIHTC portfolio across 20+ states — rule pack breadth is the value story.'),
('Pennrose','company',22000,'Philadelphia, PA','pennrose.com','linkedin.com/company/pennrose','trialing',17988,'Business','K. Adeyemi','Outbound · LinkedIn sequence','Uploaded 42 certifications during trial',0,null,'Mixed LIHTC/HOME. Interested in Academy add-on for site staff.'),
('LDG Development','company',18000,'Louisville, KY','ldgdevelopment.com','linkedin.com/company/ldg-development','new',17988,'Business','Unassigned','Auto-populated · non-subscriber list','Never contacted',0,null,'Fast-growing LIHTC developer.'),
('Fairstead','company',18500,'New York, NY','fairstead.com','linkedin.com/company/fairstead','negotiation',59988,'Enterprise','R. Ortiz','Referral','Pricing sent — awaiting legal',1,null,'Preservation portfolio, Section 8 heavy.'),
('Wallick Communities','company',15000,'New Albany, OH','wallick.com','linkedin.com/company/wallick-communities','won',17988,'Business','K. Adeyemi','Trade show · AHF Live','Subscribed · onboarding in LaunchPad',1,null,'Closed. Expansion opportunity: Academy per-property add-on.'),
('McCormack Baron Salazar','company',13000,'St. Louis, MO','mccormackbaron.com','linkedin.com/company/mccormack-baron-salazar','lost',17988,'Business','R. Ortiz','Trade show','Renewed with incumbent — revisit Q1',3,current_date - 12,'Revisit before next fiscal year.'),
('National Church Residences','company',30000,'Columbus, OH','nationalchurchresidences.org','linkedin.com/company/national-church-residences','new',59988,'Enterprise','Unassigned','Auto-populated · non-subscriber list','Never contacted',0,null,'Senior housing, Section 202/PRAC + HOTMA exposure.'),
('Vitus Group','company',8000,'Seattle, WA','vitusgroup.com','linkedin.com/company/vitus-group','new',17988,'Business','Unassigned','Auto-populated · non-subscriber list','Never contacted',0,null,'West coast preservation owner.');

insert into public.crm_contacts (account_id, name, title, email, phone, linkedin_url, is_primary, notes)
select a.id, c.name, c.title, c.email, c.phone, c.linkedin_url, c.is_primary, c.notes
from public.crm_accounts a
join (values
 ('The Michaels Organization','Denise Hollowell','VP of Property Management','dhollowell@themichaelsorg.com','(856) 555-0148','linkedin.com/company/the-michaels-organization/people',true,'Champion. Owns compliance tooling budget.'),
 ('The Michaels Organization','Craig Munsey','Director of Compliance','cmunsey@themichaelsorg.com','(856) 555-0192','linkedin.com/company/the-michaels-organization/people',false,'Day-to-day evaluator — runs the file review team.'),
 ('WinnCompanies','Alicia Trent','SVP Asset Management','atrent@winncompanies.com','(617) 555-0113','linkedin.com/company/winncompanies/people',true,'Trial ended — reminder sequence active.'),
 ('Greystar Real Estate Partners','Marta Quilliam','VP Affordable Compliance','mquilliam@greystar.com','(843) 555-0122','linkedin.com/company/greystar/people',true,'Wants SOC2 + RLS details before signature.'),
 ('Fairstead','Devon Pike','VP Compliance & Risk','dpike@fairstead.com','(212) 555-0139','linkedin.com/company/fairstead/people',true,'Legal review in progress.'),
 ('Pennrose','Rosalind Fahey','Director of Compliance','rfahey@pennrose.com','(215) 555-0166','linkedin.com/company/pennrose/people',true,'Asked about Academy seats for 60 site staff.'),
 ('Wallick Communities','Ellen Mbeki','VP of Property Management','embeki@wallick.com','(614) 555-0151','linkedin.com/company/wallick-communities/people',true,'Closed/won. Quarterly business review scheduled.')
) as c(company,name,title,email,phone,linkedin_url,is_primary,notes) on c.company = a.name;

insert into public.crm_templates (name, category, compliance_event, subject, body, cta_label) values
('HOTMA final compliance date','Federal compliance event','HOTMA Sections 102/104 full compliance','HOTMA is live — is your income determination process actually compliant?','Hi {{first_name}},

HOTMA changed how you calculate income, assets, and de minimis thresholds — and the enforcement window is no longer theoretical. Most portfolios we review still carry legacy asset logic on at least 1 in 5 files.

CertifyIQ reviews every certification against the HOTMA rule pack assigned to each property, returns a Pass/Fail score with the cited rule and the exact correction step, and keeps a human final sign-off in the loop.

Start a 7-day free trial and upload 10 real certifications.','Start the 7-day free trial'),
('Annual LIHTC owner certification season','Federal compliance event','Form 8609 / AOC filing season','Your AOC season, minus the fire drill','Hi {{first_name}},

Owner certification season punishes portfolios that reconcile at the end instead of the point of certification. Every uncorrected TIC becomes an 8823 line item.

CertifyIQ scores each certification as it arrives, flags corrections required before the file is filed, and produces the audit trail your state agency asks for.','See a live TIC review'),
('NSPIRE inspection standards','Federal compliance event','HUD NSPIRE inspection protocol','NSPIRE findings start in the file, not the unit','Hi {{first_name}},

NSPIRE shifted weight to health and safety defects, but the paperwork half of your score still comes from certification accuracy and file completeness.

CertifyIQ pairs inspection-readiness training with automated file review so your team walks in with clean documentation.','Book the NSPIRE track'),
('Section 8 income limit release','Federal compliance event','HUD annual income limit publication','New income limits published — your rent roll may already be out of compliance','Hi {{first_name}},

HUD published new income limits. Every certification dated after the effective date must use them, and mixed LIHTC/HOME/Section 8 sites have three different effective dates to reconcile.

CertifyIQ updates all 50 state rule packs and re-scores your open certifications automatically.','Re-score my open files'),
('Trial ended — 24 hour reminder','Lifecycle automation','Trial expiry','Your CertifyIQ trial data is held for 14 more days','Hi {{first_name}},

Your 7-day trial ended yesterday. Everything you and your team uploaded is parked, read-only, for 14 days. Subscribe and it restores instantly; on day 15 it is permanently deleted.','Restore my portfolio'),
('Fair Housing Month','Federal compliance event','April — Fair Housing Month','Fair housing exposure hides in your certification file','Hi {{first_name}},

Inconsistent treatment across applicants is almost always visible in the certification record before it is visible in a complaint.

CertifyIQ Academy fair housing certification plus automated file review give you a defensible, documented process.','Enroll your team');

insert into public.crm_campaigns (name, channel, audience, compliance_event, subject, status, automated, sent, opened, clicked, converted) values
('HOTMA readiness — enterprise VPs','email','Enterprise non-subscribers · VP Property Management','HOTMA Sections 102/104 full compliance','HOTMA is live — is your income determination process actually compliant?','sending',false,1840,912,317,24),
('Trial ended · 24-hour reminder','email','Trials that expired in the last 24 hours','Trial expiry','Your CertifyIQ trial data is held for 14 more days','active',true,412,301,168,39),
('Grace period · day 10 notice','email','Trials in the 14-day retention hold','Trial expiry','10 days until your uploads are permanently deleted','active',true,196,141,83,17),
('AOC season warm-up','email','LIHTC owners & asset managers','Form 8609 / AOC filing season','Your AOC season, minus the fire drill','scheduled',false,0,0,0,0);

insert into public.crm_news (kind, headline, detail, source, published_at) values
('federal','HUD publishes updated FY income limits — all 50 state rule packs re-synced in CertifyIQ','Certifications dated on or after the effective date are automatically re-scored against the new limits.','HUD', now() - interval '2 hours'),
('federal','HOTMA asset and income provisions in full enforcement for LIHTC and multifamily programs','Legacy asset imputation logic is the most common finding CertifyIQ catches post-HOTMA.','IRS / HUD', now() - interval '9 hours'),
('federal','IRS reminder: Form 8823 categories updated for owner certification season','Uncorrected TICs remain the top-cited noncompliance category.','IRS', now() - interval '1 day'),
('federal','NSPIRE scoring guidance clarified for affordable portfolios','File-side documentation continues to weigh into inspection outcomes.','HUD REAC', now() - interval '2 days'),
('subscriber','Wallick Communities subscribed — Business plan, 15,000 units','Onboarding started in LaunchPad.','CertifyIQ billing', now() - interval '5 hours'),
('subscriber','Granite Row Communities subscribed — Professional plan','Converted from trial reminder email.','CertifyIQ billing', now() - interval '1 day');