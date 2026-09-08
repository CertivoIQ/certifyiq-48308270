import { COMMERCIAL_TERMS } from "@/lib/plan-catalog";
const PHA_FEATURES = [
  "HCV, PBV, public housing, and Mod Rehab operating workspaces",
  "Family intake, eligibility, annual reexamination, and interim reexamination controls",
  "HUD-50058 transaction routing and reporting controls",
  "HCV, PBV, and public-housing waiting-list workflows",
  "Portability, HCV lease-up, and PBV operations",
  "Public-housing admissions, occupancy, and operations",
  "HOTMA implementation and NSPIRE standards and inspection workflows",
  "Reasonable accommodations, notices, agency policies, users, source library, and agency-wide reporting",
];


export function PhaLicenseReference() { return <section><h2>Internal PHA license reference</h2><p>Historical annual price: ${COMMERCIAL_TERMS.phaAnnualUsd.toLocaleString()}. Not offered for purchase.</p><ul>{PHA_FEATURES.map(feature => <li key={feature}>{feature}</li>)}</ul></section>; }
