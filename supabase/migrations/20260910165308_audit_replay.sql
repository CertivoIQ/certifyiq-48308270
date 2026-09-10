-- Phase 5: immutable, tenant-scoped Audit Replay projection.
-- Existing evidence_manifests remain the Evidence Record of truth. Replay rows
-- retain point-in-time references and versions; they do not replace that record.

create table public.audit_replay_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id text not null,
  certification_item_id uuid not null references public.certification_import_items(id) on delete restrict,
  property_id text,
  event_type text not null check (event_type in (
    'certification_uploaded','documents_uploaded','document_classified',
    'extraction_completed','deterministic_rules_executed','finding_created',
    'evidence_added','correction_submitted','finding_resolved',
    'reviewer_action','approval','evidence_record_finalized'
  )),
  source_table text not null,
  source_id text not null,
  occurred_at timestamptz not null,
  rule_version text,
  source_version text,
  calculation_inputs jsonb not null default '{}'::jsonb,
  evidence_state jsonb not null default '{}'::jsonb,
  engine_version text,
  evidence_manifest_id uuid references public.evidence_manifests(id) on delete restrict,
  event_snapshot jsonb not null default '{}'::jsonb,
  event_sha256 text not null check (event_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz not null default now(),
  unique (source_table, source_id, event_type)
);

create index audit_replay_events_owner_item_time_idx
  on public.audit_replay_events (user_id, certification_item_id, occurred_at, id);
create index audit_replay_events_organization_time_idx
  on public.audit_replay_events (organization_id, occurred_at, id);
create index audit_replay_events_property_time_idx
  on public.audit_replay_events (property_id, occurred_at, id) where property_id is not null;
create index audit_replay_events_manifest_idx
  on public.audit_replay_events (evidence_manifest_id) where evidence_manifest_id is not null;

alter table public.audit_replay_events enable row level security;
revoke all on public.audit_replay_events from public, anon, authenticated;
grant select on public.audit_replay_events to authenticated;
grant all on public.audit_replay_events to service_role;

create policy "Owners read audit replay"
on public.audit_replay_events for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Staff read audit replay"
on public.audit_replay_events for select to authenticated
using ((select public.has_role((select auth.uid()), 'staff')));

create or replace function private.record_audit_replay_event(
  _user_id uuid, _organization_id text, _certification_item_id uuid,
  _property_id text, _event_type text, _source_table text, _source_id text,
  _occurred_at timestamptz, _rule_version text default null,
  _source_version text default null, _calculation_inputs jsonb default '{}'::jsonb,
  _evidence_state jsonb default '{}'::jsonb, _engine_version text default null,
  _evidence_manifest_id uuid default null, _event_snapshot jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = ''
as $$
declare _canonical jsonb;
begin
  if _user_id is null or _certification_item_id is null then
    raise exception 'Audit Replay requires an owning user and certification';
  end if;
  if not exists (
    select 1 from public.certification_import_items i
    where i.id = _certification_item_id and i.user_id = _user_id
  ) then
    raise exception 'Audit Replay ownership mismatch';
  end if;
  _canonical := jsonb_build_object(
    'user_id',_user_id,'organization_id',_organization_id,
    'certification_item_id',_certification_item_id,'property_id',_property_id,
    'event_type',_event_type,'source_table',_source_table,'source_id',_source_id,
    'occurred_at',_occurred_at,'rule_version',_rule_version,
    'source_version',_source_version,'calculation_inputs',coalesce(_calculation_inputs,'{}'::jsonb),
    'evidence_state',coalesce(_evidence_state,'{}'::jsonb),'engine_version',_engine_version,
    'evidence_manifest_id',_evidence_manifest_id,'event_snapshot',coalesce(_event_snapshot,'{}'::jsonb)
  );
  insert into public.audit_replay_events(
    user_id,organization_id,certification_item_id,property_id,event_type,
    source_table,source_id,occurred_at,rule_version,source_version,
    calculation_inputs,evidence_state,engine_version,evidence_manifest_id,
    event_snapshot,event_sha256
  ) values (
    _user_id,coalesce(nullif(_organization_id,''),_user_id::text),
    _certification_item_id,_property_id,_event_type,_source_table,_source_id,
    _occurred_at,_rule_version,_source_version,coalesce(_calculation_inputs,'{}'::jsonb),
    coalesce(_evidence_state,'{}'::jsonb),_engine_version,_evidence_manifest_id,
    coalesce(_event_snapshot,'{}'::jsonb),
    encode(extensions.digest(convert_to(_canonical::text,'UTF8'),'sha256'),'hex')
  ) on conflict (source_table,source_id,event_type) do nothing;
end;
$$;
revoke all on function private.record_audit_replay_event(
  uuid,text,uuid,text,text,text,text,timestamptz,text,text,jsonb,jsonb,text,uuid,jsonb
) from public,anon,authenticated,service_role;

create or replace function private.capture_audit_replay_import()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.record_audit_replay_event(
      new.user_id,new.user_id::text,new.id,new.property_id::text,
      'certification_uploaded','public.certification_import_items',new.id::text,
      new.created_at,null,new.sha256,'{}'::jsonb,
      jsonb_build_object('file_name',new.original_file_name,'sha256',new.sha256),
      null,null,jsonb_build_object('status',new.status,'mime_type',new.mime_type,'size_bytes',new.size_bytes)
    );
  end if;
  if new.processed_at is not null and (tg_op = 'INSERT' or old.processed_at is null) then
    perform private.record_audit_replay_event(
      new.user_id,new.user_id::text,new.id,new.property_id::text,
      'extraction_completed','public.certification_import_items',new.id::text,
      new.processed_at,null,new.sha256,new.extracted_data,
      jsonb_build_object('findings',new.findings,'confidence',new.confidence),
      new.extraction_provider,null,jsonb_build_object('status',new.status,'provider',new.extraction_provider)
    );
  end if;
  return new;
end;
$$;
create trigger capture_audit_replay_import
after insert or update of processed_at on public.certification_import_items
for each row execute function private.capture_audit_replay_import();

create or replace function private.capture_audit_replay_document()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.record_audit_replay_event(
    new.user_id,new.organization_id,new.certification_item_id,null,
    'documents_uploaded','public.certification_document_instances',new.id::text,
    new.created_at,null,new.document_sha256,'{}'::jsonb,
    jsonb_build_object('document_sha256',new.document_sha256,'review_status',new.review_status),
    null,null,jsonb_build_object('form_code',new.detected_form_code,'revision',new.detected_revision)
  );
  if new.recognition_status not in ('pending','unknown') then
    perform private.record_audit_replay_event(
      new.user_id,new.organization_id,new.certification_item_id,null,
      'document_classified','public.certification_document_instances',new.id::text,
      coalesce(new.reviewed_at,new.created_at),new.detected_revision,new.document_sha256,
      '{}'::jsonb,jsonb_build_object('recognition_status',new.recognition_status,'confidence',new.confidence),
      null,null,jsonb_build_object('form_code',new.detected_form_code,'source_page',new.source_page)
    );
  end if;
  return new;
end;
$$;
create trigger capture_audit_replay_document
after insert on public.certification_document_instances
for each row execute function private.capture_audit_replay_document();

create or replace function private.capture_audit_replay_finding()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare _item public.certification_import_items;
begin
  select * into _item from public.certification_import_items where id=new.item_id;
  perform private.record_audit_replay_event(
    new.user_id,new.organization_id,new.item_id,_item.property_id::text,
    'deterministic_rules_executed','public.compliance_findings',new.id::text,
    new.created_at,new.rule_version,new.rule_pack_version,_item.extracted_data,
    new.evidence_refs,new.engine_build,null,
    jsonb_build_object('rule_id',new.rule_id,'rule_pack_id',new.rule_pack_id,'outcome',new.status)
  );
  perform private.record_audit_replay_event(
    new.user_id,new.organization_id,new.item_id,_item.property_id::text,
    'finding_created','public.compliance_findings',new.id::text,
    new.created_at,new.rule_version,new.rule_pack_version,_item.extracted_data,
    new.evidence_refs,new.engine_build,null,
    jsonb_build_object('severity',new.severity,'status',new.status,'explanation',new.explanation)
  );
  return new;
end;
$$;
create trigger capture_audit_replay_finding
after insert on public.compliance_findings
for each row execute function private.capture_audit_replay_finding();

create or replace function private.capture_audit_replay_workflow_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  _case public.certification_workflow_cases;
  _item public.certification_import_items;
  _finding public.compliance_findings;
  _normalized text;
begin
  select * into _case from public.certification_workflow_cases where id=new.case_id;
  select * into _item from public.certification_import_items where id=_case.certification_item_id;
  if new.finding_id is not null then
    select * into _finding from public.compliance_findings where id=new.finding_id;
  end if;
  _normalized := case
    when new.event_type='finding_resolved' then 'finding_resolved'
    when new.event_type in ('manager_final_approved','final_review_confirmed') then 'approval'
    when new.event_type like '%correction%' then 'correction_submitted'
    when new.event_type like '%evidence%' then 'evidence_added'
    else 'reviewer_action'
  end;
  perform private.record_audit_replay_event(
    _item.user_id,coalesce(_finding.organization_id,_item.user_id::text),
    _item.id,_item.property_id::text,_normalized,
    'public.certification_workflow_events',new.id::text,new.occurred_at,
    _finding.rule_version,_finding.rule_pack_version,_item.extracted_data,
    coalesce(_finding.evidence_refs,'{}'::jsonb),_finding.engine_build,null,
    jsonb_build_object('workflow_event_type',new.event_type,'detail',new.detail,'actor_id',new.actor_id)
  );
  return new;
end;
$$;
create trigger capture_audit_replay_workflow_event
after insert on public.certification_workflow_events
for each row execute function private.capture_audit_replay_workflow_event();

create or replace function private.capture_audit_replay_review()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare _finding public.compliance_findings; _item public.certification_import_items;
begin
  select * into _finding from public.compliance_findings where id=new.finding_id;
  select * into _item from public.certification_import_items where id=_finding.item_id;
  perform private.record_audit_replay_event(
    _finding.user_id,_finding.organization_id,_finding.item_id,_item.property_id::text,
    'reviewer_action','public.finding_reviews',new.id::text,new.created_at,
    _finding.rule_version,_finding.rule_pack_version,_item.extracted_data,
    _finding.evidence_refs,_finding.engine_build,null,
    jsonb_build_object('decision',new.decision,'reason',new.reason,'reviewer_id',new.reviewer_id,
      'manifest_sha256',new.manifest_sha256,'expires_at',new.expires_at,'revoked_at',new.revoked_at)
  );
  return new;
end;
$$;
create trigger capture_audit_replay_review
after insert on public.finding_reviews
for each row execute function private.capture_audit_replay_review();

create or replace function private.capture_audit_replay_manifest()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare _item public.certification_import_items;
begin
  select * into _item from public.certification_import_items i
  where i.user_id=new.user_id
    and (i.id::text=new.certification_id or i.matched_certification_id::text=new.certification_id)
  order by i.created_at desc limit 1;
  if _item.id is null then return new; end if;
  perform private.record_audit_replay_event(
    new.user_id,new.organization_id,_item.id,coalesce(new.property_id,_item.property_id::text),
    'evidence_record_finalized','public.evidence_manifests',new.id::text,new.created_at,
    new.manifest->>'rule_version',new.manifest->>'source_version',
    coalesce(new.manifest->'calculation_inputs','{}'::jsonb),
    jsonb_build_object('manifest_sha256',new.manifest_sha256,'outcome',new.outcome),
    new.engine_build,new.id,
    jsonb_build_object('review_id',new.review_id,'certification_id',new.certification_id)
  );
  return new;
end;
$$;
create trigger capture_audit_replay_manifest
after insert on public.evidence_manifests
for each row execute function private.capture_audit_replay_manifest();

create or replace function public.audit_replay_timeline(
  _certification_item_id uuid,_as_of timestamptz default now()
)
returns setof public.audit_replay_events
language sql stable security invoker set search_path = ''
as $$
  select e.* from public.audit_replay_events e
  where e.certification_item_id=_certification_item_id and e.occurred_at<=_as_of
  order by e.occurred_at,e.id;
$$;
revoke all on function public.audit_replay_timeline(uuid,timestamptz) from public,anon;
grant execute on function public.audit_replay_timeline(uuid,timestamptz) to authenticated;

create or replace function private.block_audit_replay_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin raise exception 'Audit Replay history is immutable.'; end;
$$;
revoke all on function private.block_audit_replay_mutation()
  from public,anon,authenticated,service_role;
create trigger audit_replay_events_immutable
before update or delete on public.audit_replay_events
for each row execute function private.block_audit_replay_mutation();

-- Backfill the existing certification lifecycle without changing source records.
do $$
declare r record; n text;
begin
  for r in select * from public.certification_import_items loop
    perform private.record_audit_replay_event(
      r.user_id,r.user_id::text,r.id,r.property_id::text,'certification_uploaded',
      'public.certification_import_items',r.id::text,r.created_at,null,r.sha256,
      '{}'::jsonb,jsonb_build_object('file_name',r.original_file_name,'sha256',r.sha256),
      null,null,jsonb_build_object('status',r.status,'mime_type',r.mime_type,'size_bytes',r.size_bytes)
    );
    if r.processed_at is not null then
      perform private.record_audit_replay_event(
        r.user_id,r.user_id::text,r.id,r.property_id::text,'extraction_completed',
        'public.certification_import_items',r.id::text,r.processed_at,null,r.sha256,
        r.extracted_data,jsonb_build_object('findings',r.findings,'confidence',r.confidence),
        r.extraction_provider,null,jsonb_build_object('status',r.status,'provider',r.extraction_provider)
      );
    end if;
  end loop;

  for r in
    select f.*,i.property_id,i.extracted_data
    from public.compliance_findings f join public.certification_import_items i on i.id=f.item_id
  loop
    perform private.record_audit_replay_event(
      r.user_id,r.organization_id,r.item_id,r.property_id::text,
      'deterministic_rules_executed','public.compliance_findings',r.id::text,r.created_at,
      r.rule_version,r.rule_pack_version,r.extracted_data,r.evidence_refs,r.engine_build,null,
      jsonb_build_object('rule_id',r.rule_id,'rule_pack_id',r.rule_pack_id,'outcome',r.status)
    );
    perform private.record_audit_replay_event(
      r.user_id,r.organization_id,r.item_id,r.property_id::text,
      'finding_created','public.compliance_findings',r.id::text,r.created_at,
      r.rule_version,r.rule_pack_version,r.extracted_data,r.evidence_refs,r.engine_build,null,
      jsonb_build_object('severity',r.severity,'status',r.status,'explanation',r.explanation)
    );
  end loop;

  for r in
    select e.*,c.certification_item_id,i.user_id,i.property_id,i.extracted_data,
      f.organization_id,f.rule_version,f.rule_pack_version,f.evidence_refs,f.engine_build
    from public.certification_workflow_events e
    join public.certification_workflow_cases c on c.id=e.case_id
    join public.certification_import_items i on i.id=c.certification_item_id
    left join public.compliance_findings f on f.id=e.finding_id
  loop
    n := case when r.event_type='finding_resolved' then 'finding_resolved'
      when r.event_type in ('manager_final_approved','final_review_confirmed') then 'approval'
      when r.event_type like '%correction%' then 'correction_submitted'
      when r.event_type like '%evidence%' then 'evidence_added' else 'reviewer_action' end;
    perform private.record_audit_replay_event(
      r.user_id,coalesce(r.organization_id,r.user_id::text),r.certification_item_id,
      r.property_id::text,n,'public.certification_workflow_events',r.id::text,r.occurred_at,
      r.rule_version,r.rule_pack_version,r.extracted_data,coalesce(r.evidence_refs,'{}'::jsonb),
      r.engine_build,null,jsonb_build_object('workflow_event_type',r.event_type,'detail',r.detail,'actor_id',r.actor_id)
    );
  end loop;

  for r in
    select v.*,f.item_id,f.organization_id,f.rule_version,f.rule_pack_version,
      f.evidence_refs,f.engine_build,i.property_id,i.extracted_data
    from public.finding_reviews v
    join public.compliance_findings f on f.id=v.finding_id
    join public.certification_import_items i on i.id=f.item_id
  loop
    perform private.record_audit_replay_event(
      r.user_id,r.organization_id,r.item_id,r.property_id::text,'reviewer_action',
      'public.finding_reviews',r.id::text,r.created_at,r.rule_version,r.rule_pack_version,
      r.extracted_data,r.evidence_refs,r.engine_build,null,
      jsonb_build_object('decision',r.decision,'reason',r.reason,'reviewer_id',r.reviewer_id,
        'manifest_sha256',r.manifest_sha256,'expires_at',r.expires_at,'revoked_at',r.revoked_at)
    );
  end loop;

  for r in
    select m.*,i.id as item_id,i.property_id as item_property_id
    from public.evidence_manifests m
    join lateral (
      select x.id,x.property_id from public.certification_import_items x
      where x.user_id=m.user_id
        and (x.id::text=m.certification_id or x.matched_certification_id::text=m.certification_id)
      order by x.created_at desc limit 1
    ) i on true
  loop
    perform private.record_audit_replay_event(
      r.user_id,r.organization_id,r.item_id,coalesce(r.property_id,r.item_property_id::text),
      'evidence_record_finalized','public.evidence_manifests',r.id::text,r.created_at,
      r.manifest->>'rule_version',r.manifest->>'source_version',
      coalesce(r.manifest->'calculation_inputs','{}'::jsonb),
      jsonb_build_object('manifest_sha256',r.manifest_sha256,'outcome',r.outcome),
      r.engine_build,r.id,jsonb_build_object('review_id',r.review_id,'certification_id',r.certification_id)
    );
  end loop;
end;
$$;
