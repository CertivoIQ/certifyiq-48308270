-- Customer-facing CertivoIQ license numbers.
-- Internal UUID remains the database primary key.
-- Public format: CIQ-YYYY-NNNNNN (example: CIQ-2026-000001).

alter table public.enterprise_licenses
  add column if not exists license_number text;

create unique index if not exists enterprise_licenses_license_number_uq
  on public.enterprise_licenses (license_number)
  where license_number is not null;

create sequence if not exists public.enterprise_license_number_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no maxvalue
  cache 1;

create or replace function public.assign_enterprise_license_number()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  license_year text;
  sequence_value bigint;
begin
  -- Once issued, a customer-facing license number is immutable.
  if tg_op = 'UPDATE'
     and old.license_number is not null
     and new.license_number is distinct from old.license_number then
    raise exception 'enterprise license number is immutable';
  end if;

  -- Issue the number on first activation, never for pending/exception records.
  if new.status = 'active' and new.license_number is null then
    license_year := to_char(coalesce(new.activated_at, now()), 'YYYY');
    sequence_value := nextval('public.enterprise_license_number_seq');
    new.license_number := 'CIQ-' || license_year || '-' || lpad(sequence_value::text, 6, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists assign_enterprise_license_number on public.enterprise_licenses;
create trigger assign_enterprise_license_number
before insert or update of status, activated_at, license_number
on public.enterprise_licenses
for each row execute function public.assign_enterprise_license_number();

comment on column public.enterprise_licenses.license_number is
  'Immutable customer-facing CertivoIQ license identifier in CIQ-YYYY-NNNNNN format.';
