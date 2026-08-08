/**
 * State coverage registry.
 *
 * Agency identities and homepages are seeded from the NCSHA state HFA directory
 * (https://www.ncsha.org/housing-help/) and HUD's state pages
 * (https://www.hud.gov/states). This registry is NOT itself a compliance rule
 * pack: the presence of a state here means only that the controlling agency has
 * been identified. A state may move to `validated` only after its controlling
 * sources, effective dates, rules, fixtures, expected results and independent
 * expert approval are stored in `state_rule_sources` and
 * `state_rule_pack_releases`.
 */

export type CoverageStatus = "federal_baseline" | "in_review" | "validated" | "suspended";

export type StateCoverage = {
  code: string;
  state: string;
  primaryAgency: string;
  agencyUrl: string;
  status: CoverageStatus;
  validatedRuleCount: number;
  effectiveDate: string | null;
  lastReviewedAt: string | null;
  reviewedBy: string | null;
  limitations: string;
};

const FEDERAL_ONLY_LIMITATION =
  "Federal baseline only — state-specific review required. No state rule pack has been validated for this jurisdiction.";

const seed: [string, string, string, string][] = [
  ["AL", "Alabama", "Alabama Housing Finance Authority", "https://www.ahfa.com"],
  ["AK", "Alaska", "Alaska Housing Finance Corporation", "https://www.ahfc.us"],
  ["AZ", "Arizona", "Arizona Department of Housing", "https://housing.az.gov"],
  ["AR", "Arkansas", "Arkansas Development Finance Authority", "https://adfa.arkansas.gov"],
  ["CA", "California", "California Tax Credit Allocation Committee", "https://www.treasurer.ca.gov/ctcac"],
  ["CO", "Colorado", "Colorado Housing and Finance Authority", "https://www.chfainfo.com"],
  ["CT", "Connecticut", "Connecticut Housing Finance Authority", "https://www.chfa.org"],
  ["DE", "Delaware", "Delaware State Housing Authority", "https://www.destatehousing.com"],
  ["DC", "District of Columbia", "DC Department of Housing and Community Development", "https://dhcd.dc.gov"],
  ["FL", "Florida", "Florida Housing Finance Corporation", "https://www.floridahousing.org"],
  ["GA", "Georgia", "Georgia Department of Community Affairs", "https://dca.georgia.gov"],
  ["HI", "Hawaii", "Hawaii Housing Finance and Development Corporation", "https://dbedt.hawaii.gov/hhfdc"],
  ["ID", "Idaho", "Idaho Housing and Finance Association", "https://www.idahohousing.com"],
  ["IL", "Illinois", "Illinois Housing Development Authority", "https://www.ihda.org"],
  ["IN", "Indiana", "Indiana Housing and Community Development Authority", "https://www.in.gov/ihcda"],
  ["IA", "Iowa", "Iowa Finance Authority", "https://www.iowafinance.com"],
  ["KS", "Kansas", "Kansas Housing Resources Corporation", "https://kshousingcorp.org"],
  ["KY", "Kentucky", "Kentucky Housing Corporation", "https://www.kyhousing.org"],
  ["LA", "Louisiana", "Louisiana Housing Corporation", "https://www.lhc.la.gov"],
  ["ME", "Maine", "MaineHousing", "https://www.mainehousing.org"],
  ["MD", "Maryland", "Maryland Department of Housing and Community Development", "https://dhcd.maryland.gov"],
  ["MA", "Massachusetts", "Massachusetts Executive Office of Housing and Livable Communities", "https://www.mass.gov/eohlc"],
  ["MI", "Michigan", "Michigan State Housing Development Authority", "https://www.michigan.gov/mshda"],
  ["MN", "Minnesota", "Minnesota Housing", "https://www.mnhousing.gov"],
  ["MS", "Mississippi", "Mississippi Home Corporation", "https://www.mshomecorp.com"],
  ["MO", "Missouri", "Missouri Housing Development Commission", "https://www.mhdc.com"],
  ["MT", "Montana", "Montana Board of Housing / Montana Housing", "https://housing.mt.gov"],
  ["NE", "Nebraska", "Nebraska Investment Finance Authority", "https://www.nifa.org"],
  ["NV", "Nevada", "Nevada Housing Division", "https://housing.nv.gov"],
  ["NH", "New Hampshire", "New Hampshire Housing Finance Authority", "https://www.nhhfa.org"],
  ["NJ", "New Jersey", "New Jersey Housing and Mortgage Finance Agency", "https://www.njhousing.gov"],
  ["NM", "New Mexico", "New Mexico Mortgage Finance Authority", "https://housingnm.org"],
  ["NY", "New York", "New York State Homes and Community Renewal", "https://hcr.ny.gov"],
  ["NC", "North Carolina", "North Carolina Housing Finance Agency", "https://www.nchfa.com"],
  ["ND", "North Dakota", "North Dakota Housing Finance Agency", "https://www.ndhfa.org"],
  ["OH", "Ohio", "Ohio Housing Finance Agency", "https://ohiohome.org"],
  ["OK", "Oklahoma", "Oklahoma Housing Finance Agency", "https://www.ohfa.org"],
  ["OR", "Oregon", "Oregon Housing and Community Services", "https://www.oregon.gov/ohcs"],
  ["PA", "Pennsylvania", "Pennsylvania Housing Finance Agency", "https://www.phfa.org"],
  ["RI", "Rhode Island", "Rhode Island Housing", "https://www.rihousing.com"],
  ["SC", "South Carolina", "SC State Housing Finance and Development Authority", "https://www.schousing.com"],
  ["SD", "South Dakota", "South Dakota Housing Development Authority", "https://www.sdhousing.org"],
  ["TN", "Tennessee", "Tennessee Housing Development Agency", "https://thda.org"],
  ["TX", "Texas", "Texas Department of Housing and Community Affairs", "https://www.tdhca.texas.gov"],
  ["UT", "Utah", "Utah Housing Corporation", "https://utahhousingcorp.org"],
  ["VT", "Vermont", "Vermont Housing Finance Agency", "https://vhfa.org"],
  ["VA", "Virginia", "Virginia Housing", "https://www.virginiahousing.com"],
  ["WA", "Washington", "Washington State Housing Finance Commission", "https://www.wshfc.org"],
  ["WV", "West Virginia", "West Virginia Housing Development Fund", "https://www.wvhdf.com"],
  ["WI", "Wisconsin", "Wisconsin Housing and Economic Development Authority", "https://www.wheda.com"],
  ["WY", "Wyoming", "Wyoming Community Development Authority", "https://www.wyomingcda.com"],
];

/**
 * Every jurisdiction starts at `federal_baseline`. Do not hand-edit a status
 * here — status is promoted from approved rows in `state_rule_pack_releases`
 * via `applyReleases`.
 */
export const stateCoverage: StateCoverage[] = seed.map(([code, state, primaryAgency, agencyUrl]) => ({
  code: code!,
  state: state!,
  primaryAgency: primaryAgency!,
  agencyUrl: agencyUrl!,
  status: "federal_baseline",
  validatedRuleCount: 0,
  effectiveDate: null,
  lastReviewedAt: null,
  reviewedBy: null,
  limitations: FEDERAL_ONLY_LIMITATION,
}));

export type PackRelease = {
  state_code: string;
  status: CoverageStatus;
  effective_from: string;
  approved_at: string | null;
  approved_by: string | null;
  validated_rule_count: number;
  limitations: string | null;
};

/** Overlays real release records onto the registry. Never invents coverage. */
export function applyReleases(releases: PackRelease[]): StateCoverage[] {
  return stateCoverage.map((entry) => {
    const release = releases.find((row) => row.state_code === entry.code);
    if (!release) return entry;
    return {
      ...entry,
      status: release.status,
      validatedRuleCount: release.validated_rule_count,
      effectiveDate: release.effective_from,
      lastReviewedAt: release.approved_at,
      reviewedBy: release.approved_by,
      limitations: release.limitations ?? entry.limitations,
    };
  });
}

export function isUsableForDetermination(pack: StateCoverage | undefined): boolean {
  return (
    !!pack &&
    pack.status === "validated" &&
    !!pack.reviewedBy &&
    !!pack.effectiveDate &&
    pack.validatedRuleCount > 0
  );
}

export function coverageForState(code: string, packs = stateCoverage): StateCoverage | undefined {
  return packs.find((pack) => pack.code === code.toUpperCase());
}

export const FEDERAL_BASELINE_NOTICE = FEDERAL_ONLY_LIMITATION;

/** The only sanctioned public coverage sentence — generated, never hard-coded. */
export function coverageClaim(packs = stateCoverage, asOf = new Date()): string {
  const validated = packs.filter(isUsableForDetermination).length;
  const date = asOf.toISOString().slice(0, 10);
  if (validated === 0) {
    return `Federal baseline available nationwide; 0 state-specific packs validated as of ${date}. State-specific review is required for every jurisdiction.`;
  }
  return `Federal baseline available nationwide; ${validated} state-specific pack${validated === 1 ? "" : "s"} validated as of ${date}.`;
}

export const RELEASE_CHECKLIST = [
  "Identify every controlling agency and program scope.",
  "Archive the current QAP, compliance manual, forms, notices, limits and utility guidance with content hashes.",
  "Extract candidate requirements with exact citations and effective dates.",
  "Obtain independent compliance-expert review.",
  "Build positive, negative, boundary, layered-program and supersession fixtures.",
  "Require 100% expected results on deterministic release tests.",
  "Record reviewer, approval, validation report and limitations.",
  "Activate prospectively; retain previous versions.",
  "Monitor official sources and suspend affected rules when uncertainty arises.",
] as const;

export const OFFICIAL_STARTING_SOURCES = [
  { name: "NCSHA state HFA directory", url: "https://www.ncsha.org/housing-help/" },
  { name: "HUD state information", url: "https://www.hud.gov/states" },
  { name: "Federal HOME regulations (24 CFR Part 92)", url: "https://www.ecfr.gov/current/title-24/subtitle-A/part-92" },
] as const;
