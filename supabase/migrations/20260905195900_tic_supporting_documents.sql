-- Preserve supporting documents and page ranges beneath a Tenant Income Certification.
-- One certification may have many read-only supporting document records.

alter table public.portfolio_tenant_documents
  drop constraint if exists portfolio_tenant_documents_certification_import_item_id_key;

alter table public.portfolio_tenant_documents
  add column if not exists document_type text,
  add column if not exists display_name text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists sha256 text,
  add column if not exists source_kind text not null default 'standalone_upload',
  add column if not exists source_page_start integer,
  add column if not exists source_page_end integer,
  add column if not exists source_page_numbers integer[] not null default '{}'::integer[],
  add column if not exists classification_confidence numeric,
  add column if not exists classification_basis text,
  add column if not exists immutable boolean not null default true,
  add column if not exists printable boolean not null default true,
  add column if not exists review_status text not null default 'pending_review',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.portfolio_tenant_documents'::regclass
      and conname = 'portfolio_tenant_documents_source_kind_check'
  ) then
    alter table public.portfolio_tenant_documents
      add constraint portfolio_tenant_documents_source_kind_check
      check (source_kind in ('packet_page_range','standalone_upload'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.portfolio_tenant_documents'::regclass
      and conname = 'portfolio_tenant_documents_page_range_check'
  ) then
    alter table public.portfolio_tenant_documents
      add constraint portfolio_tenant_documents_page_range_check
      check (
        (source_page_start is null and source_page_end is null)
        or (
          source_page_start is not null and source_page_start >= 1
          and source_page_end is not null and source_page_end >= source_page_start
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.portfolio_tenant_documents'::regclass
      and conname = 'portfolio_tenant_documents_classification_confidence_check'
  ) then
    alter table public.portfolio_tenant_documents
      add constraint portfolio_tenant_documents_classification_confidence_check
      check (classification_confidence is null or (classification_confidence >= 0 and classification_confidence <= 1));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.portfolio_tenant_documents'::regclass
      and conname = 'portfolio_tenant_documents_review_status_check'
  ) then
    alter table public.portfolio_tenant_documents
      add constraint portfolio_tenant_documents_review_status_check
      check (review_status in ('pending_review','reviewed'));
  end if;
end $$;

create index if not exists portfolio_tenant_documents_certification_idx
  on public.portfolio_tenant_documents(user_id, certification_import_item_id, created_at);

create index if not exists portfolio_tenant_documents_type_idx
  on public.portfolio_tenant_documents(user_id, tenant_profile_id, document_type, created_at desc);

create unique index if not exists portfolio_tenant_documents_packet_range_uidx
  on public.portfolio_tenant_documents(
    user_id,
    tenant_profile_id,
    certification_import_item_id,
    storage_path,
    document_type,
    source_page_start,
    source_page_end
  )
  where source_kind = 'packet_page_range'
    and certification_import_item_id is not null
    and document_type is not null
    and source_page_start is not null
    and source_page_end is not null;

comment on column public.portfolio_tenant_documents.certification_import_item_id is
  'Parent certification. Multiple preserved supporting documents may link to the same certification.';
comment on column public.portfolio_tenant_documents.source_kind is
  'packet_page_range references pages within the immutable parent packet; standalone_upload references a separately uploaded source.';
comment on column public.portfolio_tenant_documents.immutable is
  'Supporting document contents are preserved read-only. Metadata may be reviewed without modifying source bytes.';
comment on column public.portfolio_tenant_documents.source_page_numbers is
  'Exact source packet pages represented by this supporting document record.';
