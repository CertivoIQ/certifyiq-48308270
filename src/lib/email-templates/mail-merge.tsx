import React from 'react'
import { Preview } from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  Body,
  Brand,
  Container,
  CtaButton,
  Footer,
  Head,
  Heading,
  Hr,
  Html,
  Section,
  Text,
  container,
  heading,
  hr,
  main,
  small,
  text,
} from './shared'

interface Props {
  subject?: string
  /** Plain-text body; blank lines separate paragraphs. Merge tokens are resolved before send. */
  bodyText?: string
  ctaLabel?: string
  ctaUrl?: string
  agentName?: string
  agentTitle?: string
  agentEmail?: string
}

function MailMergeEmail({
  subject = 'A note from CertivoIQ',
  bodyText = '',
  ctaLabel,
  ctaUrl,
  agentName,
  agentTitle,
  agentEmail,
}: Props) {
  const paragraphs = bodyText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Brand />
          <Heading style={heading}>{subject}</Heading>
          {paragraphs.map((p, i) => (
            <Text key={i} style={text}>
              {p.split('\n').map((line, j) => (
                <React.Fragment key={j}>
                  {j > 0 && <br />}
                  {line}
                </React.Fragment>
              ))}
            </Text>
          ))}
          {ctaUrl && <CtaButton href={ctaUrl}>{ctaLabel || 'See how it works'}</CtaButton>}
          <Hr style={hr} />
          {agentName && (
            <Text style={small}>
              {agentName}
              {agentTitle ? ` — ${agentTitle}` : ''}
              {agentEmail ? ` · ${agentEmail}` : ''}
            </Text>
          )}
          <Section>
            <Footer />
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: MailMergeEmail,
  subject: (data) => (data['subject'] as string) || 'A note from CertivoIQ',
  displayName: 'CRM mail merge',
  previewData: {
    subject: 'HOTMA compliance deadlines are moving — here is your readiness check',
    bodyText: 'Hi there,\n\nCertivoIQ reviews tenant income certifications against LIHTC, Section 8, HOME and HOTMA rules before an auditor ever sees them.',
    ctaLabel: 'See a 2-minute demo',
    ctaUrl: 'https://certivoiq.com/welcome',
    agentName: 'CertivoIQ Sales',
    agentEmail: 'sales@certivoiq.com',
  },
}
