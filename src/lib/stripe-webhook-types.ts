/**
 * Structural types for the Stripe webhook payloads this app consumes.
 * Deliberately loose (all fields optional) because Stripe sends different
 * shapes per API version and event type; behaviour is unchanged, these types
 * only describe the fields the handlers already read.
 */

export interface StripePriceLike {
  id?: string
  lookup_key?: string | null
  product?: string | null
  metadata?: Record<string, string> | null
}

export interface StripeSubscriptionItemLike {
  price?: StripePriceLike | null
  quantity?: number | null
  current_period_start?: number | null
  current_period_end?: number | null
}

export interface StripeSubscriptionLike {
  id?: string
  customer?: string | null
  status?: string
  cancel_at_period_end?: boolean | null
  current_period_start?: number | null
  current_period_end?: number | null
  items?: { data?: StripeSubscriptionItemLike[] } | null
  metadata?: Record<string, string> | null
}

export interface StripeInvoiceLineLike {
  description?: string | null
  price?: StripePriceLike | null
  pricing?: { price_details?: { price?: string | null } | null } | null
  period?: { start?: number | null; end?: number | null } | null
}

export interface StripeInvoiceLike {
  id?: string
  number?: string | null
  customer?: string | null
  status?: string | null
  metadata?: Record<string, string> | null
  collection_method?: string | null
  currency?: string | null
  amount_due?: number | null
  amount_paid?: number | null
  amount_remaining?: number | null
  attempt_count?: number | null
  created?: number | null
  due_date?: number | null
  next_payment_attempt?: number | null
  period_start?: number | null
  period_end?: number | null
  hosted_invoice_url?: string | null
  invoice_pdf?: string | null
  customer_email?: string | null
  customer_name?: string | null
  status_transitions?: { paid_at?: number | null } | null
  last_finalization_error?: { message?: string | null } | null
  last_payment_error?: { message?: string | null } | null
  subscription?: string | null
  parent?: {
    subscription_details?: {
      subscription?: string | null
      metadata?: Record<string, string> | null
    } | null
  } | null
  lines?: { data?: StripeInvoiceLineLike[] } | null
}

export interface StripeCheckoutSessionLike {
  id?: string
  payment_status?: string | null
}

/** Union of every event object shape the webhook route branches on. */
export type StripeWebhookObject = StripeSubscriptionLike &
  StripeInvoiceLike &
  StripeCheckoutSessionLike

/** Alias kept for webhook code that refers to subscription items as line items. */
export type StripeLineItemLike = StripeSubscriptionItemLike;

