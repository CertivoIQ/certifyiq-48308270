-- Rollback-only production UAT for customer isolation and staff visibility.
-- Safe to run against production: all synthetic auth and application rows are
-- created inside this transaction and removed by the final ROLLBACK.

begin;

create temporary table uat_results (
  persona text primary key,
  result jsonb not null
) on commit drop;
grant insert, select on pg_temp.uat_results to authenticated;

insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'uat-a@certivoiq.invalid', now(), now(), now()),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'uat-b@certivoiq.invalid', now(), now(), now()),
  ('00000000-0000-4000-8000-0000000000c3', 'authenticated', 'authenticated', 'uat-staff@certivoiq.invalid', now(), now(), now());

insert into public.support_cases (user_id, subject, description, channel)
values
  ('00000000-0000-4000-8000-0000000000a1', 'UAT tenant A', 'rollback-only fixture', 'web'),
  ('00000000-0000-4000-8000-0000000000b2', 'UAT tenant B', 'rollback-only fixture', 'web');

insert into public.subscriptions (
  user_id, stripe_subscription_id, stripe_customer_id,
  product_id, price_id, status, environment
)
values
  ('00000000-0000-4000-8000-0000000000a1', 'sub_uat_a', 'cus_uat_a', 'prod_uat', 'price_uat', 'active', 'sandbox'),
  ('00000000-0000-4000-8000-0000000000b2', 'sub_uat_b', 'cus_uat_b', 'prod_uat', 'price_uat', 'active', 'sandbox');

insert into public.user_roles (user_id, role)
values ('00000000-0000-4000-8000-0000000000c3', 'staff');
insert into public.crm_staff_access (user_id, access_level, status)
values ('00000000-0000-4000-8000-0000000000c3', 'admin', 'active');

create function pg_temp.capture_uat(other_user uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  support_visible integer;
  subscriptions_visible integer;
  state_packs_visible integer;
  cross_tenant_write_blocked boolean := false;
  founder_claim jsonb;
begin
  select count(*) into support_visible
  from public.support_cases where subject like 'UAT tenant %';
  select count(*) into subscriptions_visible
  from public.subscriptions where stripe_subscription_id like 'sub_uat_%';
  select count(*) into state_packs_visible
  from public.state_rule_pack_candidates;

  begin
    insert into public.support_cases (user_id, subject, description, channel)
    values (other_user, 'UAT forbidden cross-tenant write', 'must be blocked for customers', 'web');
  exception when insufficient_privilege then
    cross_tenant_write_blocked := true;
  end;

  founder_claim := public.claim_certivoiq_founder_admin();
  return jsonb_build_object(
    'support_visible', support_visible,
    'subscriptions_visible', subscriptions_visible,
    'state_packs_visible', state_packs_visible,
    'cross_tenant_write_blocked', cross_tenant_write_blocked,
    'can_probe_other_admin', public.crm_staff_is_admin(other_user),
    'self_is_admin', public.crm_staff_is_admin(auth.uid()),
    'founder_bootstrap_retired', founder_claim->>'reason' = 'founder_bootstrap_retired'
  );
end
$$;
grant execute on function pg_temp.capture_uat(uuid) to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
insert into pg_temp.uat_results
values ('customer_a', pg_temp.capture_uat('00000000-0000-4000-8000-0000000000b2'));

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true);
insert into pg_temp.uat_results
values ('customer_b', pg_temp.capture_uat('00000000-0000-4000-8000-0000000000a1'));

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c3', true);
insert into pg_temp.uat_results
values ('staff_admin', pg_temp.capture_uat('00000000-0000-4000-8000-0000000000a1'));
reset role;

do $$
declare
  a jsonb;
  b jsonb;
  staff jsonb;
begin
  select result into a from pg_temp.uat_results where persona = 'customer_a';
  select result into b from pg_temp.uat_results where persona = 'customer_b';
  select result into staff from pg_temp.uat_results where persona = 'staff_admin';

  if (a->>'support_visible')::integer <> 1
     or (a->>'subscriptions_visible')::integer <> 1
     or (a->>'state_packs_visible')::integer <> 0
     or not (a->>'cross_tenant_write_blocked')::boolean then
    raise exception 'Customer A tenant isolation failed: %', a;
  end if;
  if (b->>'support_visible')::integer <> 1
     or (b->>'subscriptions_visible')::integer <> 1
     or (b->>'state_packs_visible')::integer <> 0
     or not (b->>'cross_tenant_write_blocked')::boolean then
    raise exception 'Customer B tenant isolation failed: %', b;
  end if;
  if (staff->>'support_visible')::integer <> 2
     or (staff->>'subscriptions_visible')::integer <> 2
     or (staff->>'state_packs_visible')::integer <> 50
     or (staff->>'cross_tenant_write_blocked')::boolean
     or not (staff->>'self_is_admin')::boolean then
    raise exception 'Staff administrative visibility failed: %', staff;
  end if;
  if (a->>'can_probe_other_admin')::boolean
     or (b->>'can_probe_other_admin')::boolean
     or (staff->>'can_probe_other_admin')::boolean then
    raise exception 'Cross-user role probing was not blocked';
  end if;
  if not (a->>'founder_bootstrap_retired')::boolean
     or not (b->>'founder_bootstrap_retired')::boolean
     or not (staff->>'founder_bootstrap_retired')::boolean then
    raise exception 'Founder bootstrap retirement regressed';
  end if;
end
$$;

select persona, result from pg_temp.uat_results order by persona;
rollback;
