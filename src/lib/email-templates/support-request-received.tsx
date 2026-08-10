import React from 'react'
import { Preview } from '@react-email/components'
import type { EmailTemplateData, TemplateEntry } from './registry'
import { emailT, type EmailLocale } from './i18n'
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
  locale?: EmailLocale
}

const Email = ({
  name,
  caseNumber,
  subject,
  supportUrl = 'https://certivoiq.com/contact-support',
  locale = 'en',
}: Props) => {
  const t = (key: Parameters<typeof emailT>[1], vars?: Record<string, string | number>) =>
    emailT(locale, key, vars)
  const caseLabel = caseNumber ?? t('support.pending')

  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Preview>{t('support.preview', { caseNumber: caseNumber ?? '#' })}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Brand locale={locale} />
          <Heading style={heading}>{t('support.heading')}</Heading>
          <Text style={text}>
            {name ? t('support.greeting.named', { name }) : t('support.greeting.plain')}{' '}
            {t('support.body')}
          </Text>

          <Section
            style={{ padding: '14px 16px', backgroundColor: '#f8f9fc', borderRadius: '8px', marginBottom: '20px' }}
          >
            <Text style={{ ...text, margin: 0, fontWeight: 600 }}>
              {t('support.caseNumber', { caseNumber: caseLabel })}
            </Text>
            {subject && (
              <Text style={{ ...text, margin: '6px 0 0 0', color: BRAND.muted }}>
                {t('support.subjectLine', { subject })}
              </Text>
            )}
          </Section>

          <Text style={text}>{t('support.turnaround')}</Text>

          <Section style={{ paddingBottom: '14px' }}>
            <CtaButton href={supportUrl}>{t('support.cta')}</CtaButton>
          </Section>
          <Hr style={hr} />
          <Text style={small}>{t('support.footer')}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: EmailTemplateData) =>
    emailT(data['locale'], 'support.subject', { caseNumber: data['caseNumber'] ?? '#' }),
  displayName: 'Support request received',
  previewData: {
    name: 'Jordan',
    caseNumber: 'SC-00042',
    subject: 'Question about LIHTC income limits',
    supportUrl: 'https://certivoiq.com/contact-support',
    locale: 'en',
  },
} satisfies TemplateEntry
