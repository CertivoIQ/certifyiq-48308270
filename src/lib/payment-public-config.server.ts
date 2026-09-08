export function publicPaymentConfiguration(env: Record<string, string | undefined>) {
  const publishableKey = env['VITE_PAYMENTS_CLIENT_TOKEN']?.trim() ?? '';
  if (!/^pk_(live|test)_[A-Za-z0-9]+$/.test(publishableKey)) {
    throw new Error('Payments are not configured. Please try again later.');
  }
  const environment = publishableKey.startsWith('pk_live_') ? 'live' as const : 'sandbox' as const;
  if (env['NODE_ENV'] === 'production' && environment !== 'live') {
    throw new Error('Production payments require live configuration.');
  }
  // Return only the public Stripe key, never the server environment or credentials.
  return { publishableKey, environment };
}
