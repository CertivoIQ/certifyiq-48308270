export const TOKEN_STATUS = Object.freeze({
  valid: "VALID",
  invalid: "INVALID",
  expired: "EXPIRED",
  notYetValid: "NOT_YET_VALID",
  consumed: "CONSUMED",
  bindingMismatch: "BINDING_MISMATCH",
});

export function evaluateTransmissionToken({
  token,
  submissionId,
  manifestSha256,
  destinationAgencyId,
  evaluatedAt = new Date().toISOString(),
} = {}) {
  if (
    !token ||
    !token.tokenId ||
    !token.submissionId ||
    !token.manifestSha256 ||
    !token.destinationAgencyId ||
    !token.issuedAt ||
    !token.expiresAt
  ) {
    return {
      tokenStatus: TOKEN_STATUS.invalid,
      authorized: false,
      reason: "A complete transmission authorization token is required.",
    };
  }

  if (
    token.submissionId !== submissionId ||
    token.manifestSha256 !== manifestSha256 ||
    token.destinationAgencyId !== destinationAgencyId
  ) {
    return {
      tokenStatus: TOKEN_STATUS.bindingMismatch,
      authorized: false,
      reason:
        "The transmission token is not bound to this submission, manifest, and destination.",
    };
  }

  if (token.consumedAt) {
    return {
      tokenStatus: TOKEN_STATUS.consumed,
      authorized: false,
      reason: "The transmission authorization token has already been consumed.",
    };
  }

  const now = new Date(evaluatedAt).getTime();
  const issuedAt = new Date(token.issuedAt).getTime();
  const expiresAt = new Date(token.expiresAt).getTime();

  if (
    Number.isNaN(now) ||
    Number.isNaN(issuedAt) ||
    Number.isNaN(expiresAt)
  ) {
    return {
      tokenStatus: TOKEN_STATUS.invalid,
      authorized: false,
      reason: "The transmission token contains an invalid timestamp.",
    };
  }

  if (now < issuedAt) {
    return {
      tokenStatus: TOKEN_STATUS.notYetValid,
      authorized: false,
      reason: "The transmission token is not yet valid.",
    };
  }

  if (now > expiresAt) {
    return {
      tokenStatus: TOKEN_STATUS.expired,
      authorized: false,
      reason: "The transmission authorization token has expired.",
    };
  }

  return {
    tokenStatus: TOKEN_STATUS.valid,
    authorized: true,
    tokenId: token.tokenId,
    submissionId,
    manifestSha256,
    destinationAgencyId,
  };
}
