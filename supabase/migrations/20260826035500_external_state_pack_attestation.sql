alter table public.state_rule_pack_releases
  add column if not exists external_approval_attested boolean not null default false,
  add column if not exists external_approval_basis text,
  add column if not exists validated_commit_sha text,
  add column if not exists validation_workflow_run_id bigint;

create or replace function public.validate_pack_release()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status = 'validated' then
    if new.validated_rule_count < 1 then
      raise exception 'A validated state pack requires at least one validated rule.';
    end if;

    if new.approved_by is not null then
      if new.approved_at is null then
        raise exception 'Internal state-pack approval requires approval time.';
      end if;
    elsif new.external_approval_attested is true then
      if nullif(btrim(new.external_approval_basis), '') is null then
        raise exception 'External state-pack approval attestation requires an explicit basis.';
      end if;
    else
      raise exception 'A validated state pack requires internal approval or explicit external approval attestation.';
    end if;

    if new.validation_report_id is null and (
      new.validated_commit_sha !~ '^[0-9a-f]{40}$'
      or new.validation_workflow_run_id is null
    ) then
      raise exception 'A validated state pack requires a validation report or exact commit and workflow-run evidence.';
    end if;
  end if;
  return new;
end;
$function$;
