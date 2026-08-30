export const FOUNDERS_PROMOTION = {
  code: "FOUNDERS50",
  couponId: "certivoiq_founders_50_first_year_2026",
  name: "CertivoIQ Founder's Special",
  percentOff: 50,
  duration: "once",
  expiresAtIso: "2026-12-01T06:00:00.000Z",
  firstTimeTransactionOnly: true,
} as const;

export const FOUNDERS_PROMOTION_EXPIRES_AT = Math.floor(
  new Date(FOUNDERS_PROMOTION.expiresAtIso).getTime() / 1000,
);

/** Available through November 30, 2026 in the Central time zone. */
export function foundersPromotionAvailable(at: Date = new Date()): boolean {
  return at.getTime() < new Date(FOUNDERS_PROMOTION.expiresAtIso).getTime();
}
