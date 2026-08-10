/**
 * Minimal structural shapes for the Stripe objects this app reads from
 * webhooks. Only the fields actually used are declared — Stripe payloads
 * carry more, and these types intentionally stay narrow.
 */

export interface StripePriceLike {
  id?: string;
  product?: string | { id?: string };
  lookup_key?: string | null;
  metadata?: Record<string, string> | null;
}

export interface StripeLineItemLike {
  description?: string | null;
  quantity?: number | null;
  price?: StripePriceLike | null;
  pricing?: { price_details?: { price?: string } | null } | null;
  period?: { start?: number | null; end?: number | null } | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
}

export interface StripeSubscriptionLike {
  id: string;
  customer?: string | null;
  status?: string;
  cancel_at_period_end?: boolean | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  items?: { data?: StripeLineItemLike[] } | null;
  metadata?: Record<string, string> | null;
}

export interface StripeInvoiceLike {
  id?: string;
  number?: string | null;
  currency?: string | null;
  amount_due?: number | null;
  amount_paid?: number | null;
  amount_remaining?: number | null;
  attempt_count?: number | null;
  created?: number | null;
  due_date?: number | null;
  next_payment_attempt?: number | null;
  period_start?: number | null;
  period_end?: number | null;
  customer_email?: string | null;
  customer_name?: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  subscription?: string | null;
  parent?: { subscription_details?: { subscription?: string | null } | null } | null;
  status_transitions?: { paid_at?: number | null } | null;
  last_finalization_error?: { message?: string | null } | null;
  last_payment_error?: { message?: string | null } | null;
  lines?: { data?: StripeLineItemLike[] } | null;
}

export interface StripeWebhookEventLike {
  id?: string;
  type: string;
  data: { object: StripeInvoiceLike & StripeSubscriptionLike & Record<string, unknown> };
}
