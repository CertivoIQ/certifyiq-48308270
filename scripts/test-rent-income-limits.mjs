import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assumedHouseholdSize,
  buildUnsignedLimitProfileDraft,
  calculateRentIncomeLimits,
  fmrAvailability,
  historicalAvailability,
  manualSourceIssues,
  oneFortyBasis,
  rentFloorIssues,
  rentMethodIssues,
  requiredSizeMethod,
  resolveLimitSource,
  allowedSourceFamilies,
  controlledDatasetFamily,
} from '../src/lib/rent-income-limit-engine.mjs';

const catalog = JSON.parse(readFileSync('src/lib/fy2026-income-limit-sources.json', 'utf8'));

const manual = {
  kind: 'MANUAL',
  program: 'LIHTC_SECTION42',
  authority: 'State housing finance agency',
  sourceReference: 'https://example-agency.gov/limits/2026.pdf',
  effectiveFrom: '2026-05-01',
  effectiveTo: '2027-04-30',
  geography: 'Example County, ST',
  designation: 'MTSP 50% VLI',
  basePercent: 50,
  limits: { 1: '35000.00', 2: '40000.00', 3: '45000.00', 4: '50000.00' },
  reviewConfirmed: true,
  reviewerName: 'Compliance reviewer',
};

const reviewedRentMethod = {
  methodReference: 'IRC 42(g)(2) gross rent limitation, agency compliance manual ch. 4',
  sourceReference: 'https://example-agency.gov/manual/2026-ch4.pdf',
  reviewerName: 'Compliance reviewer',
  reviewConfirmed: true,
};

const reviewedFloorEvidence = {
  effectiveDate: '2026-05-01',
  sourceReference: 'Recorded LURA rent floor election, exhibit B',
  reviewerName: 'Compliance reviewer',
  reviewConfirmed: true,
};

const base = (patch = {}) => ({
  program: 'LIHTC_SECTION42',
  limitYear: '2026',
  stateCode: 'ST',
  areaId: 'Example County, ST',
  setAside: '40_60',
  amiLevels: [50, 60],
  customLevels: [],
  householdSizes: [1, 2, 3, 4],
  bedroomSizes: [0, 1, 2],
  sizeMethod: 'ONE_POINT_FIVE',
  rentMethod: reviewedRentMethod,
  utilityAllowances: {},
  grossRentFloor: {},
  source: manual,
  catalog,
  ...patch,
});

test('controlled HUD datasets are blocked and return Not Determined', () => {
  const result = calculateRentIncomeLimits(base({ source: { kind: 'CONTROLLED', datasetId: 'HUD_MTSP_LIMITS_FY2026' } }));
  assert.equal(result.status, 'NOT_DETERMINED');
  assert.match(result.blockers.join(' '), /not activated/);
  assert.equal(result.provenance.verification, 'SOURCE_NOT_ACTIVATED');
  assert.deepEqual(result.incomeLimits, []);
});

test('unknown controlled dataset never falls back to another source', () => {
  const resolved = resolveLimitSource(base({ source: { kind: 'CONTROLLED', datasetId: 'NOT_A_DATASET' } }));
  assert.equal(resolved.status, 'NOT_DETERMINED');
  assert.equal(resolved.provenance, null);
});

test('manual source path requires authority, source, dates and explicit review', () => {
  assert.deepEqual(manualSourceIssues(manual), []);
  const issues = manualSourceIssues({ ...manual, authority: '', sourceReference: '', effectiveFrom: '', reviewConfirmed: false });
  assert.ok(issues.some((i) => /authority/i.test(i)));
  assert.ok(issues.some((i) => /Source document/i.test(i)));
  assert.ok(issues.some((i) => /effective dates/i.test(i)));
  assert.ok(issues.some((i) => /review confirmation/i.test(i)));
  assert.equal(calculateRentIncomeLimits(base({ source: { ...manual, reviewConfirmed: false } })).status, 'NOT_DETERMINED');
});

test('cross-program limit reuse is blocked', () => {
  const result = calculateRentIncomeLimits(base({ program: 'BOND_SECTION142', hudBasis: 'MTSP' }));
  assert.equal(result.status, 'NOT_DETERMINED');
  assert.match(result.blockers.join(' '), /another program/);
});

test('derived income limits scale from the sourced base percentage', () => {
  const result = calculateRentIncomeLimits(base());
  assert.equal(result.status, 'DETERMINED');
  const sixty = result.incomeLimits.find((r) => r.level === 60);
  assert.equal(sixty.byHouseholdSize.find((r) => r.size === 4).amount, '60000.00');
  const fifty = result.incomeLimits.find((r) => r.level === 50);
  assert.equal(fifty.byHouseholdSize.find((r) => r.size === 1).amount, '35000.00');
});

test('custom AMI percentages are calculated and displayed', () => {
  const result = calculateRentIncomeLimits(base({ amiLevels: [], customLevels: [70.5] }));
  assert.deepEqual(result.incomeLimits.map((r) => r.level), [70.5]);
  assert.equal(result.incomeLimits[0].byHouseholdSize.find((r) => r.size === 4).amount, '70500.00');
});

test('household-size and bedroom-size selections filter output', () => {
  const result = calculateRentIncomeLimits(base({ householdSizes: [2, 4], bedroomSizes: [1] }));
  assert.deepEqual(result.incomeLimits[0].byHouseholdSize.map((r) => r.size), [2, 4]);
  assert.deepEqual(result.rentLimits[0].byBedroom.map((r) => r.bedrooms), [1]);
});

test('household-size assumptions follow the selected method', () => {
  assert.equal(assumedHouseholdSize(2, 'ONE_POINT_FIVE'), 3);
  assert.equal(assumedHouseholdSize(1, 'ONE_POINT_FIVE'), 1.5);
  assert.equal(assumedHouseholdSize(0, 'ONE_POINT_FIVE'), 1);
  assert.equal(assumedHouseholdSize(2, 'PLUS_ONE'), 3);
  assert.equal(assumedHouseholdSize(0, 'PLUS_ONE'), 1);
  assert.equal(assumedHouseholdSize(3, 'CUSTOM', { 3: '5' }), 5);
  assert.equal(assumedHouseholdSize(3, 'CUSTOM', {}), null);
});

test('custom household size must be entered for each displayed bedroom size', () => {
  const result = calculateRentIncomeLimits(
    base({ program: 'OTHER_PROGRAM', hudBasis: 'AMI_MEDIAN', sourceFamily: 'STATE_LOCAL_MANUAL', source: { ...manual, program: 'OTHER_PROGRAM' }, sizeMethod: 'CUSTOM', customSizes: { 0: '1' } }),
  );
  assert.equal(result.status, 'PARTIAL');
  assert.match(result.blockers.join(' '), /custom assumed household size/);
  assert.equal(result.rentLimits[0].byBedroom.find((r) => r.bedrooms === 1).grossRent, null);
});

test('1.5 persons per bedroom interpolates between sourced household sizes', () => {
  const result = calculateRentIncomeLimits(base({ sizeMethod: 'ONE_POINT_FIVE', bedroomSizes: [1], amiLevels: [50] }));
  const row = result.rentLimits[0].byBedroom[0];
  assert.equal(row.householdSize, 1.5);
  assert.equal(row.grossRent, '937.00');
});

test('utility allowance is subtracted and never produces a negative tenant-paid maximum', () => {
  const ok = calculateRentIncomeLimits(base({ amiLevels: [60], bedroomSizes: [2], utilityAllowances: { 2: '100.00' } }));
  const row = ok.rentLimits[0].byBedroom[0];
  assert.equal(row.grossRent, '1350.00');
  assert.equal(row.tenantPaid, '1250.00');
  const blocked = calculateRentIncomeLimits(base({ amiLevels: [60], bedroomSizes: [2], utilityAllowances: { 2: '9000.00' } }));
  const blockedRow = blocked.rentLimits[0].byBedroom[0];
  assert.equal(blockedRow.tenantPaid, null);
  assert.equal(blockedRow.issue, 'UTILITY_ALLOWANCE_EXCEEDS_GROSS_RENT');
  assert.equal(blocked.status, 'PARTIAL');
});

test('a project gross rent floor never silently replaces the calculated statutory rent', () => {
  const unreviewed = calculateRentIncomeLimits(base({ amiLevels: [60], bedroomSizes: [2], grossRentFloor: { 2: '1400.00' } }));
  const row = unreviewed.rentLimits[0].byBedroom[0];
  assert.equal(row.grossRent, '1350.00');
  assert.equal(row.floorApplied, false);
  assert.equal(row.projectFloor, '1400.00');
  assert.equal(row.applicableRent, null);
  assert.equal(unreviewed.floorTreatment.status, 'REVIEW_REQUIRED');
  assert.match(unreviewed.blockers.join(' '), /rent floor/i);
  assert.ok(rentFloorIssues({ grossRentFloor: { 2: '1400.00' } }).length > 0);
  assert.deepEqual(rentFloorIssues({ grossRentFloor: {} }), []);

  const reviewed = calculateRentIncomeLimits(base({ amiLevels: [60], bedroomSizes: [2], grossRentFloor: { 2: '1400.00' }, rentFloorEvidence: reviewedFloorEvidence }));
  const reviewedRow = reviewed.rentLimits[0].byBedroom[0];
  assert.equal(reviewed.floorTreatment.status, 'REVIEWED_APPLICABLE');
  assert.equal(reviewedRow.grossRent, '1350.00');
  assert.equal(reviewedRow.floorApplied, true);
  assert.equal(reviewedRow.applicableRent, '1400.00');

  const staleReview = calculateRentIncomeLimits(base({ amiLevels: [60], bedroomSizes: [2], grossRentFloor: { 2: '1400.00' }, rentFloorEvidence: { ...reviewedFloorEvidence, reviewConfirmed: false } }));
  assert.equal(staleReview.rentLimits[0].byBedroom[0].floorApplied, false);
});

test('Section 42 LIHTC locks the rent household-size convention to 1.5 per bedroom', () => {
  assert.equal(requiredSizeMethod('LIHTC_SECTION42'), 'ONE_POINT_FIVE');
  assert.equal(requiredSizeMethod('BOND_SECTION142'), null);
  assert.equal(requiredSizeMethod('OTHER_PROGRAM'), null);
  for (const method of ['PLUS_ONE', 'CUSTOM']) {
    const blocked = calculateRentIncomeLimits(base({ sizeMethod: method, customSizes: { 0: '1', 1: '2', 2: '3' } }));
    assert.equal(blocked.status, 'NOT_DETERMINED');
    assert.match(blocked.blockers.join(' '), /1\.5-persons-per-bedroom/);
  }
  const allowed = calculateRentIncomeLimits(base({ program: 'BOND_SECTION142', hudBasis: 'MTSP', sizeMethod: 'PLUS_ONE', source: { ...manual, program: 'BOND_SECTION142' } }));
  assert.equal(allowed.status, 'DETERMINED');
});

test('controlled datasets are bound to explicitly mapped compatible source families', () => {
  assert.equal(controlledDatasetFamily('HUD_MTSP_LIMITS_FY2026'), 'MTSP');
  assert.equal(controlledDatasetFamily('HUD_HOME_INCOME_LIMITS_FY2026'), 'HOME');
  assert.equal(controlledDatasetFamily('SOMETHING_MTSP_LOOKALIKE'), null);
  assert.deepEqual(allowedSourceFamilies({ program: 'LIHTC_SECTION42' }), ['MTSP']);
  assert.deepEqual(allowedSourceFamilies({ program: 'OTHER_PROGRAM' }), []);
  assert.deepEqual(allowedSourceFamilies({ program: 'OTHER_PROGRAM', sourceFamily: 'HOME' }), ['HOME']);
  const mismatch = resolveLimitSource(base({ source: { kind: 'CONTROLLED', datasetId: 'HUD_HOME_INCOME_LIMITS_FY2026' } }));
  assert.equal(mismatch.status, 'NOT_DETERMINED');
  assert.match(mismatch.blockers.join(' '), /HOME source family, which is not compatible/);
  const noFamily = resolveLimitSource(base({ program: 'OTHER_PROGRAM', source: { kind: 'CONTROLLED', datasetId: 'HUD_HOME_INCOME_LIMITS_FY2026' } }));
  assert.match(noFamily.blockers.join(' '), /compatible controlled source family/);
  const unmapped = resolveLimitSource(base({ source: { kind: 'CONTROLLED', datasetId: 'HUD_MTSP_LOOKALIKE_FY2026' } }));
  assert.match(unmapped.blockers.join(' '), /no approved source-family mapping/);
});

test('a manual source reviewed under another program must be reviewed again', () => {
  const stale = calculateRentIncomeLimits(base({ program: 'BOND_SECTION142', hudBasis: 'MTSP', sizeMethod: 'PLUS_ONE', source: { ...manual, program: undefined, reviewedProgram: 'LIHTC_SECTION42' } }));
  assert.equal(stale.status, 'NOT_DETERMINED');
  assert.match(stale.blockers.join(' '), /reviewed under another program/);
});

test('maximum rents stay Not Determined until the rent methodology is reviewed', () => {
  assert.deepEqual(rentMethodIssues({ rentMethod: reviewedRentMethod }), []);
  assert.ok(rentMethodIssues({}).length >= 4);
  const result = calculateRentIncomeLimits(base({ rentMethod: { ...reviewedRentMethod, reviewConfirmed: false } }));
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.rentAuthority.determined, false);
  assert.equal(result.incomeLimits.find((r) => r.level === 60).byHouseholdSize.find((r) => r.size === 4).amount, '60000.00');
  for (const row of result.rentLimits[0].byBedroom) {
    assert.equal(row.grossRent, null);
    assert.equal(row.tenantPaid, null);
    assert.equal(row.issue, 'RENT_METHOD_NOT_REVIEWED');
  }
});

test('historical income and rent level selections are explicit and never synthesised', () => {
  const requested = calculateRentIncomeLimits(base({ showHistorical: true, historicalIncomeLevels: [50, 60], historicalRentLevels: [60] }));
  assert.deepEqual(requested.historical.incomeLevels, [50, 60]);
  assert.deepEqual(requested.historical.rentLevels, [60]);
  assert.equal(requested.historical.available, false);
  const missing = calculateRentIncomeLimits(base({ showHistorical: true, historicalIncomeLevels: [], historicalRentLevels: [] }));
  assert.match(missing.blockers.join(' '), /historical income level or rent level/);
  const ui = readFileSync('src/components/rent-income-limits.tsx', 'utf8');
  assert.match(ui, /Historical income levels requested/);
  assert.match(ui, /Historical rent levels requested/);
});

test('the limits screen invalidates stale review state and results', () => {
  const ui = readFileSync('src/components/rent-income-limits.tsx', 'utf8');
  const textarea = ui.slice(ui.indexOf('Sourced household-size limits'), ui.indexOf('I reviewed this sourced limit set'));
  assert.match(textarea, /setManualLimitsText\(e\.target\.value\);\s*setManual\(\(current\) => \(\{ \.\.\.current, reviewConfirmed: false \}\)\)/);
  assert.match(ui, /useEffect\(\(\) => \{\s*setCalculated\(null\);\s*setCarryLevel\(""\);\s*\}, \[sourceMode, datasetId, sourceFamily\]\)/);
  assert.match(ui, /setManual\(\(current\) => \(\{ \.\.\.current, reviewConfirmed: false \}\)\);/);
  assert.match(ui, /setFloorEvidence\(\(current\) => \(\{ \.\.\.current, reviewConfirmed: false \}\)\)/);
  assert.match(ui, /Compatible source family/);
});

test('140% basis follows the LIHTC minimum set-aside election', () => {
  assert.equal(oneFortyBasis({ program: 'LIHTC_SECTION42', setAside: '20_50' }).level, 50);
  assert.equal(oneFortyBasis({ program: 'LIHTC_SECTION42', setAside: '40_60' }).level, 60);
  const average = oneFortyBasis({ program: 'LIHTC_SECTION42', setAside: 'AVERAGE_INCOME' });
  assert.equal(average.level, null);
  assert.equal(average.notDetermined, true);
  const result = calculateRentIncomeLimits(base({ setAside: '20_50', showOneForty: true, householdSizes: [4] }));
  assert.equal(result.oneForty.basisLevel, 50);
  assert.equal(result.oneForty.byHouseholdSize[0].amount, '70000.00');
  const ambiguous = calculateRentIncomeLimits(base({ setAside: 'AVERAGE_INCOME', showOneForty: true }));
  assert.equal(ambiguous.oneForty.notDetermined, true);
  assert.deepEqual(ambiguous.oneForty.byHouseholdSize, []);
});

test('historical charts and FMRs stay unavailable without verified source records', () => {
  assert.equal(historicalAvailability({}).available, false);
  assert.equal(historicalAvailability({ historicalRecords: Array.from({ length: 11 }, (_, i) => ({ year: 2015 + i, verified: true })) }).available, false);
  assert.equal(historicalAvailability({ historicalRecords: Array.from({ length: 12 }, (_, i) => ({ year: 2015 + i, verified: true })) }).available, true);
  assert.equal(fmrAvailability({}).available, false);
  assert.equal(fmrAvailability({ fmrRecords: [{ bedrooms: 1, amount: '900.00', verified: false }] }).available, false);
  assert.equal(calculateRentIncomeLimits(base()).historical.available, false);
});

test('an unsigned Household Income profile draft is produced and never marked signed or approved', () => {
  const config = base();
  const result = calculateRentIncomeLimits(config);
  const built = buildUnsignedLimitProfileDraft(config, result, 60);
  assert.equal(built.ok, true);
  assert.equal(built.draft.signed, false);
  assert.equal(built.draft.approved, false);
  assert.equal(built.draft.program, 'LIHTC');
  assert.equal(built.draft.limits['4'], '60000.00');
  assert.ok(built.draft.limitSource.includes('example-agency.gov'));
  assert.throws(() => { 'use strict'; built.draft.signed = true; });
});

test('a Not Determined result cannot create a Household Income profile draft', () => {
  const config = base({ source: { kind: 'CONTROLLED', datasetId: 'HUD_MTSP_LIMITS_FY2026' } });
  const built = buildUnsignedLimitProfileDraft(config, calculateRentIncomeLimits(config));
  assert.equal(built.ok, false);
  assert.equal(built.draft, null);
});

test('the workspace mode switch keeps Household Income mounted so its state is preserved', () => {
  const source = readFileSync('src/components/income-calculator-workspace.tsx', 'utf8');
  assert.match(source, /aria-pressed/);
  assert.match(source, /hidden/);
  assert.match(source, /<IncomeCalculator/);
  assert.ok(!/mode === "income" \? <IncomeCalculator/.test(source), 'Household Income must not be unmounted on mode switch');
});