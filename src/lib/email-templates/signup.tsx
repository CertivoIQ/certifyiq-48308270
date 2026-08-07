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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Brand />
        <Heading style={heading}>Confirm your email</Heading>
        <Text style={text}>
          Thanks for signing up for{' '}
          <a href={siteUrl} style={{ color: BRAND.navy, textDecoration: 'underline' }}>
            <strong>{siteName}</strong>
          </a>
          !
        </Text>
        <Text style={text}>
          Please confirm your email address ({recipient}) by clicking the button below:
        </Text>
        <Section style={{ paddingBottom: '14px' }}>
          <CtaButton href={confirmationUrl}>Verify Email</CtaButton>
        </Section>
        <Text style={{ ...text, fontSize: '13px', color: BRAND.muted, marginTop: '24px' }}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
