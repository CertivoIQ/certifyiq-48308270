export function isVerifiedClosedWon(account) {
  return Boolean(
    account &&
      account.stage === "won" &&
      account.is_demo === false &&
      (account.contract_verified_at || account.payment_verified_at),
  );
}

export function verifiedSaleTriggerReason(account) {
  if (!isVerifiedClosedWon(account)) return null;
  if (account.contract_verified_at && account.payment_verified_at) {
    return "contract_and_payment_verified";
  }
  if (account.contract_verified_at) return "contract_verified";
  return "payment_verified";
}

export function shouldSurfacePostSaleChecklist(checklist) {
  return Boolean(
    checklist &&
      (checklist.status === "pending" || checklist.status === "acknowledged"),
  );
}
