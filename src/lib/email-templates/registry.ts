import type { ComponentType } from 'react'
import { template as invoiceCreatedTemplate } from './invoice-created'
import { template as paymentSucceededTemplate } from './payment-succeeded'
import { template as paymentFailedTemplate } from './payment-failed'
import { template as introColdTemplate } from './intro-cold'
import { template as supportRequestReceivedTemplate } from './support-request-received'
import { template as mailMergeTemplate } from './mail-merge'


export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'invoice-created': invoiceCreatedTemplate,
  'payment-succeeded': paymentSucceededTemplate,
  'payment-failed': paymentFailedTemplate,
  'intro-cold': introColdTemplate,
  'support-request-received': supportRequestReceivedTemplate,
  'mail-merge': mailMergeTemplate,
}

