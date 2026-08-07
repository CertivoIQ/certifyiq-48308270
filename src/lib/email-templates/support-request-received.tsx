import React from 'react'
import { Preview } from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  BRAND,
  Body,
  Container,
  CtaButton,
  Head,
  Heading,
  Html,
  Brand,
  Section,
  Text,
  Hr,
  hr,
  small,
  container,
  heading,
  main,
  text,
} from './shared'

interface Props {
  name?: string
  caseNumber?: string
  subject?: string
  supportUrl?: string
}

const Email = ({
  name,
  caseNumber,
  subject,
  supportUrl = 'https://certifyiq.app/contact-support',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`We received your support request — case ${caseNumber ?? '#'} · CertifyIQ`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Brand />
        <Heading style={heading}>Thanks for reaching out</Heading>
        <Text style={text}>
          {name ? `Hi ${name},` : 'Hi there,'} we have received your support request and a CertifyIQ
          specialist will review it shortly.
        </Text>

        <Section style={{ padding: '14px 16px', backgroundColor: '#f8f9fc', borderRadius: '8px', marginBottom: '20px' }}>
          <Text style={{ ...text, margin: 0, fontWeight: 600 }}>
            Case number: {caseNumber ?? 'Pending'}
          </Text>
          {subject && (
            <Text style={{ ...text, margin: '6px 0 0 0', color: BRAND.muted }}>
              Subject: {subject}
            </Text>
          )}
        </Section>

        <Text style={text}>
          Most questions are answered within one business day. If you need to add more details,
          reply to this email and the case will be updated automatically.
        </Text>

        <Section style={{ paddingBottom: '14px' }}>
          <CtaButton href={supportUrl}>Open support page</CtaButton>
        </Section>
        <Hr style={hr} />
        <Text style={small}>
          You are receiving this because you submitted a request through the CertifyIQ support page. Reply to this email to add more details.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `We received your support request — case ${data['caseNumber'] ?? '#'} · CertifyIQ`,
  displayName: 'Support request received',
  previewData: {
    name: 'Jordan',
    caseNumber: 'SC-00042',
    subject: 'Question about LIHTC income limits',
    supportUrl: 'https://certifyiq.app/contact-support',
  },
} satisfies TemplateEntry
