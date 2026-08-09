-- Staff-only CRM marketing document library.
-- Files remain private; access is granted only through authenticated staff sessions
-- and short-lived signed URLs created by the CRM UI.

create table if not exists public.crm_documents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  description text,
  category text not null default 'other'
    check (category in ('one-pager', 'sales-deck', 'case-study', 'brand-asset', 'worksheet', 'other')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_documents enable row level security;

revoke all on table public.crm_documents from anon;
grant select, insert, update, delete on table public.crm_documents to authenticated;

drop policy if exists "Staff can read CRM documents" on public.crm_documents;
create policy "Staff can read CRM documents"
  on public.crm_documents for select
  to authenticated
  using (public.has_role(auth.uid(), 'staff'));

drop policy if exists "Staff can add CRM documents" on public.crm_documents;
create policy "Staff can add CRM documents"
  on public.crm_documents for insert
  to authenticated
  with check (
    public.has_role(auth.uid(), 'staff')
    and created_by = auth.uid()
  );

drop policy if exists "Staff can update CRM documents" on public.crm_documents;
create policy "Staff can update CRM documents"
  on public.crm_documents for update
  to authenticated
  using (public.has_role(auth.uid(), 'staff'))
  with check (public.has_role(auth.uid(), 'staff'));

drop policy if exists "Staff can remove CRM documents" on public.crm_documents;
create policy "Staff can remove CRM documents"
  on public.crm_documents for delete
  to authenticated
  using (public.has_role(auth.uid(), 'staff'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-marketing-documents',
  'crm-marketing-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/csv'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff can read CRM marketing files" on storage.objects;
create policy "Staff can read CRM marketing files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'crm-marketing-documents'
    and public.has_role(auth.uid(), 'staff')
  );

drop policy if exists "Staff can upload CRM marketing files" on storage.objects;
create policy "Staff can upload CRM marketing files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'crm-marketing-documents'
    and public.has_role(auth.uid(), 'staff')
    and owner_id = auth.uid()::text
  );

drop policy if exists "Staff can update CRM marketing files" on storage.objects;
create policy "Staff can update CRM marketing files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'crm-marketing-documents'
    and public.has_role(auth.uid(), 'staff')
  )
  with check (
    bucket_id = 'crm-marketing-documents'
    and public.has_role(auth.uid(), 'staff')
  );

drop policy if exists "Staff can remove CRM marketing files" on storage.objects;
create policy "Staff can remove CRM marketing files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'crm-marketing-documents'
    and public.has_role(auth.uid(), 'staff')
  );
