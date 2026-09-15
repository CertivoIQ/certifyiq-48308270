/**
 * CertivoIQ Rent & Income Limit engine.
 *
 * Deterministic, fail-closed derivation of program income limits, gross rents
 * and maximum tenant-paid rents from an explicitly resolved limit source.
 *
 * This engine never contains national limit tables and never infers a value.
 * When a controlled HUD dataset is not activated, or a manual sourced limit set
 * is incomplete, every affected output is Not Determined with the exact
 * missing evidence reported.
 */

export const RENT_INCOME_LIMIT_ENGINE_VERSION = "rent-income-limit-engine-2026.09.15.2";

export const LIMIT_PROGRAMS = Object.freeze(["LIHTC_SECTION42", "BOND_SECTION142", "OTHER_PROGRAM"]);
export const HUD_LIMIT_BASES = Object.freeze(["AMI_MEDIAN", "MTSP", "VLI_50", "LOW_80", "ELI_30"]);
export const SET_ASIDES = Object.freeze(["20_50", "40_60", "AVERAGE_INCOME", "NOT_ELECTED"]);
export const SIZE_METHODS = Object.freeze(["ONE_POINT_FIVE", "PLUS_ONE", "CUSTOM"]);
export const STANDARD_AMI_LEVELS = Object.freeze([30, 40, 50, 60, 70, 80]);
export const HOUSEHOLD_SIZES = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
export const BEDROOM_SIZES = Object.freeze([0, 1, 2, 3, 4, 5]);
export const HISTORICAL_YEARS_REQUIRED = 12;

/**
 * Explicit controlled dataset family mapping. A source family is NEVER inferred
 * from a dataset name at calculation time; a dataset that is not listed here is
 * treated as incompatible with every program.
 */
export const SOURCE_FAMILIES = Object.freeze(["MTSP", "HOME", "HTF", "SECTION8", "USDA_RD", "STATE_LOCAL_MANUAL"]);
export const CONTROLLED_DATASET_FAMILIES = Object.freeze({
  HUD_MTSP_LIMITS_FY2026: "MTSP",
  HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18: "MTSP",
  HUD_HOME_INCOME_LIMITS_FY2026: "HOME",
  HUD_HOME_RENT_LIMITS_FY2026: "HOME",
  HUD_HTF_INCOME_LIMITS_FY2026: "HTF",
  HUD_HTF_RENT_LIMITS_FY2026: "HTF",
  HUD_SECTION8_INCOME_LIMITS_FY2026: "SECTION8",
  USDA_RD_INCOME_LIMITS_FY2026: "USDA_RD",
});
export const PROGRAM_ALLOWED_FAMILIES = Object.freeze({
  LIHTC_SECTION42: Object.freeze(["MTSP"]),
  BOND_SECTION142: Object.freeze(["MTSP"]),
  OTHER_PROGRAM: Object.freeze(["HOME", "HTF", "SECTION8", "USDA_RD", "STATE_LOCAL_MANUAL"]),
});

/** Section 42 rent limits use the 1.5-persons-per-bedroom convention; it is not a user assumption. */
export function requiredSizeMethod(program) {
  return program === "LIHTC_SECTION42" ? "ONE_POINT_FIVE" : null;
}

export function controlledDatasetFamily(datasetId) {
  const key = String(datasetId ?? "");
  return Object.prototype.hasOwnProperty.call(CONTROLLED_DATASET_FAMILIES, key) ? CONTROLLED_DATASET_FAMILIES[key] : null;
}

/** Families the current program may use. Other Program requires an explicit family election. */
export function allowedSourceFamilies(config = {}) {
  const allowed = PROGRAM_ALLOWED_FAMILIES[config.program] ?? [];
  if (config.program !== "OTHER_PROGRAM") return [...allowed];
  return allowed.includes(config.sourceFamily) ? [config.sourceFamily] : [];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;

function validDate(value) {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function cents(value) {
  if (typeof value !== "string" || !MONEY.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function money(amount) {
  if (amount === null) return null;
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  return `${negative ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

/** Whole-dollar floor, the published HUD/limit-table convention for derived levels. */
function floorDollars(amount) {
  return (amount / 100n) * 100n;
}

function levelList(config) {
  const standard = (config.amiLevels ?? []).map(Number).filter((level) => STANDARD_AMI_LEVELS.includes(level));
  const custom = (config.customLevels ?? [])
    .map(Number)
    .filter((level) => Number.isFinite(level) && level > 0 && level <= 200);
  return [...new Set([...standard, ...custom])].sort((a, b) => a - b);
}

/**
 * Assumed household size for a bedroom count. Returns null when a custom
 * assumption is required but has not been entered.
 */
export function assumedHouseholdSize(bedrooms, method, customSizes = {}) {
  if (!SIZE_METHODS.includes(method)) throw new RangeError(`Unsupported household-size method: ${method}`);
  const rooms = Math.max(0, Number(bedrooms));
  if (method === "CUSTOM") {
    const entered = Number(customSizes?.[String(rooms)] ?? customSizes?.[rooms]);
    return Number.isFinite(entered) && entered > 0 ? entered : null;
  }
  if (method === "PLUS_ONE") return rooms === 0 ? 1 : rooms + 1;
  return rooms === 0 ? 1 : rooms * 1.5;
}

/** Explicit checks for the manual sourced-limit path. Never a silent fallback. */
export function manualSourceIssues(manual = {}) {
  const issues = [];
  if (!String(manual.authority ?? "").trim()) issues.push("Administering authority required.");
  if (!String(manual.sourceReference ?? "").trim()) issues.push("Source document reference or URL required.");
  if (!validDate(manual.effectiveFrom) || !validDate(manual.effectiveTo) || manual.effectiveFrom > manual.effectiveTo) {
    issues.push("Valid limit effective dates required.");
  }
  if (!String(manual.geography ?? "").trim()) issues.push("Limit geography (county / HUD area) required.");
  if (!String(manual.designation ?? "").trim()) issues.push("Designation or limit basis required.");
  const base = Number(manual.basePercent);
  if (!Number.isFinite(base) || base <= 0 || base > 200) issues.push("Base published percentage required.");
  const limits = manual.limits ?? {};
  const sizes = Object.keys(limits).filter((size) => /^[1-9]\d?$/.test(size));
  if (!sizes.length) issues.push("At least one sourced household-size limit required.");
  for (const size of sizes) if (cents(String(limits[size])) === null) issues.push(`Household size ${size}: valid amount required.`);
  if (manual.reviewConfirmed !== true) issues.push("Explicit review confirmation required.");
  if (!String(manual.reviewerName ?? "").trim()) issues.push("Reviewer name required.");
  return issues;
}

/**
 * Resolves the limit source. Controlled HUD datasets must be ACTIVE in the
 * controlled source catalog; anything else fails closed with the exact
 * activation blockers recorded for that dataset.
 */
export function resolveLimitSource(config = {}) {
  const source = config.source ?? {};
  const program = config.program;
  if (!LIMIT_PROGRAMS.includes(program)) {
    return { status: "NOT_DETERMINED", blockers: [`Unsupported program: ${String(program)}`], provenance: null };
  }
  if (source.program && source.program !== program) {
    return {
      status: "NOT_DETERMINED",
      blockers: ["The selected limit source belongs to another program. Cross-program limit reuse is blocked."],
      provenance: null,
    };
  }
  if (source.kind === "CONTROLLED") {
    const families = allowedSourceFamilies(config);
    const family = controlledDatasetFamily(source.datasetId);
    if (!families.length) {
      return {
        status: "NOT_DETERMINED",
        blockers: ["Select the compatible controlled source family for this program before a controlled dataset can be used."],
        provenance: null,
      };
    }
    if (family === null) {
      return {
        status: "NOT_DETERMINED",
        blockers: [`Controlled dataset ${String(source.datasetId)} has no approved source-family mapping. A family is never inferred from the dataset name.`],
        provenance: null,
      };
    }
    if (!families.includes(family)) {
      return {
        status: "NOT_DETERMINED",
        blockers: [`Controlled dataset ${String(source.datasetId)} belongs to the ${family} source family, which is not compatible with the selected program (${families.join(", ")}). Cross-family limit reuse is blocked.`],
        provenance: null,
      };
    }
    const catalog = config.catalog ?? { official_sources: [] };
    const entry = (catalog.official_sources ?? []).find((item) => item.dataset_id === source.datasetId);
    if (!entry) {
      return {
        status: "NOT_DETERMINED",
        blockers: [`Controlled dataset ${String(source.datasetId)} is not present in the verified source catalog.`],
        provenance: null,
      };
    }
    const active = String(entry.activation_status ?? "").toUpperCase() === "ACTIVE";
    const provenance = {
      kind: "CONTROLLED",
      authority: "U.S. Department of Housing and Urban Development",
      datasetId: entry.dataset_id,
      version: catalog.version ?? null,
      sourceReference: entry.official_url ?? entry.official_landing_page ?? null,
      sha256: entry.sha256 ?? null,
      effectiveFrom: entry.effective_from ?? null,
      effectiveTo: null,
      geography: config.areaId ?? null,
      verification: active ? "SOURCE_VERIFIED" : "SOURCE_NOT_ACTIVATED",
      activationStatus: entry.activation_status ?? "UNKNOWN",
    };
    if (!active) {
      return {
        status: "NOT_DETERMINED",
        blockers: [
          `Controlled dataset ${entry.dataset_id} is not activated (${entry.activation_status ?? "UNKNOWN"}). National lookup is unavailable until the source bytes, hash, geography crosswalk and two-person approval are recorded.`,
        ],
        provenance,
      };
    }
    return { status: "RESOLVED", blockers: [], provenance, limits: entry.limits ?? {}, basePercent: entry.base_percent ?? null };
  }
  if (source.kind === "MANUAL") {
    const issues = manualSourceIssues(source);
    if (source.reviewedProgram && source.reviewedProgram !== program) {
      issues.unshift("The sourced limit set was reviewed under another program. Review it again for the selected program.");
    }
    const provenance = {
      kind: "MANUAL",
      authority: source.authority ?? null,
      datasetId: null,
      version: source.datasetVersion ?? null,
      sourceReference: source.sourceReference ?? null,
      sha256: null,
      effectiveFrom: source.effectiveFrom ?? null,
      effectiveTo: source.effectiveTo ?? null,
      geography: source.geography ?? config.areaId ?? null,
      verification: issues.length ? "REVIEW_REQUIRED" : "MANUAL_SOURCE_REVIEWED",
      activationStatus: issues.length ? "INCOMPLETE_MANUAL_SOURCE" : "MANUAL_SOURCE_REVIEWED",
    };
    if (issues.length) return { status: "NOT_DETERMINED", blockers: issues, provenance };
    return { status: "RESOLVED", blockers: [], provenance, limits: source.limits, basePercent: Number(source.basePercent) };
  }
  return {
    status: "NOT_DETERMINED",
    blockers: ["Select a controlled activated dataset or record a reviewed manual sourced limit set."],
    provenance: null,
  };
}

function limitAtSize(limits, basePercent, size, level) {
  const at = (whole) => cents(String(limits?.[String(whole)] ?? ""));
  const scale = (base) => (base === null ? null : floorDollars((base * BigInt(Math.round(level * 1000))) / BigInt(Math.round(basePercent * 1000))));
  if (Number.isInteger(size)) return scale(at(size));
  const low = at(Math.floor(size));
  const high = at(Math.ceil(size));
  if (low === null || high === null) return null;
  return scale((low + high) / 2n);
}

/**
 * Maximum-rent outputs require an explicitly reviewed rent methodology / applicable
 * rule source. Income limits from a reviewed income-limit source stay independent.
 */
export function rentMethodIssues(config = {}) {
  const method = config.rentMethod ?? {};
  const issues = [];
  if (!String(method.methodReference ?? "").trim()) issues.push("Applicable maximum-rent rule / methodology reference required before rent outputs are produced.");
  if (!String(method.sourceReference ?? "").trim()) issues.push("Rent methodology source document reference required.");
  if (!String(method.reviewerName ?? "").trim()) issues.push("Rent methodology reviewer name required.");
  if (method.reviewConfirmed !== true) issues.push("Explicit rent methodology review confirmation required.");
  return issues;
}

/** Project gross rent floors are property-specific evidence, never regulatory authority on their own. */
export function rentFloorIssues(config = {}) {
  const entered = Object.entries(config.grossRentFloor ?? {}).filter(([, value]) => String(value ?? "").trim() !== "");
  if (!entered.length) return [];
  const evidence = config.rentFloorEvidence ?? {};
  const issues = [];
  for (const [room, value] of entered) if (cents(String(value)) === null) issues.push(`Bedroom size ${room}: valid project gross rent floor amount required.`);
  if (!validDate(evidence.effectiveDate)) issues.push("Project rent floor effective / election date required.");
  if (!String(evidence.sourceReference ?? "").trim()) issues.push("Project rent floor source or election reference required.");
  if (!String(evidence.reviewerName ?? "").trim()) issues.push("Project rent floor reviewer name required.");
  if (evidence.reviewConfirmed !== true) issues.push("Explicit review of the project rent floor treatment required before any floor is applied.");
  return issues;
}

/** 140% Next Available Unit reference basis. Ambiguous elections are not guessed. */
export function oneFortyBasis(config = {}) {
  const setAside = config.setAside;
  if (config.program === "LIHTC_SECTION42" || config.program === "BOND_SECTION142") {
    if (setAside === "20_50") return { level: 50, notDetermined: false, reason: null };
    if (setAside === "40_60") return { level: 60, notDetermined: false, reason: null };
    return {
      level: null,
      notDetermined: true,
      reason:
        setAside === "AVERAGE_INCOME"
          ? "Average Income election: the applicable 140% basis is unit-designation specific. Review required."
          : "Minimum set-aside election is not recorded, so the 140% basis cannot be determined.",
    };
  }
  return { level: null, notDetermined: true, reason: "140% Next Available Unit analysis requires a Section 42 or Section 142 set-aside election." };
}

export function historicalAvailability(config = {}) {
  const incomeLevels = [...new Set((config.historicalIncomeLevels ?? []).map(Number).filter((level) => Number.isFinite(level) && level > 0))].sort((a, b) => a - b);
  const rentLevels = [...new Set((config.historicalRentLevels ?? []).map(Number).filter((level) => Number.isFinite(level) && level > 0))].sort((a, b) => a - b);
  const records = Array.isArray(config.historicalRecords) ? config.historicalRecords : [];
  const verified = records.filter((record) => record && record.verified === true && Number.isFinite(Number(record.year)));
  const years = new Set(verified.map((record) => Number(record.year)));
  if (years.size < HISTORICAL_YEARS_REQUIRED) {
    return {
      available: false,
      years: years.size,
      incomeLevels,
      rentLevels,
      reason: `Historical charts and ${HISTORICAL_YEARS_REQUIRED}-year average change require ${HISTORICAL_YEARS_REQUIRED} years of verified source records; ${years.size} available.`,
    };
  }
  return { available: true, years: years.size, incomeLevels, rentLevels, reason: null };
}

export function fmrAvailability(config = {}) {
  const records = Array.isArray(config.fmrRecords) ? config.fmrRecords : [];
  const verified = records.filter((record) => record && record.verified === true);
  if (!verified.length) {
    return { available: false, reason: "No activated HUD Fair Market Rent source record is available for this area.", records: [] };
  }
  return { available: true, reason: null, records: verified };
}

/**
 * Full calculation. Every table is either fully sourced or Not Determined.
 */
export function calculateRentIncomeLimits(config = {}) {
  const resolved = resolveLimitSource(config);
  const levels = levelList(config);
  const sizes = (config.householdSizes ?? []).map(Number).filter((size) => HOUSEHOLD_SIZES.includes(size)).sort((a, b) => a - b);
  const bedrooms = (config.bedroomSizes ?? [])
    .map(Number)
    .filter((room) => Number.isInteger(room) && room >= 0 && room <= 12)
    .sort((a, b) => a - b);
  const blockers = [...resolved.blockers];
  if (!levels.length) blockers.push("Select at least one AMI percentage or enter a custom percentage.");
  if (!sizes.length) blockers.push("Select at least one household size.");
  if (!bedrooms.length) blockers.push("Select at least one bedroom size.");
  if (config.program === "BOND_SECTION142" || config.program === "OTHER_PROGRAM") {
    if (!HUD_LIMIT_BASES.includes(config.hudBasis)) blockers.push("Select the assumed HUD published limit basis.");
    if (config.hudBasis === "ELI_30" && config.program !== "OTHER_PROGRAM") {
      blockers.push("Extremely Low Income basis is only selectable for Other Program mode.");
    }
  }
  if (config.ruralRule === true && resolved.provenance?.kind !== "MANUAL" && resolved.status !== "RESOLVED") {
    blockers.push("The rural / nonmetropolitan rule cannot be applied until the source or rule profile supporting it is resolved.");
  }
  const requiredMethod = requiredSizeMethod(config.program);
  if (!SIZE_METHODS.includes(config.sizeMethod)) blockers.push("Select an assumed household-size method.");
  else if (requiredMethod && config.sizeMethod !== requiredMethod) {
    blockers.push(
      "Section 42 LIHTC rent limits use the 1.5-persons-per-bedroom convention. Another household-size assumption cannot be used for a LIHTC calculation.",
    );
  }
  const rentMethod = rentMethodIssues(config);
  const floorIssues = rentFloorIssues(config);
  const floorEntered = Object.values(config.grossRentFloor ?? {}).some((value) => String(value ?? "").trim() !== "");
  const floorApplicable = floorEntered && floorIssues.length === 0 && rentMethod.length === 0;
  const rentAuthority = {
    determined: rentMethod.length === 0,
    issues: rentMethod,
    reason: rentMethod.length ? "Maximum-rent outputs are Not Determined until the applicable rent rule / methodology source is reviewed." : null,
    methodReference: config.rentMethod?.methodReference ?? null,
    sourceReference: config.rentMethod?.sourceReference ?? null,
    reviewerName: config.rentMethod?.reviewerName ?? null,
  };
  const floorTreatment = {
    entered: floorEntered,
    applied: floorApplicable,
    status: !floorEntered ? "NOT_ENTERED" : floorApplicable ? "REVIEWED_APPLICABLE" : "REVIEW_REQUIRED",
    issues: floorIssues,
    effectiveDate: config.rentFloorEvidence?.effectiveDate ?? null,
    sourceReference: config.rentFloorEvidence?.sourceReference ?? null,
    reviewerName: config.rentFloorEvidence?.reviewerName ?? null,
  };

  const basis = oneFortyBasis(config);
  const historical = historicalAvailability(config);
  const fmr = fmrAvailability(config);
  const provenance = resolved.provenance ?? {
    kind: null,
    authority: null,
    datasetId: null,
    version: null,
    sourceReference: null,
    sha256: null,
    effectiveFrom: null,
    effectiveTo: null,
    geography: config.areaId ?? null,
    verification: "NOT_DETERMINED",
    activationStatus: "NOT_SELECTED",
  };
  const area = {
    program: config.program ?? null,
    limitYear: config.limitYear ?? null,
    stateCode: config.stateCode ?? null,
    areaId: config.areaId ?? null,
    msa: config.msa ?? null,
    placedInServiceDate: config.placedInServiceDate ?? null,
    setAside: config.setAside ?? null,
    hudBasis: config.hudBasis ?? null,
    sourceFamily: config.sourceFamily ?? null,
    ruralRule: config.ruralRule === true,
    effectiveFrom: provenance.effectiveFrom,
  };

  if (resolved.status !== "RESOLVED" || blockers.length) {
    return {
      engineVersion: RENT_INCOME_LIMIT_ENGINE_VERSION,
      status: "NOT_DETERMINED",
      blockers,
      area,
      provenance,
      referenceLimits: [],
      incomeLimits: [],
      rentLimits: [],
      oneForty: { basisLevel: basis.level, notDetermined: true, reason: basis.notDetermined ? basis.reason : "Limit source is not resolved.", byHouseholdSize: [] },
      fmr,
      historical,
      rentAuthority,
      floorTreatment,
    };
  }

  const { limits, basePercent } = resolved;
  const rowBlockers = [];
  const incomeLimits = levels.map((level) => ({
    level,
    byHouseholdSize: sizes.map((size) => {
      const amount = limitAtSize(limits, basePercent, size, level);
      if (amount === null) rowBlockers.push(`Household size ${size}: the source does not contain a limit for this size.`);
      return { size, amount: money(amount) };
    }),
  }));

  if (rentMethod.length) rowBlockers.push(...rentMethod);
  if (floorIssues.length) rowBlockers.push(...floorIssues);
  if (config.showHistorical === true && !historical.incomeLevels.length && !historical.rentLevels.length) {
    rowBlockers.push("Select at least one historical income level or rent level to chart.");
  }

  const rentLimits = levels.map((level) => ({
    level,
    byBedroom: bedrooms.map((room) => {
      const floorRaw = config.grossRentFloor?.[String(room)];
      const projectFloor = floorRaw === undefined || String(floorRaw).trim() === "" ? null : money(cents(String(floorRaw)));
      const base = {
        bedrooms: room,
        householdSize: null,
        grossRent: null,
        utilityAllowance: null,
        tenantPaid: null,
        projectFloor,
        floorApplied: false,
        floorTreatment: floorTreatment.status,
        applicableRent: null,
        issue: null,
      };
      if (rentMethod.length) return { ...base, floorTreatment: "NOT_DETERMINED", issue: "RENT_METHOD_NOT_REVIEWED" };
      const size = assumedHouseholdSize(room, config.sizeMethod, config.customSizes ?? {});
      if (size === null) {
        rowBlockers.push(`Bedroom size ${room}: enter the custom assumed household size.`);
        return { ...base, issue: "CUSTOM_HOUSEHOLD_SIZE_REQUIRED" };
      }
      const limit = limitAtSize(limits, basePercent, size, level);
      if (limit === null) {
        rowBlockers.push(`Bedroom size ${room}: the source does not contain limits for assumed household size ${size}.`);
        return { ...base, householdSize: size, issue: "SOURCE_SIZE_MISSING" };
      }
      const gross = floorDollars((limit * 30n) / 100n / 12n);
      const floorValue = projectFloor === null ? null : cents(String(projectFloor));
      // The statutory calculated gross rent is never replaced by a project floor
      // unless the floor treatment itself is reviewed and rule-supported.
      const floorApplied = floorApplicable && floorValue !== null && floorValue > gross;
      const applicable = floorApplied ? floorValue : gross;
      const allowanceRaw = config.utilityAllowances?.[String(room)];
      const allowance = allowanceRaw === undefined || String(allowanceRaw).trim() === "" ? 0n : cents(String(allowanceRaw));
      if (allowance === null) {
        rowBlockers.push(`Bedroom size ${room}: valid utility allowance amount required.`);
        return { ...base, householdSize: size, grossRent: money(gross), issue: "INVALID_UTILITY_ALLOWANCE" };
      }
      const net = applicable - allowance;
      if (net < 0n) {
        rowBlockers.push(
          `Bedroom size ${room}: the utility allowance exceeds the calculated gross rent. Maximum tenant-paid rent is blocked until the applicable treatment is defined in the program profile.`,
        );
        return { ...base, householdSize: size, grossRent: money(gross), utilityAllowance: money(allowance), floorApplied, issue: "UTILITY_ALLOWANCE_EXCEEDS_GROSS_RENT" };
      }
      return {
        ...base,
        householdSize: size,
        grossRent: money(gross),
        utilityAllowance: money(allowance),
        tenantPaid: money(net),
        floorApplied,
        applicableRent: floorEntered && !floorApplicable ? null : money(applicable),
        issue: null,
      };
    }),
  }));

  const referenceLimits = [30, 50, 80].map((level) => ({
    level,
    label: level === 30 ? "Extremely low income (30%)" : level === 50 ? "Very low income (50%)" : "Low income (80%)",
    byHouseholdSize: sizes.map((size) => ({ size, amount: money(limitAtSize(limits, basePercent, size, level)) })),
  }));

  const oneForty =
    config.showOneForty !== true
      ? { basisLevel: basis.level, notDetermined: basis.notDetermined, reason: basis.reason, byHouseholdSize: [] }
      : basis.notDetermined
        ? { basisLevel: null, notDetermined: true, reason: basis.reason, byHouseholdSize: [] }
        : {
            basisLevel: basis.level,
            notDetermined: false,
            reason: null,
            byHouseholdSize: sizes.map((size) => ({ size, amount: money(limitAtSize(limits, basePercent, size, basis.level * 1.4)) })),
          };

  return {
    engineVersion: RENT_INCOME_LIMIT_ENGINE_VERSION,
    status: rowBlockers.length ? "PARTIAL" : "DETERMINED",
    blockers: [...new Set(rowBlockers)],
    area,
    provenance,
    referenceLimits,
    incomeLimits,
    rentLimits,
    oneForty,
    fmr,
    historical,
    rentAuthority,
    floorTreatment,
  };
}

/**
 * Builds an UNSIGNED Household Income limit-profile draft. It carries source,
 * geography, designation and household-size limits only; it never approves a
 * rule, never activates a source and cannot mutate a signed snapshot.
 */
export function buildUnsignedLimitProfileDraft(config = {}, result = calculateRentIncomeLimits(config), level = null) {
  if (result.status === "NOT_DETERMINED") {
    return { ok: false, issues: ["Limits are Not Determined. Resolve the source before creating a Household Income profile draft."], draft: null };
  }
  const selectedLevel = level ?? result.incomeLimits[0]?.level ?? null;
  const row = result.incomeLimits.find((entry) => entry.level === selectedLevel);
  if (!row) return { ok: false, issues: ["Select a calculated AMI percentage to carry into Household Income."], draft: null };
  const limits = {};
  for (const entry of row.byHouseholdSize) if (entry.amount !== null) limits[String(entry.size)] = entry.amount;
  if (!Object.keys(limits).length) return { ok: false, issues: ["No sourced household-size limits are available to carry over."], draft: null };
  return {
    ok: true,
    issues: [],
    draft: Object.freeze({
      signed: false,
      approved: false,
      program: config.program === "BOND_SECTION142" ? "BOND" : config.program === "LIHTC_SECTION42" ? "LIHTC" : "STATE_LOCAL",
      agency: result.provenance.authority ?? "",
      designation: `${selectedLevel}% ${config.setAside ? `· set-aside ${config.setAside}` : ""}`.trim(),
      geography: result.provenance.geography ?? config.areaId ?? "",
      limitSource: [result.provenance.datasetId, result.provenance.sourceReference, result.provenance.sha256]
        .filter(Boolean)
        .join(" · "),
      limitFrom: result.provenance.effectiveFrom ?? "",
      limitTo: result.provenance.effectiveTo ?? "",
      limits,
      engineVersion: result.engineVersion,
    }),
  };
}