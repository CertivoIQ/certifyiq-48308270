-- Standalone certification pages remain source-linked without a portfolio CSV.
alter table public.portfolio_tenant_documents alter column tenant_profile_id drop not null;
alter table public.portfolio_tenant_documents add constraint tenant_document_has_destination check (tenant_profile_id is not null or certification_import_item_id is not null);
drop policy "users manage own tenant documents" on public.portfolio_tenant_documents;
create policy "users manage own tenant documents" on public.portfolio_tenant_documents for all to authenticated
 using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id
 and (tenant_profile_id is null or exists(select 1 from public.portfolio_tenant_profiles t where t.id=tenant_profile_id and t.user_id=(select auth.uid())))
 and (certification_import_item_id is null or exists(select 1 from public.certification_import_items i where i.id=certification_import_item_id and i.user_id=(select auth.uid()))));
