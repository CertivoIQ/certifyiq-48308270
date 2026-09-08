-- Additions are prepaid through the existing annual contract end. They do not
-- change the remaining base-license monthly installments or auto-renew alone.
alter table public.enterprise_licenses add column base_state_codes text[];

create table public.enterprise_state_pack_orders (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.enterprise_licenses(id),
  purchaser_id uuid not null references auth.users(id),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  environment text not null check (environment in ('live','sandbox')),
  term_start timestamptz not null,
  term_end timestamptz not null,
  quoted_at timestamptz not null,
  amount_cents integer not null check (amount_cents between 50 and 6500000),
  status text not null default 'pending' check (status in ('pending','paid','expired','failed','refunded')),
  stripe_customer_id text not null,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  checkout_url text,
  checkout_expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (term_start <= quoted_at and quoted_at < term_end)
);
create unique index one_state_purchase_per_term on public.enterprise_state_pack_orders(license_id,state_code,term_end,environment) where status in ('pending','paid');
alter table public.enterprise_state_pack_orders enable row level security;
revoke all on public.enterprise_state_pack_orders from public,anon,authenticated;
grant all on public.enterprise_state_pack_orders to service_role;

create function private.refresh_state_pack_entitlements(target_license uuid)
returns void language plpgsql security definer set search_path='' as $$
declare license public.enterprise_licenses%rowtype; effective_states text[];
begin
  select * into strict license from public.enterprise_licenses where id=target_license for update;
  select array_agg(distinct code order by code) into effective_states from (
    select unnest(coalesce(license.base_state_codes,license.licensed_state_codes)) code
    union select state_code from public.enterprise_state_pack_orders where license_id=target_license and status='paid' and term_end>now()
  ) states;
  update public.enterprise_licenses set base_state_codes=coalesce(base_state_codes,license.licensed_state_codes),
    licensed_state_codes=effective_states,annual_price_cents=6500000::bigint*cardinality(effective_states),updated_at=now() where id=target_license;
  update public.account_access a set licensed_state_codes=effective_states,updated_at=now()
    where a.license_kind='multifamily_enterprise' and exists(select 1 from public.enterprise_license_members m where m.license_id=target_license and m.user_id=a.user_id);
end;
$$;
revoke all on function private.refresh_state_pack_entitlements(uuid) from public,anon,authenticated;
grant execute on function private.refresh_state_pack_entitlements(uuid) to service_role;

create function public.fulfill_enterprise_state_pack(target_order uuid, session_id text, payment_intent_id text, customer_id text, paid_cents integer, payment_environment text)
returns text language plpgsql security definer set search_path='' as $$
declare item public.enterprise_state_pack_orders%rowtype; license public.enterprise_licenses%rowtype;
begin
  select * into strict item from public.enterprise_state_pack_orders where id=target_order for update;
  if item.stripe_session_id is distinct from session_id or item.stripe_customer_id is distinct from customer_id or item.amount_cents<>paid_cents or item.environment<>payment_environment then
    raise exception 'Payment does not match the state order';
  end if;
  if item.status='paid' then return 'paid'; end if;
  if item.status<>'pending' then raise exception 'State order is not payable'; end if;
  select * into strict license from public.enterprise_licenses where id=item.license_id for update;
  if license.license_kind<>'multifamily_enterprise' or license.status<>'active' or license.paid_through is null or license.paid_through<=now() or item.term_end<=now() then
    raise exception 'License is not active';
  end if;
  if not exists(select 1 from (select * from public.state_rule_pack_releases where state_code=item.state_code and effective_from<=now() order by effective_from desc,created_at desc limit 1) r where r.status='validated' and r.approved_at is not null and r.failed_fixture_count=0 and r.unresolved_conflict_count=0 and r.validated_rule_count>0) then
    raise exception 'State pack is not available';
  end if;
  update public.enterprise_state_pack_orders set status='paid',stripe_payment_intent_id=payment_intent_id,paid_at=now() where id=target_order;
  perform private.refresh_state_pack_entitlements(item.license_id);
  return 'paid';
end;
$$;
revoke all on function public.fulfill_enterprise_state_pack(uuid,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.fulfill_enterprise_state_pack(uuid,text,text,text,integer,text) to service_role;

create function public.refund_enterprise_state_pack(payment_intent_id text, payment_environment text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.enterprise_state_pack_orders%rowtype;
begin
  select * into item from public.enterprise_state_pack_orders o where o.stripe_payment_intent_id=payment_intent_id and o.environment=payment_environment for update;
  if not found then return; end if;
  update public.enterprise_state_pack_orders set status='refunded' where id=item.id;
  perform private.refresh_state_pack_entitlements(item.license_id);
end;
$$;
revoke all on function public.refund_enterprise_state_pack(text,text) from public,anon,authenticated;
grant execute on function public.refund_enterprise_state_pack(text,text) to service_role;

-- Merge additions while the license row is locked, so a simultaneous base
-- installment cannot overwrite a just-confirmed purchase.
create function private.preserve_purchased_states() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.license_kind='multifamily_enterprise' and new.base_state_codes is not null then
    select array_agg(distinct code order by code) into new.licensed_state_codes from (
      select unnest(new.base_state_codes) code
      union select state_code from public.enterprise_state_pack_orders where license_id=new.id and status='paid' and term_end>now()
    ) states;
    new.annual_price_cents=6500000::bigint*cardinality(new.licensed_state_codes);
  end if;
  return new;
end;
$$;
revoke all on function private.preserve_purchased_states() from public,anon,authenticated;
create trigger preserve_purchased_states before update on public.enterprise_licenses for each row execute function private.preserve_purchased_states();

create function private.preserve_purchased_account_states() returns trigger
language plpgsql security definer set search_path='' as $$
declare effective_states text[];
begin
  if new.license_kind='multifamily_enterprise' then
    select array_agg(distinct state_code order by state_code) into effective_states
    from public.enterprise_state_pack_orders o join public.enterprise_license_members m on m.license_id=o.license_id
    where m.user_id=new.user_id and o.environment=new.environment and o.status='paid' and o.term_end>now();
    if effective_states is not null then
      select array_agg(distinct code order by code) into new.licensed_state_codes from unnest(new.licensed_state_codes||effective_states) code;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.preserve_purchased_account_states() from public,anon,authenticated;
create trigger preserve_purchased_account_states before insert or update on public.account_access for each row execute function private.preserve_purchased_account_states();
