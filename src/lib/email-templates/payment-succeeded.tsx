import React from 'react'
import { Preview } from '@react-email/components'
import type { EmailTemplateData, TemplateEntry } from './registry'
import {
  BRAND,
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
  amountPaid?: string
  paidDate?: string
  invoiceNumber?: string
  periodLabel?: string
  nextRenewal?: string
  billingUrl?: string
  invoiceUrl?: string
  pdfUrl?: string
}

const Email = ({
  name,
  planName = 'CertivoIQ subscription',
  amountPaid = '$0.00',
  paidDate,
  invoiceNumber,
  periodLabel,
  nextRenewal,
  billingUrl = 'https://certivoiq.com/billing',
  invoiceUrl,
  pdfUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Payment received — ${amountPaid} for ${planName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Brand />
        <Text style={{ ...small, color: BRAND.green, fontWeight: 700, margin: '0 0 6px' }}>PAYMENT RECEIVED</Text>
        <Heading style={heading}>Thank you — your payment went through</Heading>
        <Text style={text}>
          {name ? `Hi ${name},` : 'Hi there,'} we received your payment and your CertivoIQ account is fully active. Your
          plan capacity and AI document allowance are available right away.
        </Text>

        <Hr style={hr} />
        {invoiceNumber && <DetailRow label="Invoice" value={invoiceNumber} />}
        <DetailRow label="Plan" value={planName} />
        <DetailRow label="Amount paid" value={amountPaid} />
        {paidDate && <DetailRow label="Paid on" value={paidDate} />}
        {periodLabel && <DetailRow label="Billing period" value={periodLabel} />}
        {nextRenewal && <DetailRow label="Next renewal" value={nextRenewal} />}
        <Hr style={hr} />

        <Section style={{ paddingBottom: '14px' }}>
          <CtaButton href={billingUrl}>Open billing &amp; usage</CtaButton>
        </Section>
        {invoiceUrl && (
          <Text style={small}>
            <Link href={invoiceUrl}>View receipt</Link>
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
  subject: (data: EmailTemplateData) => `Payment received — ${data['amountPaid'] ?? 'thank you'} · CertivoIQ`,
  displayName: 'Payment succeeded',
  previewData: {
    name: 'Jordan',
    planName: 'CertivoIQ Business',
    amountPaid: '$4,999.00',
    paidDate: 'August 1, 2026',
    invoiceNumber: 'CIQ-1042',
    periodLabel: 'Aug 1 – Sep 1, 2026',
    nextRenewal: 'September 1, 2026',
    billingUrl: 'https://certivoiq.com/billing',
    invoiceUrl: 'https://invoice.stripe.com/i/example',
    pdfUrl: 'https://invoice.stripe.com/i/example.pdf',
  },
} satisfies TemplateEntry
