-- Each selected page has its own immutable reference to the same uploaded packet.
-- The earlier path-only uniqueness rule accidentally prevented the second page.
alter table public.portfolio_tenant_documents
  drop constraint if exists portfolio_tenant_documents_user_id_tenant_profile_id_storag_key;

-- Standalone uploads retain path uniqueness. Packet pages retain the existing
-- portfolio_tenant_documents_packet_range_uidx, scoped to their parent and range.
create unique index if not exists portfolio_tenant_documents_standalone_path_uidx
  on public.portfolio_tenant_documents(user_id, tenant_profile_id, storage_path)
  where source_kind = 'standalone_upload';
