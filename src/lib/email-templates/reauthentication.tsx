import React from 'react'
import { Preview } from '@react-email/components'
import {
  BRAND,
  Body,
  Container,
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

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Brand />
        <Heading style={heading}>Confirm reauthentication</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Section
          style={{
            padding: '16px',
            backgroundColor: '#f8f9fc',
            borderRadius: '8px',
            border: `1px solid ${BRAND.border}`,
            marginBottom: '20px',
          }}
        >
          <Text
            style={{
              fontFamily: '"IBM Plex Mono", Courier, monospace',
              fontSize: '28px',
              fontWeight: 700,
              letterSpacing: '4px',
              color: BRAND.navy,
              margin: 0,
              textAlign: 'center',
            }}
          >
            {token}
          </Text>
        </Section>
        <Text style={{ ...text, fontSize: '13px', color: BRAND.muted, marginTop: '24px' }}>
          This code will expire shortly. If you didn't request this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
