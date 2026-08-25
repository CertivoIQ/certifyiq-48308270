import { createHash } from "node:crypto";

export const HUD_SOURCE_PIPELINE_BUILD = "hud-source-pipeline-2026.08.25.1";
export const HUD_DATASET_SCHEDULE_URL =
  "https://www.huduser.gov/portal/datasets/update-schedule.html";

export const TRACKED_HUD_DATASETS = Object.freeze([
  ["HUD_50TH_PERCENTILE_RENTS", "50th Percentile Rent Estimates"],
  ["HUD_ANNUAL_ADJUSTMENT_FACTORS", "Annual Adjustment Factors"],
  ["HUD_PASSBOOK_RATE", "Annual Inflationary Adjustments and Passbook Rate"],
  ["HUD_CDBG_INCOME_LIMITS", "CDBG Income Limits"],
  ["HUD_CHAS", "Consolidated Planning/CHAS Data"],
  ["HUD_FMR", "Fair Market Rents (FMRs)"],
  ["HUD_HAF_INCOME_LIMITS", "Homeowner Assistance Fund (HAF) Income Limits"],
  ["HUD_HOPWA_INCOME_LIMITS", "HOPWA Income Limits"],
  ["HUD_HOME_VALUE_LIMITS", "HOME Homeownership Value Limits"],
  ["HUD_HOME_INCOME_LIMITS", "HOME Income Limits"],
  ["HUD_HOME_RENT_LIMITS", "HOME Rent Limits"],
  ["HUD_HTF_VALUE_LIMITS", "Housing Trust Fund (HTF) Homeownership Value Limits"],
  ["HUD_HTF_INCOME_LIMITS", "Housing Trust Fund (HTF) Income Limits"],
  ["HUD_HTF_RENT_LIMITS", "Housing Trust Fund (HTF) Rent Limits"],
  ["HUD_INCOME_LIMITS", "Income Limits"],
  ["HUD_LIHTC_PROPERTY", "Low-Income Housing Tax Credit (LIHTC): Property Level Data"],
  ["HUD_LIHTC_TENANT", "Low-Income Housing Tax Credit (LIHTC): Tenant Level Data"],
  ["HUD_LOW_VACANCY_AREAS", "Low-Vacancy Areas"],
  ["HUD_MTSP_INCOME_LIMITS", "Multifamily Tax Subsidy Projects (MTSP) Income Limits"],
  ["HUD_UTILITY_FACTORS", "Multifamily Utility Allowance Factors"],
  ["HUD_NSP_INCOME_LIMITS", "Neighborhood Stabilization Program (NSP) Income Limits"],
  ["HUD_OPPORTUNITY_ZONES", "Opportunity Zones Activity Map"],
  ["HUD_PUBLIC_USE_MICRODATA", "Public Use Microdata Sample"],
  ["HUD_QCT_DDA", "Qualified Census Tracts (QCTs) and Difficult Development Area (DDAs)"],
  ["HUD_RENEWAL_INFLATION", "Renewal Funding Inflation Factors"],
  ["HUD_SAFMR", "Small Area Fair Market Rents"],
  ["HUD_SPECIAL_TABULATIONS", "Special Tabulations of Households"],
  ["HUD_BUILDING_PERMITS", "State of the Cities Data Systems – Building Permits"],
  ["HUD_URA_INCOME_LIMITS", "Uniform Relocation Act (URA) Income Limits"],
  ["HUD_USPS_VACANCIES", "USPS Vacancies Data"],
  ["HUD_USPS_ZIP_CROSSWALK", "USPS ZIP Code Crosswalk Files"],
].map(([datasetId, scheduleName]) => Object.freeze({ datasetId, scheduleName })));

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MIN_TRACKED_ROWS = 20;

function decodeHtml(text) {
  return text
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function validateOfficialHudUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return (
      url.protocol === "https:" &&
      ["huduser.gov", "www.huduser.gov"].includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function parseHudDatasetScheduleHtml(html) {
  const rows = [...String(html ?? "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) =>
      [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
        decodeHtml(cell[1]),
      ),
    )
    .filter((cells) => cells.length >= 3);

  return TRACKED_HUD_DATASETS.flatMap(({ datasetId, scheduleName }) => {
    const wanted = normalized(scheduleName);
    const cells = rows.find((candidate) => {
      const actual = normalized(candidate[0]);
      return actual === wanted || actual.startsWith(`${wanted} `);
    });
    if (!cells) return [];
    return [{
      dataset_id: datasetId,
      dataset_name: cells[0],
      most_recent_release: cells[1],
      expected_next_update: cells[2],
    }];
  });
}

export function compareHudSourceVersion(previousSha256, nextSha256) {
  if (!SHA256_PATTERN.test(String(nextSha256 ?? ""))) {
    throw new Error("nextSha256 must be a lowercase SHA-256 digest");
  }
  if (!previousSha256) return "INITIAL";
  if (!SHA256_PATTERN.test(String(previousSha256))) {
    throw new Error("previousSha256 must be a lowercase SHA-256 digest");
  }
  return previousSha256 === nextSha256 ? "UNCHANGED" : "CHANGED";
}

export function prepareHudSourceSnapshot({
  sourceUrl,
  finalUrl,
  body,
  contentType,
  retrievedAt,
} = {}) {
  if (!validateOfficialHudUrl(sourceUrl) || !validateOfficialHudUrl(finalUrl)) {
    return { stage_status: "BLOCKED", reason_code: "NON_OFFICIAL_SOURCE" };
  }
  const bytes = body instanceof Uint8Array ? body : Buffer.from(String(body ?? ""), "utf8");
  if (!bytes.byteLength || bytes.byteLength > MAX_SOURCE_BYTES) {
    return { stage_status: "BLOCKED", reason_code: "SOURCE_SIZE_INVALID" };
  }
  if (!String(contentType ?? "").toLowerCase().includes("text/html")) {
    return { stage_status: "BLOCKED", reason_code: "SOURCE_CONTENT_TYPE_INVALID" };
  }
  const retrieved = new Date(String(retrievedAt ?? ""));
  if (Number.isNaN(retrieved.valueOf())) {
    return { stage_status: "BLOCKED", reason_code: "RETRIEVED_AT_INVALID" };
  }
  const html = Buffer.from(bytes).toString("utf8");
  if (!/Dataset Update Schedule/i.test(html)) {
    return { stage_status: "BLOCKED", reason_code: "SCHEDULE_MARKER_MISSING" };
  }
  const datasetRows = parseHudDatasetScheduleHtml(html);
  if (datasetRows.length < MIN_TRACKED_ROWS) {
    return {
      stage_status: "BLOCKED",
      reason_code: "TRACKED_DATASET_ROWS_INCOMPLETE",
      tracked_rows: datasetRows.length,
    };
  }
  return {
    stage_status: "VALIDATED_FOR_STAGING",
    activation_status: "BLOCKED_PENDING_SEPARATE_HUMAN_APPROVAL",
    source_url: sourceUrl,
    final_url: finalUrl,
    source_sha256: createHash("sha256").update(bytes).digest("hex"),
    retrieved_at: retrieved.toISOString(),
    content_type: String(contentType).split(";", 1)[0].toLowerCase(),
    content_length: bytes.byteLength,
    parser_build: HUD_SOURCE_PIPELINE_BUILD,
    dataset_rows: datasetRows,
    tracked_dataset_count: datasetRows.length,
    communication_allowed: false,
    compliance_activation_allowed: false,
  };
}
