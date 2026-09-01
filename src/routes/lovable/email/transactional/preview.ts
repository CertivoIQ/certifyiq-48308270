import { createFileRoute } from '@tanstack/react-router'

const disabled = () =>
  Response.json(
    {
      error: 'Transactional email preview is disabled pending an approved non-Lovable provider.',
      code: 'EMAIL_PROVIDER_DISABLED',
    },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  )

export const Route = createFileRoute('/lovable/email/transactional/preview')({
  server: { handlers: { POST: disabled } },
})
