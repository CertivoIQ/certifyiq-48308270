-- The legacy policy duplicates reads and weakens the subscription-aware write check
-- because permissive policies are ORed together. The remaining policy has the
-- same tenant ownership predicate and the stricter paid mass-intake check.
drop policy if exists "users manage own import items"
  on public.certification_import_items;

-- Cover relationship foreign keys used by portfolio/tenant joins and deletes.
create index if not exists certification_import_items_property_id_idx
  on public.certification_import_items(property_id);
create index if not exists certification_import_items_unit_id_idx
  on public.certification_import_items(unit_id);
create index if not exists certification_import_items_tenant_profile_id_idx
  on public.certification_import_items(tenant_profile_id);


