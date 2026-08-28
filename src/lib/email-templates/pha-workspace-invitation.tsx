import React from 'react'
import { Preview } from '@react-email/components'
import type { EmailTemplateData, TemplateEntry } from './registry'
import { Body, Container, CtaButton, Head, Heading, Html, Brand, Section, Text, Hr, hr, small, container, heading, main, text } from './shared'

interface Props {
  role?: string
  expiresOn?: string
  dashboardUrl?: string
}

const Email = ({ role = 'agency user', expiresOn = 'in 7 days', dashboardUrl = 'https://certivoiq.com/dashboard' }: Props) => (
  <Html lang="en" dir="ltr">">
    <Head />
    <Preview>You have been invited to a CertivoIQ PHA workspace.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Brand locale="en" />
        <Heading style={heading}>You’re invited to a PHA workspace</Heading>
        <Text style={text}>A Public Housing Agency administrator has invited you to CertivoIQ as <strong>{role.replaceAll('_', ' ')}</strong>.</Text>
        <Section style={{ padding: '14px 16px', backgroundColor: '#f8f9fc', borderRadius: '8px', marginBottom: '20px' }}>
          <Text style={{ ...text, margin: 0 }}>This invitation expires {expiresOn}. Sign in with the same email address that received this message; CertivoIQ will verify the email before granting workspace access.</Text>
        </Section>
        <Section style={{ paddingBottom: '14px' }}><CtaButton href={dashboardUrl}>Open CertivoIQ</CtaButton></Section>
        <Hr style={hr} />
        <Text style={small}>If you were not expecting this invitation, you can ignore this message. No workspace access is granted until the invitation is accepted by the matching authenticated email address.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your CertivoIQ PHA workspace invitation',
  displayName: 'PHA workspace invitation',
  previewData: { role: 'hcv_pbv_specialist', expiresOn: 'September 4, 2026', dashboardUrl: 'https://certivoiq.com/dashboard' },
} satisfies TemplateEntry
