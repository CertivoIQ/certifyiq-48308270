import React from 'react'
import { Preview } from '@react-email/components'
import type { TemplateEntry } from './registry'
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
  amountDue?: string
  invoiceNumber?: string
  periodLabel?: string
  failureReason?: string
  nextAttempt?: string
  billingUrl?: string
  invoiceUrl?: string
  pdfUrl?: string
}

const Email = ({
  name,
  planName = 'CertivoIQ subscription',
  amountDue = '$0.00',
  invoiceNumber,
  periodLabel,
  failureReason,
  nextAttempt,
  billingUrl = 'https://certivoiq.com/billing',
  invoiceUrl,
  pdfUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Action needed — we couldn't process your ${amountDue} CertivoIQ payment`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Brand />
        <Text style={{ ...small, color: BRAND.red, fontWeight: 700, margin: '0 0 6px' }}>ACTION NEEDED</Text>
        <Heading style={heading}>We couldn&apos;t process your payment</Heading>
        <Text style={text}>
          {name ? `Hi ${name},` : 'Hi there,'} the payment for your latest CertivoIQ invoice was declined. Your access
          and certification files are safe for now — updating your payment method keeps everything uninterrupted.
        </Text>

        <Hr style={hr} />
        {invoiceNumber && <DetailRow label="Invoice" value={invoiceNumber} />}
        <DetailRow label="Plan" value={planName} />
        <DetailRow label="Amount due" value={amountDue} />
        {periodLabel && <DetailRow label="Billing period" value={periodLabel} />}
        {failureReason && <DetailRow label="Reason given by your bank" value={failureReason} />}
        {nextAttempt && <DetailRow label="Next automatic retry" value={nextAttempt} />}
        <Hr style={hr} />

        <Section style={{ paddingBottom: '14px' }}>
          <CtaButton href={billingUrl}>Update payment method</CtaButton>
        </Section>
        {invoiceUrl && (
          <Text style={small}>
            <Link href={invoiceUrl}>Pay this invoice now</Link>
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
    `Action needed: your CertivoIQ payment of ${data['amountDue'] ?? 'your invoice'} failed`,
  displayName: 'Payment failed',
  previewData: {
    name: 'Jordan',
    planName: 'CertivoIQ Business',
    amountDue: '$1,499.00',
    invoiceNumber: 'CIQ-1042',
    periodLabel: 'Aug 1 – Sep 1, 2026',
    failureReason: 'Your card was declined (insufficient funds)',
    nextAttempt: 'August 4, 2026',
    billingUrl: 'https://certivoiq.com/billing',
    invoiceUrl: 'https://invoice.stripe.com/i/example',
    pdfUrl: 'https://invoice.stripe.com/i/example.pdf',
  },
} satisfies TemplateEntry
