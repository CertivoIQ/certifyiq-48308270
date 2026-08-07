import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Img, Link, Section, Text } from '@react-email/components'

export const BRAND = {
  navy: '#131a3a',
  gold: '#f2b441',
  ink: '#1b2033',
  muted: '#5c6480',
  border: '#e3e6ef',
  green: '#0f9d58',
  red: '#d64545',
  amber: '#b98200',
}

export const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
export const container = { maxWidth: '560px', margin: '0 auto', padding: '28px 24px 40px' }
export const heading = { fontSize: '22px', lineHeight: '30px', color: BRAND.ink, margin: '0 0 8px' }
export const text = { fontSize: '15px', lineHeight: '24px', color: BRAND.ink, margin: '0 0 14px' }
export const small = { fontSize: '12.5px', lineHeight: '20px', color: BRAND.muted, margin: '0' }
export const hr = { borderColor: BRAND.border, margin: '24px 0' }

const rowLabel = { fontSize: '12.5px', color: BRAND.muted, margin: '0 0 2px' }
const rowValue = { fontSize: '15px', color: BRAND.ink, margin: '0 0 12px', fontWeight: 600 as const }

export function Brand({ locale }: { locale?: EmailLocale } = {}) {
  return (
    <Section style={{ paddingBottom: '18px' }}>
      <Text style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: BRAND.navy, letterSpacing: '-0.2px' }}>
        Certivo<span style={{ color: BRAND.gold }}>IQ</span>
      </Text>
      <Text style={{ ...small, marginTop: '2px' }}>{emailT(locale, 'brand.tagline')}</Text>
    </Section>
  )
}


export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Section>
      <Text style={rowLabel}>{label}</Text>
      <Text style={rowValue}>{value}</Text>
    </Section>
  )
}

export function CtaButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-block',
        backgroundColor: BRAND.navy,
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 700,
        padding: '12px 20px',
        borderRadius: '8px',
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  )
}

export function Footer() {
  return (
    <>
      <Hr style={hr} />
      <Text style={small}>
        You are receiving this because you have a CertivoIQ billing account. Manage your plan, payment method and
        invoice history any time from your billing page.
      </Text>
    </>
  )
}

export { Body, Container, Head, Heading, Html, Img, Section, Text, Link, Hr }
