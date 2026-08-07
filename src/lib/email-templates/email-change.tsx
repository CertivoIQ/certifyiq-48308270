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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Brand />
        <Heading style={heading}>Confirm your email change</Heading>
        <Text style={text}>
          You requested to change your email address for {siteName} from{' '}
          <a href={`mailto:${oldEmail}`} style={{ color: BRAND.navy, textDecoration: 'underline' }}>
            {oldEmail}
          </a>{' '}
          to{' '}
          <a href={`mailto:${newEmail}`} style={{ color: BRAND.navy, textDecoration: 'underline' }}>
            {newEmail}
          </a>
          .
        </Text>
        <Text style={text}>Click the button below to confirm this change:</Text>
        <Section style={{ paddingBottom: '14px' }}>
          <CtaButton href={confirmationUrl}>Confirm Email Change</CtaButton>
        </Section>
        <Text style={{ ...text, fontSize: '13px', color: BRAND.muted, marginTop: '24px' }}>
          If you didn't request this change, please secure your account immediately.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
