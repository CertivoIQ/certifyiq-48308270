import React from 'react'
import { Preview } from '@react-email/components'
import type { EmailTemplateData, TemplateEntry } from './registry'
import { emailT, localeOf, type EmailLocale } from './i18n'
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
  company?: string
  landingUrl?: string
  agentName?: string
  agentTitle?: string
  agentEmail?: string
  locale?: EmailLocale
}

function Bar({ label, value, width, color }: { label: string; value: string; width: string; color: string }) {
  return (
    <Section style={{ paddingBottom: '10px' }}>
      <Text style={{ ...small, color: BRAND.ink, margin: '0 0 4px', fontWeight: 600 }}>
        {label} — {value}
      </Text>
      <Section style={{ backgroundColor: '#eef0f6', borderRadius: '6px', height: '12px', width: '100%' }}>
        <Section style={{ backgroundColor: color, borderRadius: '6px', height: '12px', width }} />
      </Section>
    </Section>
  )
}

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <Section style={{ display: 'inline-block', width: '160px', verticalAlign: 'top', border: `1px solid ${BRAND.border}`, borderRadius: '10px', padding: '14px 12px', margin: '0 6px 10px 0', textAlign: 'center' as const }}>
      <Text style={{ margin: 0, fontSize: '22px', fontWeight: 700, color }}>{value}</Text>
      <Text style={{ ...small, margin: '4px 0 0' }}>{label}</Text>
    </Section>
  )
}

function RiskRow({ risk, cost }: { risk: string; cost: string }) {
  return (
    <Section style={{ borderLeft: `3px solid ${BRAND.red}`, padding: '2px 0 2px 12px', margin: '0 0 12px' }}>
      <Text style={{ ...text, margin: 0, fontWeight: 600 }}>{risk}</Text>
      <Text style={{ ...small, margin: '2px 0 0', color: BRAND.red }}>{cost}</Text>
    </Section>
  )
}

const Email = ({
  name,
  company,
  landingUrl = 'https://certivoiq.com/welcome',
  agentName = 'The CertivoIQ Team',
  agentTitle,
  agentEmail = 'hello@certivoiq.com',
  locale = 'en',
}: Props) => {
  const t = (key: Parameters<typeof emailT>[1], vars?: Record<string, string | number>) =>
    emailT(locale, key, vars)

  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Preview>{t('intro.preview', { company: company ?? '' })}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Brand locale={locale} />

          <Heading style={heading}>
            {t('intro.heading.pre')}{' '}
            <span style={{ color: BRAND.red }}>{t('intro.heading.accent')}</span>
          </Heading>
          <Text style={text}>
            {name ? t('intro.greeting.named', { name }) : t('intro.greeting.plain')}{' '}
            {t('intro.body', { company: company ? t('intro.body.company', { company }) : '' })}
          </Text>

          <Hr style={hr} />

          <Text style={{ ...small, fontWeight: 700, color: BRAND.navy, margin: '0 0 12px', letterSpacing: '0.6px' }}>
            {t('intro.section.what')}
          </Text>
          <Section style={{ paddingBottom: '4px' }}>
            <StatCard value="4 min" label={t('intro.stat.time')} color={BRAND.navy} />
            <StatCard value="50" label={t('intro.stat.states')} color={BRAND.navy} />
            <StatCard value="6" label={t('intro.stat.programs')} color={BRAND.navy} />
            <StatCard value="100%" label={t('intro.stat.signoff')} color={BRAND.green} />
          </Section>

          <Hr style={hr} />

          <Text style={{ ...small, fontWeight: 700, color: BRAND.navy, margin: '0 0 12px', letterSpacing: '0.6px' }}>
            {t('intro.section.vs')}
          </Text>
          <Bar label={t('intro.bar.manual')} value={t('intro.bar.manual.value')} width="100%" color={BRAND.red} />
          <Bar label={t('intro.bar.ai')} value={t('intro.bar.ai.value')} width="12%" color={BRAND.green} />
          <Bar label={t('intro.bar.manualChecks')} value={t('intro.bar.manualChecks.value')} width="62%" color={BRAND.amber} />
          <Bar label={t('intro.bar.aiChecks')} value={t('intro.bar.aiChecks.value')} width="100%" color={BRAND.green} />

          <Hr style={hr} />

          <Text style={{ ...small, fontWeight: 700, color: BRAND.navy, margin: '0 0 12px', letterSpacing: '0.6px' }}>
            {t('intro.section.benefits')}
          </Text>
          <Text style={text}>
            • {t('intro.benefit.1')}
            <br />• {t('intro.benefit.2')}
            <br />• {t('intro.benefit.3')}
            <br />• {t('intro.benefit.5')}
          </Text>

          <Hr style={hr} />

          <Text style={{ ...small, fontWeight: 700, color: BRAND.navy, margin: '0 0 12px', letterSpacing: '0.6px' }}>
            {t('intro.section.pricing')}
          </Text>
          <Section style={{ border: `1px solid ${BRAND.border}`, borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
            <Text style={{ ...text, margin: 0, fontWeight: 700, fontSize: '18px', color: BRAND.navy }}>
              CertivoIQ Platform — $65,000/year
            </Text>
            <Text style={{ ...small, margin: '6px 0 0' }}>
              One annual subscription includes all generally available platform capabilities. No feature tiers or training add-ons.
            </Text>
          </Section>

          <Text style={{ ...small, fontWeight: 700, color: BRAND.red, margin: '0 0 12px', letterSpacing: '0.6px' }}>
            {t('intro.section.risk')}
          </Text>
          <RiskRow risk={t('intro.risk.1')} cost={t('intro.risk.1.cost')} />
          <RiskRow risk={t('intro.risk.2')} cost={t('intro.risk.2.cost')} />
          <RiskRow risk={t('intro.risk.3')} cost={t('intro.risk.3.cost')} />
          <RiskRow risk={t('intro.risk.4')} cost={t('intro.risk.4.cost')} />

          <Hr style={hr} />

          <Section style={{ paddingBottom: '14px' }}>
            <CtaButton href={landingUrl}>{t('intro.cta')}</CtaButton>
          </Section>
          <Text style={small}>
            {t('intro.startFree')} <Link href={landingUrl}>{landingUrl}</Link>{' '}
            {t('intro.startFree.detail')}
          </Text>

          <Hr style={hr} />
          <Text style={{ ...text, margin: 0 }}>{agentName}</Text>
          {agentTitle && <Text style={{ ...small, margin: '2px 0 0' }}>{agentTitle}</Text>}
          <Text style={{ ...small, margin: '2px 0 0' }}>
            <Link href={`mailto:${agentEmail}`}>{agentEmail}</Link> · {t('intro.signature')}
          </Text>
          <Text style={{ ...small, marginTop: '14px' }}>{t('intro.unsubscribe')}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: EmailTemplateData) =>
    data['company']
      ? emailT(localeOf(data), 'intro.subject.company', { company: String(data['company']) })
      : emailT(localeOf(data), 'intro.subject.generic'),
  displayName: 'Cold intro — CertivoIQ overview',
  previewData: {
    name: 'Dana',
    company: 'Northgate Housing Partners',
    landingUrl: 'https://certivoiq.com/welcome',
    agentName: 'Alex Rivera',
    agentTitle: 'Compliance Solutions, CertivoIQ',
    agentEmail: 'alex@certivoiq.com',
    locale: 'en',
  },
} satisfies TemplateEntry
