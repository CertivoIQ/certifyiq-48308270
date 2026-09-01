/**
 * Permanent fail-closed compatibility shim. No AI provider is constructed.
 * Remove callers rather than replacing this with a network implementation
 * until authentication, organization membership, entitlement, revocation,
 * bounded rate limits, and an approved non-Lovable provider are verified.
 */
export function createLovableAiGatewayProvider(_apiKey: string): never {
  throw new Error('AI provider disabled pending approved non-Lovable controls.')
}
