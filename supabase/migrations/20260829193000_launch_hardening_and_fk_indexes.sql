-- Launch hardening: immutable function paths, FK coverage, and state-pack status parity.

alter function public.sync_workspace_overlays()
  set search_path = pg_catalog, public;

alter function public.derive_workspace_overlays(text[], text[])
  set search_path = pg_catalog, public;

do $$
declare
  fk record;
  index_name text;
  column_list text;
begin
  for fk in
    select
      c.oid,
      c.conrelid,
      c.conname,
      n.nspname,
      t.relname,
      c.conkey
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid
          and i.indisready
          and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] = c.conkey
      )
  loop
    select string_agg(format('%I', a.attname), ', ' order by u.ordinality)
      into column_list
    from unnest(fk.conkey) with ordinality as u(attnum, ordinality)
    join pg_attribute a
      on a.attrelid = fk.conrelid
     and a.attnum = u.attnum;

    index_name := left('idx_' || fk.relname || '_fk_', 48) || substr(md5(fk.conname), 1, 12);
    execute format(
      'create index if not exists %I on %I.%I (%s)',
      index_name,
      fk.nspname,
      fk.relname,
      column_list
    );
  end loop;
end
$$;

update public.state_rule_pack_candidates pack
set status = case
      when exists (
        select 1
        from public.state_rule_source_candidates source
        where source.state_code = pack.state_code
          and source.agent_verification_status = 'blocked'
      ) then 'blocked'
      when exists (
        select 1
        from public.state_rule_source_candidates source
        where source.state_code = pack.state_code
          and source.agent_verification_status not in ('verified', 'rejected')
      ) then 'agent_verification_in_progress'
      else 'verified'
    end,
    source_candidate_count = (
      select count(*)
      from public.state_rule_source_candidates source
      where source.state_code = pack.state_code
    ),
    blocked_source_count = (
      select count(*)
      from public.state_rule_source_candidates source
      where source.state_code = pack.state_code
        and source.agent_verification_status = 'blocked'
    ),
    candidate_manifest = coalesce(pack.candidate_manifest, '{}'::jsonb) || jsonb_build_object(
      'aggregate_status_reconciled_at', now(),
      'aggregate_status_source', 'state_rule_source_candidates',
      'activation_remains_fail_closed', true
    ),
    compliance_activation_allowed = false,
    updated_at = now();
