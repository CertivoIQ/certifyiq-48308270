-- Preserve RLS semantics while evaluating Auth helper calls once per statement.

do $$
declare
  policy_row record;
  new_qual text;
  new_check text;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (
          concat_ws(' ', qual, with_check) like '%auth.uid()%'
          and lower(concat_ws(' ', qual, with_check)) not like '%select auth.uid()%'
        )
        or (
          concat_ws(' ', qual, with_check) like '%auth.jwt()%'
          and lower(concat_ws(' ', qual, with_check)) not like '%select auth.jwt()%'
        )
      )
  loop
    new_qual := policy_row.qual;
    new_check := policy_row.with_check;

    if new_qual is not null then
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
      new_qual := replace(new_qual, 'auth.jwt()', '(select auth.jwt())');
      execute format(
        'alter policy %I on %I.%I using (%s)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        new_qual
      );
    end if;

    if new_check is not null then
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
      new_check := replace(new_check, 'auth.jwt()', '(select auth.jwt())');
      execute format(
        'alter policy %I on %I.%I with check (%s)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        new_check
      );
    end if;
  end loop;
end
$$;
