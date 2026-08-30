import type { ComponentType } from 'react'
import { template as invoiceCreatedTemplate } from './invoice-created'
import { template as paymentSucceededTemplate } from './payment-succeeded'
import { template as paymentFailedTemplate } from './payment-failed'
import { template as introColdTemplate } from './intro-cold'
import { template as supportRequestReceivedTemplate } from './support-request-received'
import { template as mailMergeTemplate } from './mail-merge'
import { template as phaWorkspaceInvitationTemplate } from './pha-workspace-invitation'
import { template as productFeatureSuggestionTemplate } from './product-feature-suggestion'

/** Values a rendered email template may receive (scalars only). */
export type EmailTemplateData = Record<string, string | number | boolean | null | undefined>

export interface TemplateEntry {
  component: ComponentType<EmailTemplateData>
  subject: string | ((data: EmailTemplateData) => string)
  displayName?: string
  previewData?: EmailTemplateData
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/** Template registry — maps template names to their React Email components. */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'invoice-created': invoiceCreatedTemplate,
  'payment-succeeded': paymentSucceededTemplate,
  'payment-failed': paymentFailedTemplate,
  'intro-cold': introColdTemplate,
  'support-request-received': supportRequestReceivedTemplate,
  'mail-merge': mailMergeTemplate,
  'pha-workspace-invitation': phaWorkspaceInvitationTemplate,
  'product-feature-suggestion': productFeatureSuggestionTemplate,
}
