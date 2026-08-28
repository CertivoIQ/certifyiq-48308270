-- Transactional delivery state for PHA workspace invitations.
alter table public.pha_workspace_invitations
  add column if not exists delivery_status text not null default 'not_sent' check (delivery_status in ('not_sent','sent','suppressed','failed')),
  add column if not exists delivery_attempted_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_error text,
  add column if not exists delivery_attempt_count integer not null default 0 check (delivery_attempt_count >= 0);
