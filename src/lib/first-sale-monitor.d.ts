export type VerifiedSaleAccount = {
  stage: string | null;
  is_demo: boolean;
  contract_verified_at: string | null;
  payment_verified_at: string | null;
};

export type PostSaleChecklistState = {
  status: "pending" | "acknowledged" | "completed" | "cancelled";
};

export declare function isVerifiedClosedWon(account: VerifiedSaleAccount | null | undefined): boolean;
export declare function verifiedSaleTriggerReason(
  account: VerifiedSaleAccount | null | undefined,
): "contract_verified" | "payment_verified" | "contract_and_payment_verified" | null;
export declare function shouldSurfacePostSaleChecklist(
  checklist: PostSaleChecklistState | null | undefined,
): boolean;
