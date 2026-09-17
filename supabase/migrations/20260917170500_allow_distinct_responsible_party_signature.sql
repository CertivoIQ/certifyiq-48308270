-- A responsible party's typed signature may be their legal/full signature and does
-- not need to exactly match the display name used on the final-review record.
-- Name, position/title, and signature remain mandatory and are preserved in the
-- immutable confirmation and audit manifest.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
  into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'approve_certification_final'
    and p.prokind = 'f'
  limit 1;

  if v_def is null then
    raise exception 'approve_certification_final not found';
  end if;

  v_def := replace(
    v_def,
    '  if lower(_signed)<>lower(_name) then raise exception ''typed signature must match the responsible party name''; end if;' || chr(10),
    ''
  );

  execute v_def;
end $$;
