-- Execute only after the paid-license integrity migration is present on an
-- isolated Supabase branch. Every fixture and assertion is rolled back.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'assertion failed: %', message;
  end if;
end;
$$;

select pg_temp.assert_true(
  has_sequence_privilege(
    'service_role',
    'public.enterprise_license_number_seq',
    'USAGE'
  ),
  'service_role must have license-number sequence usage'
);
select pg_temp.assert_true(
  not has_sequence_privilege(
    'authenticated',
    'public.enterprise_license_number_seq',
    'USAGE'
  ),
  'authenticated must not have license-number sequence usage'
);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'ciq-rls-1@example.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'ciq-rls-2@example.invalid');

insert into public.enterprise_licenses (
  organization_id,
  status,
  annual_price_cents,
  license_kind,
  licensed_state_codes,
  activated_at,
  exception_reason
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'active',
    15000000,
    'pha',
    array['CA'],
    now(),
    null
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'active',
    13000000,
    'multifamily_enterprise',
    array['AR','MS'],
    now(),
    null
  );

select pg_temp.assert_true(
  (select count(*) = 2 from public.enterprise_licenses where license_number like 'CIQ-%'),
  'active licenses must receive customer-facing license numbers'
);

do $$
begin
  begin
    insert into public.enterprise_licenses (
      organization_id,status,annual_price_cents,license_kind,licensed_state_codes
    ) values (
      '33333333-3333-4333-8333-333333333333','active',6500000,
      'multifamily_enterprise',array['XX']
    );
    raise exception 'invalid state code was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.enterprise_licenses (
      organization_id,status,annual_price_cents,license_kind,licensed_state_codes
    ) values (
      '44444444-4444-4444-8444-444444444444','active',13000000,
      'multifamily_enterprise',array['AR','AR']
    );
    raise exception 'duplicate state code was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.enterprise_licenses (
      organization_id,status,annual_price_cents,license_kind,licensed_state_codes
    ) values (
      '55555555-5555-4555-8555-555555555555','active',6500000,
      'multifamily_enterprise',array['AR','MS']
    );
    raise exception 'incorrect multifamily price was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.enterprise_licenses (
      organization_id,status,annual_price_cents,license_kind,licensed_state_codes
    ) values (
      '66666666-6666-4666-8666-666666666666','active',6500000,
      null,array[]::text[]
    );
    raise exception 'active null license kind was accepted';
  exception when check_violation then
    null;
  end;
end;
$$;

insert into public.enterprise_license_members (license_id,user_id,role)
select id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','admin'
from public.enterprise_licenses
where organization_id='11111111-1111-4111-8111-111111111111';

insert into public.enterprise_license_members (license_id,user_id,role)
select id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','admin'
from public.enterprise_licenses
where organization_id='22222222-2222-4222-8222-222222222222';

insert into public.account_access (
  user_id,environment,status,plan_id,price_id,license_kind,
  licensed_state_codes,access_until
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','live','active','pha','certivoiq_pha_monthly',
    'pha',array['CA'],now()+interval '1 month'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','live','active',
    'multifamily_enterprise','certivoiq_multifamily_state_monthly',
    'multifamily_enterprise',array['AR','MS'],now()+interval '1 month'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  true
);

select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.enterprise_licenses
  ),
  'tenant 1 must see exactly its own organization license'
);
select pg_temp.assert_true(
  not exists (
    select 1 from public.enterprise_licenses
    where organization_id='22222222-2222-4222-8222-222222222222'
  ),
  'tenant 1 must not see tenant 2 license'
);

do $$
begin
  begin
    perform count(*) from public.paid_license_entitlement_reconciliation;
    raise exception 'authenticated role read the service-only reconciliation view';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
select pg_temp.assert_true(
  (
    select count(*) = 2 and bool_and(entitlement_matches)
    from public.paid_license_entitlement_reconciliation
  ),
  'service reconciliation must match both derived entitlements'
);

rollback;


