-- Future-state document intelligence foundation.
-- This registry is deliberately fail-closed: a recognized form is not treated as
-- production-supported until its official source, revision/effective dates,
-- required fields, signatures, and validation fixtures are controlled.

create table if not exists public.compliance_form_registry (
  id uuid primary key default gen_random_uuid(),
  form_code text not null check (char_length(form_code) between 2 and 80),
  form_name text not null check (char_length(form_name) between 2 and 240),
  form_family text not null check (form_family in (
    'tenant_certification',
    'consent',
    'management_occupancy_review',
    'pha_reporting',
    'lease_addendum_notice',
    'policy_document',
    'other'
  )),
  issuing_authority text not null default 'HUD',
  program_codes text[] not null default '{}'::text[],
  revision_label text not null default 'source validation required',
  effective_from date,
  effective_to date,
  source_url text,
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  required_fields jsonb not null default '[]'::jsonb,
  required_signatures jsonb not null default '[]'::jsonb,
  validation_support jsonb not null default '{}'::jsonb,
  support_status text not null default 'source_validation_required'
    check (support_status in (
      'source_validation_required',
      'validated_supported',
      'limited_support',
      'unsupported',
      'superseded'
    )),
  supersedes_form_id uuid references public.compliance_form_registry(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_code, revision_label),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create index if not exists compliance_form_registry_code_idx
  on public.compliance_form_registry(form_code, support_status);
create index if not exists compliance_form_registry_program_codes_idx
  on public.compliance_form_registry using gin(program_codes);

create table if not exists public.compliance_form_registry_events (
  id uuid primary key default gen_random_uuid(),
  registry_form_id uuid not null references public.compliance_form_registry(id) on delete restrict,
  event_type text not null check (event_type in (
    'created', 'source_captured', 'validated', 'limited', 'superseded', 'unsupported', 'metadata_updated'
  )),
  event_payload jsonb not null default '{}'::jsonb,
  actor_id uuid,
  occurred_at timestamptz not null default now()
);

create index if not exists compliance_form_registry_events_form_idx
  on public.compliance_form_registry_events(registry_form_id, occurred_at desc);

create table if not exists public.certification_document_instances (
  id uuid primary key default gen_random_uuid(),
  certification_item_id uuid not null unique
    references public.certification_import_items(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id text not null,
  registry_form_id uuid references public.compliance_form_registry(id) on delete restrict,
  detected_form_code text,
  detected_revision text,
  recognition_status text not null
    check (recognition_status in ('recognized', 'ambiguous', 'unrecognized', 'unsupported', 'outdated')),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source_document_ref text not null,
  source_page integer check (source_page is null or source_page > 0),
  evidence_snippet text,
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  review_status text not null default 'pending_analyst_verification'
    check (review_status in ('not_required', 'pending_analyst_verification', 'verified', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((reviewed_at is null and reviewed_by is null) or (reviewed_at is not null and reviewed_by is not null))
);

create index if not exists certification_document_instances_user_idx
  on public.certification_document_instances(user_id, created_at desc);
create index if not exists certification_document_instances_registry_idx
  on public.certification_document_instances(registry_form_id, recognition_status);

alter table public.compliance_form_registry enable row level security;
alter table public.compliance_form_registry_events enable row level security;
alter table public.certification_document_instances enable row level security;

revoke all on table public.compliance_form_registry from public, anon;
revoke all on table public.compliance_form_registry_events from public, anon;
revoke all on table public.certification_document_instances from public, anon;

grant select on table public.compliance_form_registry to authenticated;
grant select on table public.compliance_form_registry_events to authenticated;
grant select on table public.certification_document_instances to authenticated;
grant all on table public.compliance_form_registry to service_role;
grant all on table public.compliance_form_registry_events to service_role;
grant all on table public.certification_document_instances to service_role;

drop policy if exists "Authenticated users read compliance form registry"
  on public.compliance_form_registry;
create policy "Authenticated users read compliance form registry"
  on public.compliance_form_registry for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "Authenticated users read compliance form history"
  on public.compliance_form_registry_events;
create policy "Authenticated users read compliance form history"
  on public.compliance_form_registry_events for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "Users read own recognized certification documents"
  on public.certification_document_instances;
create policy "Users read own recognized certification documents"
  on public.certification_document_instances for select to authenticated
  using (user_id = auth.uid());

-- Seed only the form families identified in the approved future-state vision.
-- Every seed remains source_validation_required; these rows are discovery and
-- recognition targets, not claims of live support.
insert into public.compliance_form_registry(
  form_code, form_name, form_family, issuing_authority, program_codes,
  revision_label, support_status, validation_support, notes
)
values
  ('HUD-50059', 'HUD-50059 certification', 'tenant_certification', 'HUD',
    array['HUD_MFH_PROJECT_BASED'], 'source validation required', 'source_validation_required',
    '{"recognition":true,"decision_use":false}'::jsonb,
    'Official revision, effective period, required fields, signatures, and reconciliation fixtures must be validated before decision use.'),
  ('HUD-50059-A', 'HUD-50059-A certification', 'tenant_certification', 'HUD',
    array['HUD_MFH_PROJECT_BASED'], 'source validation required', 'source_validation_required',
    '{"recognition":true,"decision_use":false}'::jsonb,
    'Official revision, effective period, required fields, signatures, and reconciliation fixtures must be validated before decision use.'),
  ('HUD-9887', 'HUD-9887 consent', 'consent', 'HUD',
    '{}'::text[], 'source validation required', 'source_validation_required',
    '{"recognition":true,"decision_use":false}'::jsonb,
    'Program applicability, consent version, execution rules, and household-signature controls require official-source validation.'),
  ('HUD-9887-A', 'HUD-9887-A consent addendum', 'consent', 'HUD',
    '{}'::text[], 'source validation required', 'source_validation_required',
    '{"recognition":true,"decision_use":false}'::jsonb,
    'Program applicability, consent version, execution rules, and household-signature controls require official-source validation.'),
  ('HUD-9834', 'HUD-9834 management and occupancy review', 'management_occupancy_review', 'HUD',
    array['HUD_MFH_PROJECT_BASED'], 'source validation required', 'source_validation_required',
    '{"recognition":true,"question_level_ingestion":false,"decision_use":false}'::jsonb,
    'Question-level ingestion and Addendum A mapping require controlled official-source validation.'),
  ('HUD-50058', 'HUD-50058 family report', 'pha_reporting', 'HUD',
    array['HCV_TENANT_BASED','HUD_PBV','PUBLIC_HOUSING'], 'source validation required', 'source_validation_required',
    '{"recognition":true,"decision_use":false}'::jsonb,
    'Variant and program mapping must be validated separately from the existing HUD-50058 operational queue.'),
  ('HUD-MODEL-LEASE', 'HUD model lease / addendum', 'lease_addendum_notice', 'HUD',
    '{}'::text[], 'source validation required', 'source_validation_required',
    '{"recognition":false,"decision_use":false}'::jsonb,
    'Registry family for model leases, addenda, modification notices, hardship notices, and resident notices.'),
  ('OWNER-POLICY', 'Owner policy document', 'policy_document', 'Owner / Agent',
    '{}'::text[], 'source validation required', 'source_validation_required',
    '{"recognition":false,"decision_use":false}'::jsonb,
    'Registry family for Tenant Selection Plans, EIV Policies and Procedures, and other written owner policies.')
on conflict (form_code, revision_label) do nothing;

insert into public.compliance_form_registry_events(registry_form_id, event_type, event_payload)
select id, 'created', jsonb_build_object(
  'support_status', support_status,
  'control', 'future_state_document_registry_seed',
  'decision_use', false
)
from public.compliance_form_registry registry
where registry.revision_label = 'source validation required'
  and not exists (
    select 1 from public.compliance_form_registry_events event
    where event.registry_form_id = registry.id and event.event_type = 'created'
  );
