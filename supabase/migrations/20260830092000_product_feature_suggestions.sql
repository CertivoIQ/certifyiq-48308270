-- Authenticated product suggestions with role attribution, tenant isolation, and private delivery evidence.

create table if not exists public.product_feature_suggestions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  workspace_user_id uuid not null references auth.users(id) on delete restrict,
  submitter_email text not null,
  submitter_role text not null check (char_length(submitter_role) between 2 and 80),
  workspace_type text not null check (workspace_type in ('multifamily','pha','internal_crm')),
  category text not null check (category in ('feature','workflow','integration','reporting','accessibility','other')),
  priority text not null default 'important' check (priority in ('nice_to_have','important','critical')),
  title text not null check (char_length(trim(title)) between 5 and 160),
  description text not null check (char_length(trim(description)) between 20 and 5000),
  expected_outcome text check (expected_outcome is null or char_length(trim(expected_outcome)) <= 2000),
  current_page text check (current_page is null or char_length(trim(current_page)) <= 300),
  status text not null default 'submitted' check (status in ('submitted','under_review','planned','declined','shipped')),
  email_delivery_status text not null default 'pending' check (email_delivery_status in ('pending','sent','suppressed','failed')),
  email_delivery_error text,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_feature_suggestions_submitter_idx
  on public.product_feature_suggestions (submitted_by, created_at desc);
create index if not exists product_feature_suggestions_workspace_idx
  on public.product_feature_suggestions (workspace_user_id, created_at desc);
create index if not exists product_feature_suggestions_status_idx
  on public.product_feature_suggestions (status, created_at desc);

alter table public.product_feature_suggestions enable row level security;

revoke all on table public.product_feature_suggestions from anon, authenticated;
grant select on table public.product_feature_suggestions to authenticated;
grant all on table public.product_feature_suggestions to service_role;

drop policy if exists "Users read own feature suggestions" on public.product_feature_suggestions;
create policy "Users read own feature suggestions"
on public.product_feature_suggestions
for select
to authenticated
using ((select auth.uid()) = submitted_by);

drop policy if exists "Staff read all feature suggestions" on public.product_feature_suggestions;
create policy "Staff read all feature suggestions"
on public.product_feature_suggestions
for select
to authenticated
using (public.has_role((select auth.uid()), 'staff'));

drop trigger if exists product_feature_suggestions_touch_updated_at on public.product_feature_suggestions;
create trigger product_feature_suggestions_touch_updated_at
before update on public.product_feature_suggestions
for each row execute function public.touch_updated_at();

comment on table public.product_feature_suggestions is
  'Authenticated, role-attributed client and staff product suggestions with private delivery evidence.';
