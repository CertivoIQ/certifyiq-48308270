import React from 'react'
import { Preview } from '@react-email/components'
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
  container,
  heading,
  main,
  text,
} from './shared'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Brand />
        <Heading style={heading}>You've been invited</Heading>
        <Text style={text}>
          You've been invited to join{' '}
          <a href={siteUrl} style={{ color: BRAND.navy, textDecoration: 'underline' }}>
            <strong>{siteName}</strong>
          </a>
          . Click the button below to accept the invitation and create your account.
        </Text>
        <Section style={{ paddingBottom: '14px' }}>
          <CtaButton href={confirmationUrl}>Accept Invitation</CtaButton>
        </Section>
        <Text style={{ ...text, fontSize: '13px', color: BRAND.muted, marginTop: '24px' }}>
          If you weren't expecting this invitation, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
