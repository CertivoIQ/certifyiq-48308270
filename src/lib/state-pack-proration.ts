export const STATE_PACK_ANNUAL_CENTS = 6_500_000;

/** Prorate against the verified annual contract interval, including leap years. */
export function statePackProration(termStart: number, termEnd: number, at: number) {
  if (![termStart, termEnd, at].every(Number.isSafeInteger) || termEnd <= termStart || at < termStart || at >= termEnd) {
    throw new Error('An active annual contract is required.');
  }
  const days = (termEnd - termStart) / 86400;
  if (days < 364 || days > 367) throw new Error('The annual renewal date could not be verified.');
  const amountCents = Math.round(STATE_PACK_ANNUAL_CENTS * (termEnd - at) / (termEnd - termStart));
  if (amountCents < 50) throw new Error('This contract is too close to renewal to add a state.');
  return { amountCents, annualCents: STATE_PACK_ANNUAL_CENTS, termStart, termEnd, quotedAt: at };
}
