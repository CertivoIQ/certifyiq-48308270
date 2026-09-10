-- Phase 6: temporary, scoped, read-only auditor access.
-- Auditors never receive direct privileges on customer compliance tables.

create table public.auditor_access_grants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id text not null,
  auditor_user_id uuid not null references auth.users(id) on delete restrict,
  scope_type text not null check (scope_type in ('enterprise','portfolio','property')),
  portfolio_ref text,
  property_ids text[] not null default '{}',
  program_codes text[] not null default '{}',
  date_from date not null,
  date_to date not null,
  include_approved_certifications boolean not null default true,
  include_evidence_records boolean not null default true,
  include_findings_remediation boolean not null default true,
  include_regulatory_citations boolean not null default true,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  grant_sha256 text not null check (grant_sha256 ~ '^[a-f0-9]{64}$'),
  check (owner_user_id <> auditor_user_id),
  check (date_to >= date_from),
  check (scope_type <> 'property' or cardinality(property_ids) > 0),
  check (revoked_at is null or revoked_at >= created_at)
);

create table public.auditor_access_events (
  id bigint generated always as identity primary key,
  grant_id uuid not null references public.auditor_access_grants(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  auditor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('grant_created','workspace_opened','grant_revoked','access_denied')),
  detail jsonb not null default '{}',
  event_sha256 text not null check (event_sha256 ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null default now()
);

create index auditor_access_grants_owner_expiry_idx
  on public.auditor_access_grants (owner_user_id, expires_at) where revoked_at is null;
create index auditor_access_grants_auditor_expiry_idx
  on public.auditor_access_grants (auditor_user_id, expires_at) where revoked_at is null;
create index auditor_access_grants_properties_gin_idx
  on public.auditor_access_grants using gin (property_ids);
create index auditor_access_grants_programs_gin_idx
  on public.auditor_access_grants using gin (program_codes);
create index auditor_access_events_grant_time_idx
  on public.auditor_access_events (grant_id, occurred_at, id);
create index auditor_access_events_owner_time_idx
  on public.auditor_access_events (owner_user_id, occurred_at, id);
create index auditor_access_events_auditor_time_idx
  on public.auditor_access_events (auditor_user_id, occurred_at, id);

alter table public.auditor_access_grants enable row level security;
alter table public.auditor_access_events enable row level security;
revoke all on public.auditor_access_grants,public.auditor_access_events
  from public,anon,authenticated;
grant select on public.auditor_access_grants,public.auditor_access_events
  to authenticated;
grant all on public.auditor_access_grants,public.auditor_access_events
  to service_role;

create policy "Grant owners and active auditors read grants"
on public.auditor_access_grants for select to authenticated
using (
  owner_user_id=(select auth.uid())
  or (
    auditor_user_id=(select auth.uid())
    and revoked_at is null and expires_at > now()
  )
);

create policy "Grant parties read access log"
on public.auditor_access_events for select to authenticated
using (
  owner_user_id=(select auth.uid())
  or auditor_user_id=(select auth.uid())
);

create or replace function private.record_auditor_access_event(
  _grant_id uuid,_owner_user_id uuid,_auditor_user_id uuid,_actor_id uuid,
  _event_type text,_detail jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path=''
as $$
declare _occurred_at timestamptz:=now(); _canonical jsonb;
begin
  _canonical:=jsonb_build_object(
    'grant_id',_grant_id,'owner_user_id',_owner_user_id,
    'auditor_user_id',_auditor_user_id,'actor_id',_actor_id,
    'event_type',_event_type,'detail',coalesce(_detail,'{}'::jsonb),
    'occurred_at',_occurred_at
  );
  insert into public.auditor_access_events(
    grant_id,owner_user_id,auditor_user_id,actor_id,event_type,detail,event_sha256,occurred_at
  ) values (
    _grant_id,_owner_user_id,_auditor_user_id,_actor_id,_event_type,
    coalesce(_detail,'{}'::jsonb),
    encode(extensions.digest(convert_to(_canonical::text,'UTF8'),'sha256'),'hex'),
    _occurred_at
  );
end;
$$;
revoke all on function private.record_auditor_access_event(uuid,uuid,uuid,uuid,text,jsonb)
  from public,anon,authenticated,service_role;

create or replace function public.create_auditor_access_grant(
  _owner_user_id uuid,_organization_id text,_auditor_user_id uuid,
  _scope_type text,_portfolio_ref text,_property_ids text[],_program_codes text[],
  _date_from date,_date_to date,_expires_at timestamptz,
  _include_approved_certifications boolean default true,
  _include_evidence_records boolean default true,
  _include_findings_remediation boolean default true,
  _include_regulatory_citations boolean default true
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare _actor uuid:=auth.uid(); _id uuid; _canonical jsonb;
begin
  if _actor is null then raise exception 'authentication required'; end if;
  if _actor <> _owner_user_id
     and not private.certification_is_manager(_actor,_owner_user_id) then
    raise exception 'customer administrator authority required';
  end if;
  if _auditor_user_id is null or _auditor_user_id=_owner_user_id then
    raise exception 'a distinct authenticated auditor is required';
  end if;
  if not exists(select 1 from auth.users where id=_auditor_user_id) then
    raise exception 'auditor account not found';
  end if;
  if _scope_type not in ('enterprise','portfolio','property') then
    raise exception 'invalid auditor scope';
  end if;
  if _date_from is null or _date_to is null or _date_to < _date_from then
    raise exception 'invalid audit date range';
  end if;
  if _expires_at <= now() or _expires_at > now()+interval '90 days' then
    raise exception 'auditor access must expire within 90 days';
  end if;
  if _scope_type='property' and cardinality(coalesce(_property_ids,'{}'))=0 then
    raise exception 'property scope requires at least one property';
  end if;
  if exists (
    select 1 from unnest(coalesce(_property_ids,'{}')) requested(id)
    where not exists (
      select 1 from public.portfolio_properties p
      where p.user_id=_owner_user_id and p.id::text=requested.id
    )
  ) then
    raise exception 'property scope contains an unauthorized property';
  end if;

  _id:=gen_random_uuid();
  _canonical:=jsonb_build_object(
    'id',_id,'owner_user_id',_owner_user_id,'organization_id',_organization_id,
    'auditor_user_id',_auditor_user_id,'scope_type',_scope_type,
    'portfolio_ref',_portfolio_ref,'property_ids',coalesce(_property_ids,'{}'),
    'program_codes',coalesce(_program_codes,'{}'),'date_from',_date_from,
    'date_to',_date_to,'expires_at',_expires_at,
    'include_approved_certifications',_include_approved_certifications,
    'include_evidence_records',_include_evidence_records,
    'include_findings_remediation',_include_findings_remediation,
    'include_regulatory_citations',_include_regulatory_citations,
    'created_by',_actor
  );
  insert into public.auditor_access_grants(
    id,owner_user_id,organization_id,auditor_user_id,scope_type,portfolio_ref,
    property_ids,program_codes,date_from,date_to,expires_at,
    include_approved_certifications,include_evidence_records,
    include_findings_remediation,include_regulatory_citations,created_by,grant_sha256
  ) values (
    _id,_owner_user_id,nullif(trim(_organization_id),''),_auditor_user_id,_scope_type,
    nullif(trim(_portfolio_ref),''),coalesce(_property_ids,'{}'),coalesce(_program_codes,'{}'),
    _date_from,_date_to,_expires_at,_include_approved_certifications,
    _include_evidence_records,_include_findings_remediation,
    _include_regulatory_citations,_actor,
    encode(extensions.digest(convert_to(_canonical::text,'UTF8'),'sha256'),'hex')
  );
  perform private.record_auditor_access_event(
    _id,_owner_user_id,_auditor_user_id,_actor,'grant_created',
    jsonb_build_object('scope_type',_scope_type,'expires_at',_expires_at)
  );
  return _id;
end;
$$;

create or replace function public.revoke_auditor_access_grant(_grant_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare _actor uuid:=auth.uid(); _grant public.auditor_access_grants;
begin
  if _actor is null then raise exception 'authentication required'; end if;
  select * into _grant from public.auditor_access_grants where id=_grant_id for update;
  if _grant.id is null then raise exception 'auditor grant not found'; end if;
  if _actor <> _grant.owner_user_id
     and not private.certification_is_manager(_actor,_grant.owner_user_id) then
    raise exception 'customer administrator authority required';
  end if;
  if _grant.revoked_at is null then
    update public.auditor_access_grants
      set revoked_at=now(),revoked_by=_actor where id=_grant_id;
    perform private.record_auditor_access_event(
      _grant.id,_grant.owner_user_id,_grant.auditor_user_id,_actor,
      'grant_revoked',jsonb_build_object('prior_expires_at',_grant.expires_at)
    );
  end if;
end;
$$;

create or replace function public.auditor_workspace_snapshot(_grant_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  _actor uuid:=auth.uid(); _grant public.auditor_access_grants;
  _certifications jsonb:='[]'::jsonb; _evidence jsonb:='[]'::jsonb;
  _findings jsonb:='[]'::jsonb; _remediation jsonb:='[]'::jsonb;
  _citations jsonb:='[]'::jsonb; _result jsonb;
begin
  if _actor is null then raise exception 'authentication required'; end if;
  select * into _grant from public.auditor_access_grants where id=_grant_id;
  if _grant.id is null then raise exception 'auditor grant not found'; end if;
  if _actor <> _grant.owner_user_id and _actor <> _grant.auditor_user_id then
    raise exception 'auditor grant does not authorize this account';
  end if;
  if _grant.revoked_at is not null then raise exception 'auditor grant revoked'; end if;
  if _grant.expires_at <= now() then raise exception 'auditor grant expired'; end if;

  create temporary table if not exists pg_temp.auditor_allowed_items(id uuid primary key) on commit drop;
  truncate pg_temp.auditor_allowed_items;
  insert into pg_temp.auditor_allowed_items(id)
  select i.id
  from public.certification_import_items i
  join public.certification_workflow_cases c on c.certification_item_id=i.id
  where i.user_id=_grant.owner_user_id
    and c.status='approved_filed'
    and i.created_at::date between _grant.date_from and _grant.date_to
    and (cardinality(_grant.property_ids)=0 or i.property_id::text=any(_grant.property_ids))
    and (cardinality(_grant.program_codes)=0 or i.program_codes && _grant.program_codes);

  if _grant.include_approved_certifications then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',i.id,'file_name',i.original_file_name,'property_id',i.property_id,
      'program_codes',i.program_codes,'status',c.status,'approved_on',c.approved_on,
      'audit_filed_at',c.audit_filed_at,'source_sha256',i.sha256
    ) order by c.audit_filed_at desc),'[]'::jsonb)
    into _certifications
    from pg_temp.auditor_allowed_items a
    join public.certification_import_items i on i.id=a.id
    join public.certification_workflow_cases c on c.certification_item_id=i.id;
  end if;

  if _grant.include_evidence_records then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'certification_id',m.certification_id,'property_id',m.property_id,
      'outcome',m.outcome,'engine_build',m.engine_build,
      'manifest_sha256',m.manifest_sha256,'created_at',m.created_at
    ) order by m.created_at desc),'[]'::jsonb)
    into _evidence
    from public.evidence_manifests m
    where m.user_id=_grant.owner_user_id
      and exists (
        select 1 from pg_temp.auditor_allowed_items a
        join public.certification_import_items i on i.id=a.id
        where i.id::text=m.certification_id or i.matched_certification_id::text=m.certification_id
      );
  end if;

  if _grant.include_findings_remediation then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',f.id,'certification_item_id',f.item_id,'rule_id',f.rule_id,
      'rule_version',f.rule_version,'rule_pack_version',f.rule_pack_version,
      'status',f.status,'severity',f.severity,'explanation',f.explanation,
      'evidence_refs',f.evidence_refs,'review_state',f.review_state
    ) order by f.created_at),'[]'::jsonb)
    into _findings
    from public.compliance_findings f
    where exists(select 1 from pg_temp.auditor_allowed_items a where a.id=f.item_id);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',r.id,'finding_id',r.finding_id,'finding_ref',r.finding_ref,
      'citation',r.citation,'severity',r.severity,'status',r.status,
      'remediation_plan',r.remediation_plan,'due_at',r.due_at,
      'verified_at',r.verified_at,'closed_at',r.closed_at
    ) order by r.created_at),'[]'::jsonb)
    into _remediation
    from public.compliance_remediation_actions r
    where r.finding_id in (
      select f.id from public.compliance_findings f
      join pg_temp.auditor_allowed_items a on a.id=f.item_id
    );
  end if;

  if _grant.include_regulatory_citations then
    select coalesce(jsonb_agg(distinct jsonb_build_object(
      'rule_id',f.rule_id,'rule_version',f.rule_version,
      'rule_pack_id',f.rule_pack_id,'rule_pack_version',f.rule_pack_version,
      'jurisdiction',f.jurisdiction
    )),'[]'::jsonb)
    into _citations
    from public.compliance_findings f
    where exists(select 1 from pg_temp.auditor_allowed_items a where a.id=f.item_id);
  end if;

  _result:=jsonb_build_object(
    'grant',jsonb_build_object(
      'id',_grant.id,'organization_id',_grant.organization_id,
      'scope_type',_grant.scope_type,'portfolio_ref',_grant.portfolio_ref,
      'property_ids',_grant.property_ids,'program_codes',_grant.program_codes,
      'date_from',_grant.date_from,'date_to',_grant.date_to,
      'expires_at',_grant.expires_at,'read_only',true
    ),
    'approved_certifications',_certifications,'evidence_records',_evidence,
    'findings',_findings,'remediation',_remediation,'regulatory_citations',_citations
  );
  perform private.record_auditor_access_event(
    _grant.id,_grant.owner_user_id,_grant.auditor_user_id,_actor,
    'workspace_opened',jsonb_build_object(
      'approved_certification_count',jsonb_array_length(_certifications),
      'evidence_record_count',jsonb_array_length(_evidence),
      'finding_count',jsonb_array_length(_findings)
    )
  );
  return _result;
end;
$$;

revoke all on function public.create_auditor_access_grant(
  uuid,text,uuid,text,text,text[],text[],date,date,timestamptz,boolean,boolean,boolean,boolean
) from public,anon;
revoke all on function public.revoke_auditor_access_grant(uuid) from public,anon;
revoke all on function public.auditor_workspace_snapshot(uuid) from public,anon;
grant execute on function public.create_auditor_access_grant(
  uuid,text,uuid,text,text,text[],text[],date,date,timestamptz,boolean,boolean,boolean,boolean
) to authenticated;
grant execute on function public.revoke_auditor_access_grant(uuid) to authenticated;
grant execute on function public.auditor_workspace_snapshot(uuid) to authenticated;

create or replace function private.block_auditor_access_event_mutation()
returns trigger language plpgsql set search_path=''
as $$
begin raise exception 'Auditor access history is immutable.'; end;
$$;
revoke all on function private.block_auditor_access_event_mutation()
  from public,anon,authenticated,service_role;
create trigger auditor_access_events_immutable
before update or delete on public.auditor_access_events
for each row execute function private.block_auditor_access_event_mutation();
