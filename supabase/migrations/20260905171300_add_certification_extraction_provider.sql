alter table public.certification_import_items
  add column if not exists extraction_provider text;
