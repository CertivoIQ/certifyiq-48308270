-- Idempotency ledger for Stripe events (service-role only; no client access)
CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  event_id text PRIMARY KEY,
  event_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.stripe_processed_events TO service_role;
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- Track the moment a user became a paying subscriber and when demo content was cleared.
ALTER TABLE public.account_access
  ADD COLUMN IF NOT EXISTS subscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS demo_data_cleared_at timestamptz;