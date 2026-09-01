-- Publish the confirmed September 1, 2026 HUD FY 2027 rent release and
-- prepare, but do not send, the associated platform-user campaign.
-- Idempotency guards prevent duplicate news or campaign records.

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
  'HUD publishes FY 2027 FMRs, Small Area FMRs, and 50th-percentile rents',
  'HUD USER confirmed the FY 2027 rent files on September 1, 2026. FY 2027 FMRs generally apply October 1, 2026, subject to HUD reevaluation exceptions. CertivoIQ dataset ingestion, geographic validation, and rule activation remain pending; no certifications have been automatically rescored.',
  'HUD USER',
  'https://www.huduser.gov/portal/datasets/fmr.html',
  timestamptz '2026-09-01 12:54:25+00'
where not exists (
  select 1
  from public.crm_news
  where url = 'https://www.huduser.gov/portal/datasets/fmr.html'
    and headline ilike '%FY 2027 FMRs%'
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
values (
  'hud-fy2027-fmr-2026-09-01',
  'platform_email',
  'draft',
  'HUD released FY 2027 FMRs and Small Area FMRs',
  jsonb_build_object(
    'format', 'platform_regulatory_update_v1',
    'sender', jsonb_build_object(
      'service', 'lovable_managed_email',
      'sending_domain', 'notify.certivoiq.com',
      'from', 'CertivoIQ <noreply@certivoiq.com>'
    ),
    'release_date', '2026-09-01',
    'effective_date', '2026-10-01',
    'effective_date_note', 'FY 2027 FMRs generally apply October 1, 2026; HUD reevaluation exceptions may apply in affected areas.',
    'what_hud_released', jsonb_build_array(
      'FY 2027 Fair Market Rents',
      'FY 2027 Small Area Fair Market Rents',
      'FY 2027 50th-percentile rent estimates'
    ),
    'confirmed_certivoiq_changes', jsonb_build_array(
      'The HUD publication and linked FY 2027 files have been confirmed.',
      'A CertivoIQ CRM news item has been published.'
    ),
    'pending_certivoiq_changes', jsonb_build_array(
      'Numeric file ingestion and year-over-year comparison',
      'Geographic coverage and source-hash validation',
      'HUD reevaluation-exception handling',
      'Compliance-rule activation and automatic rescoring'
    ),
    'required_user_actions', jsonb_build_array(
      'Do not replace project or property figures solely from this notice until CertivoIQ validation is complete.',
      'Review FY 2027-effective actions with the applicable HUD or program authority.',
      'Watch CertivoIQ news for completion of validation and any confirmed platform changes.'
    ),
    'official_source_link', 'https://www.huduser.gov/portal/datasets/fmr.html',
    'small_area_fmr_link', 'https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html',
    'fiftieth_percentile_link', 'https://www.huduser.gov/portal/datasets/50per.html',
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
    'provisional_eligible_count', 18,
    'suppression_validation', 'required_before_approval_and_send',
    'snapshot_date', '2026-09-01'
  ),
  18,
  jsonb_build_array(
    jsonb_build_object('label', 'HUD USER FY 2027 FMRs', 'url', 'https://www.huduser.gov/portal/datasets/fmr.html'),
    jsonb_build_object('label', 'HUD USER Small Area FMRs', 'url', 'https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html'),
    jsonb_build_object('label', 'HUD USER 50th-percentile rents', 'url', 'https://www.huduser.gov/portal/datasets/50per.html'),
    jsonb_build_object('label', 'HUD USER release record', 'url', 'https://www.huduser.gov/portal/whatsnew/whatsnew.html')
  ),
  true,
  'platform-email:hud-fy2027-fmr-2026-09-01:v1'
)
on conflict (idempotency_key) do nothing;
