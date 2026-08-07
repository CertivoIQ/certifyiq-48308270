import React from 'react'
import { Preview } from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  Body,
  Container,
  CtaButton,
  DetailRow,
  Footer,
  Head,
  Heading,
  Html,
  Brand,
  Section,
  Text,
  Link,
  container,
  heading,
  hr,
  main,
  small,
  text,
  Hr,
} from './shared'

interface Props {
  name?: string
  planName?: string
  amountDue?: string
  dueDate?: string
  invoiceNumber?: string
  periodLabel?: string
  billingUrl?: string
  invoiceUrl?: string
  pdfUrl?: string
}

const Email = ({
  name,
  planName = 'CertivoIQ subscription',
  amountDue = '$0.00',
  dueDate,
  invoiceNumber,
  periodLabel,
  billingUrl = 'https://certivoiq.com/billing',
  invoiceUrl,
  pdfUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New CertivoIQ invoice ${invoiceNumber ?? ''} — ${amountDue} due`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Brand />
        <Heading style={heading}>Your new invoice is ready</Heading>
        <Text style={text}>
          {name ? `Hi ${name},` : 'Hi there,'} a new invoice has been issued for your CertivoIQ account. No action is
          needed if your card is on file — it will be charged automatically.
        </Text>

        <Hr style={hr} />
        {invoiceNumber && <DetailRow label="Invoice" value={invoiceNumber} />}
        <DetailRow label="Plan" value={planName} />
        <DetailRow label="Amount due" value={amountDue} />
        {periodLabel && <DetailRow label="Billing period" value={periodLabel} />}
        {dueDate && <DetailRow label="Due" value={dueDate} />}
        <Hr style={hr} />

        <Section style={{ paddingBottom: '14px' }}>
          <CtaButton href={billingUrl}>View billing &amp; usage</CtaButton>
        </Section>
        {invoiceUrl && (
          <Text style={small}>
            <Link href={invoiceUrl}>See the full invoice</Link>
            {pdfUrl ? ' · ' : ''}
            {pdfUrl && <Link href={pdfUrl}>Download PDF</Link>}
          </Text>
        )}
        <Footer />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `New CertivoIQ invoice${data['invoiceNumber'] ? ` ${data['invoiceNumber']}` : ''} — ${data['amountDue'] ?? 'amount due'}`,
  displayName: 'New invoice',
  previewData: {
    name: 'Jordan',
    planName: 'CertivoIQ Business',
    amountDue: '$1,499.00',
    dueDate: 'September 1, 2026',
    invoiceNumber: 'CIQ-1042',
    periodLabel: 'Aug 1 – Sep 1, 2026',
    billingUrl: 'https://certivoiq.com/billing',
    invoiceUrl: 'https://invoice.stripe.com/i/example',
    pdfUrl: 'https://invoice.stripe.com/i/example.pdf',
  },
} satisfies TemplateEntry
