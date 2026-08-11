import * as React from 'react'
import { createAuthEmailHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = "CertivoIQ"
const SENDER_DOMAIN = "notify.certivoiq.com"
const ROOT_DOMAIN = "certivoiq.com"
const FROM_DOMAIN = "certivoiq.com"
const SITE_URL = `https://${ROOT_DOMAIN}`

// The Lovable email API key is an optional deployment secret. Never create the
// handler at module evaluation time when the key is missing: doing so causes
// the entire TanStack route tree to fail to load and produces a blank screen.
const lovableApiKey = process.env['LOVABLE_API_KEY']

const handler = lovableApiKey
  ? createAuthEmailHandler({
      apiKey: lovableApiKey,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      senderDomain: SENDER_DOMAIN,
      sendUrl: process.env['LOVABLE_SEND_URL'],
      emails: {
        signup: {
          subject: 'Confirm your email',
          render: (data) =>
            React.createElement(SignupEmail, {
              siteName: SITE_NAME,
              siteUrl: SITE_URL,
              recipient: data.email,
              confirmationUrl: data.url,
            }),
        },
        invite: {
          subject: "You've been invited",
          render: (data) =>
            React.createElement(InviteEmail, {
              siteName: SITE_NAME,
              siteUrl: SITE_URL,
              confirmationUrl: data.url,
            }),
        },
        magiclink: {
          subject: 'Your login link',
          render: (data) =>
            React.createElement(MagicLinkEmail, {
              siteName: SITE_NAME,
              confirmationUrl: data.url,
            }),
        },
        recovery: {
          subject: 'Reset your password',
          render: (data) =>
            React.createElement(RecoveryEmail, {
              siteName: SITE_NAME,
              confirmationUrl: data.url,
            }),
        },
        email_change: {
          subject: 'Confirm your new email',
          render: (data) =>
            React.createElement(EmailChangeEmail, {
              siteName: SITE_NAME,
              oldEmail: data.old_email ?? '',
              email: data.email,
              newEmail: data.new_email ?? '',
              confirmationUrl: data.url,
            }),
        },
        reauthentication: {
          subject: 'Your verification code',
          render: (data) =>
            React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
        },
      },
    })
  : null

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => {
        if (!handler) {
          return new Response(
            JSON.stringify({
              error: 'Lovable auth email delivery is not configured for this environment.',
            }),
            {
              status: 503,
              headers: { 'content-type': 'application/json' },
            },
          )
        }

        return handler(request)
      },
    },
  },
})
