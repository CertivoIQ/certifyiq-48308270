import type { EmailTemplateData } from './registry'

export type SendTemplateEmailResult =
  | { sent: true }
  | { sent: false; reason: 'recipient_suppressed' }

export interface SendTemplateEmailOptions {
  templateData?: EmailTemplateData
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string
  replyTo?: string
}

/**
 * Transactional delivery is intentionally fail-closed until an approved
 * non-Lovable provider is implemented and verified. Callers already treat a
 * thrown delivery error as failed delivery while preserving the underlying
 * support, invitation, suggestion, or billing record.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {}
): Promise<SendTemplateEmailResult> {
  void templateName
  void to
  void options
  const error = new Error(
    'Transactional email is disabled until an approved non-Lovable provider is verified.',
  )
  Object.assign(error, { code: 'EMAIL_PROVIDER_DISABLED' })
  throw error
}
