import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

function runtimeSourceFiles(directory = path.join(root, 'src')) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...runtimeSourceFiles(absolute))
    else if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) files.push(absolute)
  }
  return files
}

test('runtime source cannot construct or authenticate a Lovable provider request', () => {
  const prohibited = [
    /from\s+['"]@lovable\.dev\//,
    /sendLovableEmail/,
    /LOVABLE_API_KEY/,
    /LOVABLE_SEND_URL/,
    /ai\.gateway\.lovable\.dev/,
  ]

  const violations = []
  for (const file of runtimeSourceFiles()) {
    const source = fs.readFileSync(file, 'utf8')
    for (const pattern of prohibited) {
      if (pattern.test(source)) {
        violations.push(`${path.relative(root, file)} matched ${pattern}`)
      }
    }
  }
  assert.deepEqual(violations, [])
})

test('transactional email and legacy email routes fail closed', () => {
  assert.match(read('src/lib/email-templates/send-email.ts'), /EMAIL_PROVIDER_DISABLED/)
  for (const route of [
    'src/routes/lovable/email/auth/webhook.ts',
    'src/routes/lovable/email/auth/preview.ts',
    'src/routes/lovable/email/transactional/preview.ts',
  ]) {
    const source = read(route)
    assert.match(source, /EMAIL_PROVIDER_DISABLED/)
    assert.match(source, /status:\s*503/)
    assert.match(source, /cache-control['"]?:\s*['"]no-store/)
  }
})

test('deployment responses receive the required security headers', () => {
  const startSource = read('src/start.ts')
  const workerBoundary = read('src/server.ts')
  for (const source of [startSource, workerBoundary]) {
    assert.match(source, /Strict-Transport-Security/)
    assert.match(source, /max-age=31536000; includeSubDomains/)
    assert.match(source, /X-Content-Type-Options/)
    assert.match(source, /nosniff/)
    assert.match(source, /Referrer-Policy/)
    assert.match(source, /strict-origin-when-cross-origin/)
  }
  assert.match(workerBoundary, /withSecurityHeaders\(await normalizeCatastrophicSsrResponse\(response\)\)/)
})

test('browser auth uses normal Supabase storage and no editor telemetry hook', () => {
  assert.doesNotMatch(read('src/integrations/supabase/client.ts'), /previewAuthStorage|brokeredPreviewStorage/)
  assert.doesNotMatch(read('src/routes/__root.tsx'), /reportLovableError|__lovable/)
})

