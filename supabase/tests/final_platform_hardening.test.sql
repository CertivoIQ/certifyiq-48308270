begin;

do $$
declare
  role_name text;
  relation_name text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    foreach relation_name in array array['public.customer_records', 'storage.objects']
    loop
      if has_table_privilege(role_name, relation_name, 'TRUNCATE') then
        raise exception '% retains TRUNCATE on %', role_name, relation_name;
      end if;
      if has_table_privilege(role_name, relation_name, 'REFERENCES') then
        raise exception '% retains REFERENCES on %', role_name, relation_name;
      end if;
      if has_table_privilege(role_name, relation_name, 'TRIGGER') then
        raise exception '% retains TRIGGER on %', role_name, relation_name;
      end if;
    end loop;
  end loop;

  if not has_table_privilege('authenticated', 'public.customer_records', 'SELECT') then
    raise exception 'data-plane SELECT was removed';
  end if;
  if not has_table_privilege('authenticated', 'public.customer_records', 'INSERT') then
    raise exception 'data-plane INSERT was removed';
  end if;
  if not has_table_privilege('service_role', 'public.customer_records', 'TRUNCATE') then
    raise exception 'service-role maintenance privilege was removed';
  end if;
end $$;

create table public.future_customer_records (id bigint primary key);

do $$
begin
  if has_table_privilege('anon', 'public.future_customer_records', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.future_customer_records', 'TRUNCATE')
     or has_table_privilege('anon', 'public.future_customer_records', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.future_customer_records', 'TRIGGER')
     or has_table_privilege('anon', 'public.future_customer_records', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.future_customer_records', 'REFERENCES') then
    raise exception 'future public table inherited structural client privileges';
  end if;
end $$;

rollback;
