import React from 'react'
import { Preview } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { PLANS } from '@/lib/platform-data'
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
}

/** Infographic: horizontal comparison bars (email-safe, table-free divs with fixed widths). */
function Bar({ label, value, width, color }: { label: string; value: string; width: string; color: string }) {
  return (
    <Section style={{ paddingBottom: '10px' }}>
      <Text style={{ ...small, color: BRAND.ink, margin: '0 0 4px', fontWeight: 600 }}>
        {label} — {value}
      </Text>
      <Section
        style={{
          backgroundColor: '#eef0f6',
          borderRadius: '6px',
          height: '12px',
          width: '100%',
        }}
      >
        <Section style={{ backgroundColor: color, borderRadius: '6px', height: '12px', width }} />
      </Section>
    </Section>
  )
}

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <Section
      style={{
        display: 'inline-block',
        width: '160px',
        verticalAlign: 'top',
        border: `1px solid ${BRAND.border}`,
        borderRadius: '10px',
        padding: '14px 12px',
        margin: '0 6px 10px 0',
        textAlign: 'center' as const,
      }}
    >
      <Text style={{ margin: 0, fontSize: '22px', fontWeight: 700, color }}>{value}</Text>
      <Text style={{ ...small, margin: '4px 0 0' }}>{label}</Text>
    </Section>
  )
}

function PlanRow({ name, price, tagline }: { name: string; price: string; tagline: string }) {
  return (
    <Section
      style={{
        borderBottom: `1px solid ${BRAND.border}`,
        padding: '8px 0',
        margin: 0,
      }}
    >
      <Text style={{ ...text, margin: 0, fontWeight: 600 }}>
        {name} — <span style={{ color: BRAND.navy }}>{price}/month</span>
      </Text>
      <Text style={{ ...small, margin: '2px 0 0' }}>{tagline}</Text>
    </Section>
  )
}

function RiskRow({ risk, cost }: { risk: string; cost: string }) {
  return (
    <Section
      style={{
        borderLeft: `3px solid ${BRAND.red}`,
        padding: '2px 0 2px 12px',
        margin: '0 0 12px',
      }}
    >
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
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {`Protect ${company ?? 'your'} tax credits — AI compliance review for LIHTC, HOME, Section 8 & HOTMA`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Brand />

        <Heading style={heading}>
          One missed certification can cost{' '}
          <span style={{ color: BRAND.red }}>years of tax credits</span>
        </Heading>
        <Text style={text}>
          {name ? `Hi ${name},` : 'Hi there,'} CertivoIQ is an AI compliance platform built for affordable housing
          teams{company ? ` like ${company}` : ''}. Every tenant income certification is reviewed against the exact
          rule pack assigned to that property — LIHTC §42, HOME, Section 8/PBS8, HOTMA, Rural Development and
          Tax-Exempt Bond — and returned with a Pass or Fail score, cited findings and written correction steps before
          an auditor ever sees the file.
        </Text>

        <Hr style={hr} />

        <Text style={{ ...small, fontWeight: 700, color: BRAND.navy, margin: '0 0 12px', letterSpacing: '0.6px' }}>
          WHAT THE PLATFORM DOES
        </Text>
        <Section style={{ paddingBottom: '4px' }}>
          <StatCard value="4 min" label="Average AI review time per certification" color={BRAND.navy} />
          <StatCard value="50" label="States covered with maintained rule packs" color={BRAND.navy} />
          <StatCard value="6" label="Programs: LIHTC, HOME, S8, HOTMA, RD, Bond" color={BRAND.navy} />
          <StatCard value="100%" label="Files scored, cited and human signed off" color={BRAND.green} />
        </Section>

        <Hr style={hr} />

        <Text style={{ ...small, fontWeight: 700, color: BRAND.navy, margin: '0 0 12px', letterSpacing: '0.6px' }}>
          MANUAL REVIEW VS. CERTIVOIQ
        </Text>
        <Bar label="Manual file review" value="~41 minutes per certification" width="100%" color={BRAND.red} />
        <Bar label="CertivoIQ AI review" value="~4 minutes, then human sign-off" width="12%" color={BRAND.green} />
        <Bar label="Rule checks applied manually" value="most items, most of the time" width="62%" color={BRAND.amber} />
        <Bar label="Rule checks applied by CertivoIQ" value="every item, every time" width="100%" color={BRAND.green} />

        <Hr style={hr} />

        <Text style={{ ...small, fontWeight: 700, color: BRAND.navy, margin: '0 0 12px', letterSpacing: '0.6px' }}>
          HOW ENTERPRISES BENEFIT
        </Text>
        <Text style={text}>
          • Portfolio-wide visibility — findings, verdicts and audit readiness across every property and program.
          <br />• Standardized reviews — the same rule logic applied by every reviewer, in every state.
          <br />• Faster file throughput without adding compliance headcount.
          <br />• CertivoIQ Academy training and Certificates of Achievement to onboard new reviewers.
          <br />• Merlin, the AI compliance assistant, cites the governing rule the moment a reviewer gets stuck.
        </Text>

        <Hr style={hr} />

        <Text style={{ ...small, fontWeight: 700, color: BRAND.navy, margin: '0 0 12px', letterSpacing: '0.6px' }}>
          PLANS &amp; PRICING
        </Text>
        {PLANS.map((p) => (
          <PlanRow key={p.id} name={p.name} price={p.price} tagline={p.tagline} />
        ))}
        <Text style={{ ...small, margin: '10px 0 0' }}>
          Add-ons: additional state rule packs $99–$199/state/month · CertivoIQ Academy $49/user/month or
          $499/property/month · API access $500–$2,000/month · AI document processing beyond plan allowance $3 per
          uploaded certification.
        </Text>

        <Text style={{ ...small, fontWeight: 700, color: BRAND.red, margin: '0 0 12px', letterSpacing: '0.6px' }}>
          THE COST OF NON-COMPLIANCE
        </Text>
        <RiskRow risk="Non-curable §42 findings" cost="IRS Form 8823 filing and recapture of allocated credits" />
        <RiskRow risk="Failed state agency audit" cost="Repayment agreements, withheld allocations, reputational damage" />
        <RiskRow risk="Section 8 / TRACS errors" cost="Subsidy repayment and HUD-imposed corrective action" />
        <RiskRow risk="HOTMA implementation gaps" cost="Systemic recertification errors across an entire portfolio" />

        <Hr style={hr} />

        <Section style={{ paddingBottom: '14px' }}>
          <CtaButton href={landingUrl}>See the 4-minute platform walkthrough</CtaButton>
        </Section>
        <Text style={small}>
          Or start free: <Link href={landingUrl}>{landingUrl}</Link> — 7-day trial with 3 full AI certification
          reviews, no card required.
        </Text>

        <Hr style={hr} />
        <Text style={{ ...text, margin: 0 }}>{agentName}</Text>
        {agentTitle && <Text style={{ ...small, margin: '2px 0 0' }}>{agentTitle}</Text>}
        <Text style={{ ...small, margin: '2px 0 0' }}>
          <Link href={`mailto:${agentEmail}`}>{agentEmail}</Link> · CertivoIQ — compliance intelligence for all 50
          states
        </Text>
        <Text style={{ ...small, marginTop: '14px' }}>
          You received this introduction because your organization operates affordable housing. Reply with
          &quot;unsubscribe&quot; and we will not contact you again.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data['company']
      ? `${data['company']}: protect your tax credits before the next audit`
      : 'Protect your tax credits before the next audit — CertivoIQ',
  displayName: 'Cold intro — CertivoIQ overview',
  previewData: {
    name: 'Dana',
    company: 'Northgate Housing Partners',
    landingUrl: 'https://certivoiq.com/welcome',
    agentName: 'Alex Rivera',
    agentTitle: 'Compliance Solutions, CertivoIQ',
    agentEmail: 'alex@certivoiq.com',
  },
} satisfies TemplateEntry
