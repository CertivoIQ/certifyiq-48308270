-- Reproduce the production permission drift that made audit_readiness_score()
-- fail when compliance_remediation_actions RLS called the private assurance helper.

create or replace function private.certivoiq_assurance_reviewer(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$ select false; $$;

revoke all on function private.certivoiq_assurance_reviewer(uuid)
  from public,anon,authenticated;
grant execute on function private.certivoiq_assurance_reviewer(uuid)
  to service_role;

drop policy if exists owner_remediation on public.compliance_remediation_actions;
create policy owner_remediation
on public.compliance_remediation_actions
for select to authenticated
using (
  (select private.certivoiq_assurance_reviewer((select auth.uid())))
  or exists(
    select 1
    from public.compliance_findings f
    where f.id=finding_id
      and f.user_id=(select auth.uid())
  )
);
