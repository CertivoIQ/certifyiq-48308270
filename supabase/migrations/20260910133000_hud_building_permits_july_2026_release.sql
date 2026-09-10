-- Record HUD's July 2026 Building Permits release and stage user communications.
-- This migration is idempotent and intentionally does not send email or change compliance rules.

insert into public.crm_news (
  kind,
  headline,
  detail,
  source,
  url,
  published_at
)
select
  'federal',
  'HUD publishes July 2026 Building Permits data',
  'HUD USER confirmed the July 2026 State of the Cities Data Systems Building Permits release on September 9, 2026. This monthly update is statistical construction and supply context. CertivoIQ source hashing, numeric ingestion, geography reconciliation, and month-over-month trend validation remain pending; no compliance rules, certifications, or scoring have changed automatically.',
  'HUD USER',
  'https://www.huduser.gov/portal/datasets/socds.html',
  '2026-09-09 00:00:00+00'::timestamptz
where not exists (
  select 1
  from public.crm_news
  where url = 'https://www.huduser.gov/portal/datasets/socds.html'
    and headline = 'HUD publishes July 2026 Building Permits data'
);

insert into public.operations_communications (
  release_key,
  channel,
  status,
  subject,
  body,
  audience_snapshot,
  recipient_count,
  official_source_refs,
  requires_approval,
  idempotency_key
)
select
  'hud-building-permits-2026-07-2026-09-09',
  'platform_email',
  'draft',
  'HUD released July 2026 Building Permits data',
  jsonb_build_object(
    'sender', jsonb_build_object(
      'service', 'lovable_managed_email',
      'sending_domain', 'notify.certivoiq.com',
      'from', 'CertivoIQ <updates@notify.certivoiq.com>'
    ),
    'release_date', '2026-09-09',
    'effective_date', null,
    'effective_date_note', 'HUD states no separate effective date; the release covers July 2026 monthly building-permit activity.',
    'what_hud_released', jsonb_build_array(
      'July 2026 State of the Cities Data Systems Building Permits data'
    ),
    'confirmed_certivoiq_changes', jsonb_build_array(
      'The HUD release is confirmed in HUD USER''s Dataset Update Schedule and What''s New record.',
      'A concise CertivoIQ CRM news notice has been staged for publication.'
    ),
    'changes_still_pending', jsonb_build_array(
      'Numeric data ingestion and source snapshot hashing',
      'Row and geographic coverage reconciliation',
      'Month-over-month trend and anomaly validation',
      'Final delivery suppression and notify.certivoiq.com managed-sender verification'
    ),
    'required_user_actions', jsonb_build_array(
      'No certification or compliance-rule action is required from this statistical release.',
      'Continue using the currently applicable HUD program limits and effective-date rules.',
      'Review CertivoIQ data-freshness and provenance notes before relying on permit trends.'
    ),
    'official_hud_source', 'https://www.huduser.gov/portal/datasets/socds.html',
    'preferences_path', 'https://certivoiq.com/contact-support?topic=email-preferences',
    'approval_instruction', 'Do not send without Rodsheka Watkins'' explicit approval.'
  ),
  jsonb_build_object(
    'source', 'authenticated_platform_users_only',
    'account_statuses', jsonb_build_array('active', 'trialing'),
    'requires_email', true,
    'regulatory_updates', true,
    'unsubscribed_at', null,
    'crm_prospects_excluded', true,
    'provisional_eligible_count', 7,
    'suppression_validation', 'required_before_approval_and_send',
    'snapshot_date', '2026-09-10'
  ),
  7,
  jsonb_build_array(
    jsonb_build_object(
      'label', 'HUD USER Building Permits dataset',
      'url', 'https://www.huduser.gov/portal/datasets/socds.html',
      'release_date', '2026-09-09'
    ),
    jsonb_build_object(
      'label', 'HUD USER Dataset Update Schedule',
      'url', 'https://www.huduser.gov/portal/datasets/update-schedule.html',
      'release_date', '2026-09-09'
    ),
    jsonb_build_object(
      'label', 'HUD USER What''s New',
      'url', 'https://www.huduser.gov/portal/whatsnew/whatsnew.html',
      'release_date', '2026-09-09'
    )
  ),
  true,
  'platform-email:hud-building-permits-2026-07-2026-09-09:v1'
where not exists (
  select 1
  from public.operations_communications
  where idempotency_key = 'platform-email:hud-building-permits-2026-07-2026-09-09:v1'
);
