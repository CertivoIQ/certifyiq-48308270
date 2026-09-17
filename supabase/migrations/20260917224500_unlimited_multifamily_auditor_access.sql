-- Paid Multifamily Enterprise auditor entitlement.
-- There is intentionally no auditor seat count or per-license auditor cap.
-- Each auditor remains a distinct authenticated user with an independently scoped,
-- expiring, revocable and logged read-only grant.

create or replace function private.paid_multifamily_auditor_license(
  _owner_user_id uuid,
  _actor uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  _license_id uuid;
begin
  select l.id
  into _license_id
  from public.enterprise_license_members owner_member
  join public.enterprise_licenses l on l.id=owner_member.license_id
  join public.enterprise_license_members actor_member
    on actor_member.license_id=l.id
   and actor_member.user_id=_actor
   and actor_member.role='admin'
  where owner_member.user_id=_owner_user_id
    and owner_member.role='admin'
    and l.license_kind='multifamily_enterprise'
    and l.status='active'
    and l.paid_through is not null
    and l.paid_through > now()
  order by l.paid_through desc,l.id
  limit 1;

  if _license_id is null then
    raise exception 'An active paid Multifamily Enterprise license administrator is required';
  end if;

  return _license_id;
end;
$$;

revoke all on function private.paid_multifamily_auditor_license(uuid,uuid)
  from public,anon,authenticated;

create or replace function private.enforce_paid_multifamily_auditor_grant()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  _license_id uuid;
  _organization_id uuid;
begin
  _license_id:=private.paid_multifamily_auditor_license(new.owner_user_id,new.created_by);
  select organization_id into strict _organization_id
  from public.enterprise_licenses
  where id=_license_id;

  new.organization_id:=_organization_id::text;
  return new;
end;
$$;

revoke all on function private.enforce_paid_multifamily_auditor_grant()
  from public,anon,authenticated,service_role;

drop trigger if exists enforce_paid_multifamily_auditor_grant
  on public.auditor_access_grants;
create trigger enforce_paid_multifamily_auditor_grant
before insert on public.auditor_access_grants
for each row execute function private.enforce_paid_multifamily_auditor_grant();

create or replace function public.create_auditor_access_grants(
  _owner_user_id uuid,_organization_id text,_auditor_user_ids uuid[],
  _scope_type text,_portfolio_ref text,_property_ids text[],_program_codes text[],
  _date_from date,_date_to date,_expires_at timestamptz,
  _include_approved_certifications boolean default true,
  _include_evidence_records boolean default true,
  _include_findings_remediation boolean default true,
  _include_regulatory_citations boolean default true
)
returns uuid[]
language plpgsql
security invoker
set search_path=''
as $$
declare
  _auditor_user_id uuid;
  _grant_id uuid;
  _grant_ids uuid[]:='{}'::uuid[];
begin
  if coalesce(cardinality(_auditor_user_ids),0)=0 then
    raise exception 'At least one authenticated auditor account ID is required';
  end if;

  for _auditor_user_id in
    select distinct auditor_id
    from unnest(_auditor_user_ids) as requested(auditor_id)
    where auditor_id is not null
    order by auditor_id
  loop
    _grant_id:=public.create_auditor_access_grant(
      _owner_user_id,_organization_id,_auditor_user_id,
      _scope_type,_portfolio_ref,_property_ids,_program_codes,
      _date_from,_date_to,_expires_at,
      _include_approved_certifications,_include_evidence_records,
      _include_findings_remediation,_include_regulatory_citations
    );
    _grant_ids:=array_append(_grant_ids,_grant_id);
  end loop;

  if cardinality(_grant_ids)=0 then
    raise exception 'At least one authenticated auditor account ID is required';
  end if;

  return _grant_ids;
end;
$$;

revoke all on function public.create_auditor_access_grants(
  uuid,text,uuid[],text,text,text[],text[],date,date,timestamptz,boolean,boolean,boolean,boolean
) from public,anon;
grant execute on function public.create_auditor_access_grants(
  uuid,text,uuid[],text,text,text[],text[],date,date,timestamptz,boolean,boolean,boolean,boolean
) to authenticated;

comment on function public.create_auditor_access_grants(
  uuid,text,uuid[],text,text,text[],text[],date,date,timestamptz,boolean,boolean,boolean,boolean
) is 'Creates any number of individually authenticated, scoped, read-only auditor grants for an active paid Multifamily Enterprise license. No auditor seat cap is enforced.';
