import { sendTemplateEmail } from '@/lib/email-templates/send-email'
import { PLAN_ENTITLEMENTS } from '@/lib/plan-catalog'
import type { StripeInvoiceLike } from '@/lib/stripe-webhook-types'

const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
])
const THREE_DECIMAL = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd'])

function formatAmount(minor: number | null | undefined, currency: string | null | undefined): string {
  const c = (currency ?? 'usd').toLowerCase()
  const divisor = ZERO_DECIMAL.has(c) ? 1 : THREE_DECIMAL.has(c) ? 1000 : 100
  const value = (minor ?? 0) / divisor
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: c.toUpperCase() }).format(value)
  } catch {
    return `${value.toFixed(2)} ${c.toUpperCase()}`
  }
}

function formatDate(unix: number | null | undefined): string | undefined {
  if (!unix) return undefined
  return new Date(unix * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function shortDate(unix: number | null | undefined): string | undefined {
  if (!unix) return undefined
  return new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function appOrigin(): string {
  return (process.env['APP_URL'] || 'https://certivoiq.com').replace(/\/$/, '')
}

/** Human-readable plan name for the invoice's first line item. */
function planNameFor(invoice: StripeInvoiceLike): string {
  const line = invoice?.lines?.data?.[0]
  const priceId =
    line?.price?.lookup_key || line?.price?.metadata?.['lovable_external_id'] || line?.pricing?.price_details?.price
  const plan = priceId ? PLAN_ENTITLEMENTS[priceId] : undefined
  return plan?.name ?? line?.description ?? 'CertivoIQ subscription'
}

export interface BillingEmailContext {
  recipient: string
  name?: string | null
}

/** Shared props every billing email renders from a Stripe invoice. */
function baseProps(invoice: StripeInvoiceLike, ctx: BillingEmailContext) {
  const line = invoice?.lines?.data?.[0]
  const start = line?.period?.start ?? invoice?.period_start
  const end = line?.period?.end ?? invoice?.period_end
  const periodLabel =
    start && end ? `${shortDate(start)} – ${shortDate(end)}` : undefined

  return {
    ...(ctx.name ? { name: ctx.name } : {}),
    planName: planNameFor(invoice),
    ...(invoice?.number ? { invoiceNumber: String(invoice.number) } : {}),
    ...(periodLabel ? { periodLabel } : {}),
    billingUrl: `${appOrigin()}/billing`,
    ...(invoice?.hosted_invoice_url ? { invoiceUrl: invoice.hosted_invoice_url } : {}),
    ...(invoice?.invoice_pdf ? { pdfUrl: invoice.invoice_pdf } : {}),
  }
}

/** A new invoice was finalized — tell the customer what is coming. */
export async function sendInvoiceCreatedEmail(invoice: StripeInvoiceLike, ctx: BillingEmailContext) {
  return sendTemplateEmail('invoice-created', ctx.recipient, {
    templateData: {
      ...baseProps(invoice, ctx),
      amountDue: formatAmount(invoice?.amount_due, invoice?.currency),
      ...(formatDate(invoice?.due_date ?? invoice?.next_payment_attempt)
        ? { dueDate: formatDate(invoice?.due_date ?? invoice?.next_payment_attempt) }
        : {}),
    },
    idempotencyKey: `invoice-created-${invoice?.id}`,
  })
}

/** Payment settled — receipt style confirmation. */
export async function sendPaymentSucceededEmail(invoice: StripeInvoiceLike, ctx: BillingEmailContext) {
  const line = invoice?.lines?.data?.[0]
  const nextRenewal = formatDate(line?.period?.end ?? invoice?.period_end)
  return sendTemplateEmail('payment-succeeded', ctx.recipient, {
    templateData: {
      ...baseProps(invoice, ctx),
      amountPaid: formatAmount(invoice?.amount_paid ?? invoice?.amount_due, invoice?.currency),
      ...(formatDate(invoice?.status_transitions?.paid_at ?? invoice?.created)
        ? { paidDate: formatDate(invoice?.status_transitions?.paid_at ?? invoice?.created) }
        : {}),
      ...(nextRenewal ? { nextRenewal } : {}),
    },
    idempotencyKey: `payment-succeeded-${invoice?.id}`,
  })
}

/** Payment declined — dunning notice with a direct path to fix the card. */
export async function sendPaymentFailedEmail(invoice: StripeInvoiceLike, ctx: BillingEmailContext) {
  const attempt = invoice?.last_finalization_error?.message ?? invoice?.last_payment_error?.message
  return sendTemplateEmail('payment-failed', ctx.recipient, {
    templateData: {
      ...baseProps(invoice, ctx),
      amountDue: formatAmount(invoice?.amount_remaining ?? invoice?.amount_due, invoice?.currency),
      ...(attempt ? { failureReason: String(attempt) } : {}),
      ...(formatDate(invoice?.next_payment_attempt)
        ? { nextAttempt: formatDate(invoice?.next_payment_attempt) }
        : {}),
    },
    idempotencyKey: `payment-failed-${invoice?.id}-${invoice?.attempt_count ?? 0}`,
  })
}
