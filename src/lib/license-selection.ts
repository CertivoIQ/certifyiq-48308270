import { LICENSES, type LicenseKind } from "./plan-catalog.ts";

export const US_STATE_CODE_LIST = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
] as const;
export const US_STATE_CODES = new Set<string>(US_STATE_CODE_LIST);

export interface LicenseSelection {
  licenseKind: LicenseKind;
  stateCodes: string[];
  priceLookupKey: string;
  firstInstallmentPriceLookupKey: string;
  quantity: number;
  annualAmountUsd: number;
  monthlyAmountCents: number;
  firstInstallmentAmountCents: number;
  commitmentMonths: 12;
}

export function normalizeLicenseSelection(input: {
  licenseKind: string;
  stateCodes: readonly string[];
}): LicenseSelection {
  if (input.licenseKind !== "multifamily_enterprise" && input.licenseKind !== "pha")
    throw new Error("Unsupported license type");
  const stateCodes = [
    ...new Set(input.stateCodes.map((value) => value.trim().toUpperCase())),
  ].sort();
  if (!stateCodes.length || stateCodes.length !== input.stateCodes.length)
    throw new Error("Select one or more unique state rule packs");
  if (!stateCodes.every((state) => US_STATE_CODES.has(state)))
    throw new Error("State rule-pack selection contains an invalid jurisdiction");
  if (input.licenseKind === "pha" && stateCodes.length !== 1)
    throw new Error("PHA licensing requires exactly one operating-state rule pack");
  const license = LICENSES[input.licenseKind];
  const quantity = input.licenseKind === "multifamily_enterprise" ? stateCodes.length : 1;
  const monthlyAmountCents =
    input.licenseKind === "multifamily_enterprise" ? 541_667 * quantity : 1_250_000;
  const firstInstallmentAmountCents =
    input.licenseKind === "multifamily_enterprise" ? 541_663 * quantity : monthlyAmountCents;
  return {
    licenseKind: input.licenseKind,
    stateCodes,
    priceLookupKey: license.priceId,
    firstInstallmentPriceLookupKey: license.firstInstallmentPriceId,
    quantity,
    annualAmountUsd: license.annualAmountUsd * quantity,
    monthlyAmountCents,
    firstInstallmentAmountCents,
    commitmentMonths: 12,
  };
}


