import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedCertificationType, isTicContent, strictMappedValue, nativePdfLayout, amountCents, sumAmounts, projectGrossPay } from '../src/lib/tic-cell-repair.mjs';

test('exact native certification selections survive field normalization', () => {
  for (const value of ['Initial Certification', 'Recertification', 'Other']) assert.equal(strictMappedValue('text', value, 'certification_type'), value);
});
test('exact cell text preserves labels occurring inside a real name', () => {
  assert.equal(strictMappedValue('text', 'County Meadows', 'property_name'), 'County Meadows');
});
test('unchecked labels do not select a certification type', () => assert.equal(selectedCertificationType('☐ Initial Certification ☐ Recertification ☐ Other'), null));
test('middle checked option belongs only to recertification', () => assert.equal(selectedCertificationType('☐ Initial Certification ☒ Recertification ☐ Other'), 'Recertification'));
test('conflicting selections stay unresolved', () => assert.equal(selectedCertificationType('☒ Initial Certification ☒ Recertification ☐ Other'), null));
test('other income is not another certification type', () => assert.equal(selectedCertificationType('Other income 4000'), null));
test('explicit type label and a single suffix mark are supported', () => {
  assert.equal(selectedCertificationType('Certification Type: Other'), 'Other');
  assert.equal(selectedCertificationType('Recertification [x]'), 'Recertification');
});
test('direct mapped marker is not reinterpreted as ordinary text', () => assert.equal(selectedCertificationType('__CERTIVOIQ_TIC_FIELD__ certification_type: Other'), null));
test('TIC recognition is content based, including continuation pages', () => {
  assert.equal(isTicContent('TENANT INCOME CERTIFICATION'), true);
  assert.equal(isTicContent('PART IV INCOME FROM ASSETS Type of Asset Cash Value'), true);
  assert.equal(isTicContent('Instructions for completing Tenant Income Certification'), false);
  assert.equal(isTicContent('Bank statement available cash value'), false);
});
test('mapped money cannot silently pick the first number from OCR garbage', () => {
  assert.equal(strictMappedValue('currency', '42,000.25', 'household_annual_income'), 42000.25);
  assert.equal(strictMappedValue('currency', '2026 income $42000', 'household_annual_income'), null);
  assert.equal(strictMappedValue('currency', '4l,000', 'household_annual_income'), null);
  assert.equal(strictMappedValue('number', '60%', 'unit_rent_restriction_percent'), 60);
});
test('invalid dates require correction rather than calendar rollover', () => {
  assert.equal(strictMappedValue('date', '02/30/2026'), null);
  assert.equal(strictMappedValue('date', '02/29/2024'), '02/29/2024');
  assert.equal(strictMappedValue('date', '2026-09-05'), '2026-09-05');
});
test('native PDF layout keeps separate form rows and coordinates', () => {
  const item = (str, x, y) => ({ str, width: str.length * 5, height: 10, transform: [1, 0, 0, 10, x, y] });
  const result = nativePdfLayout([item('Last Name', 20, 700), item('First Name', 150, 700), item('DOE', 20, 680), item('JANE A', 150, 680)], { scale: 1, convertToViewportPoint: (x, y) => [x, 800 - y] });
  assert.equal(result.text, 'Last Name First Name\nDOE JANE A');
  assert.equal(result.blocks[0].paragraphs[0].lines.length, 2);
});
test('zero is distinct from missing money', () => {
  assert.equal(amountCents('0'), 0n);
  assert.throws(() => amountCents(''));
  assert.throws(() => amountCents('O.OO'));
  assert.throws(() => amountCents('10.005'));
});
test('money sums use cents rather than floating point', () => assert.equal(sumAmounts(['0.10', '0.20']), '0.30'));
test('gross projection distinguishes biweekly from twice monthly', () => {
  assert.equal(projectGrossPay({ amounts: ['1500', '1600'], frequency: 'biweekly', policyRef: 'Reviewed policy' }).annual, '40300.00');
  assert.equal(projectGrossPay({ amounts: ['1500', '1600'], frequency: 'semimonthly', policyRef: 'Reviewed policy' }).annual, '37200.00');
});
test('projection requires frequency and policy, not a guessed default', () => {
  assert.throws(() => projectGrossPay({ amounts: ['1500'], frequency: '', policyRef: 'Policy' }));
  assert.throws(() => projectGrossPay({ amounts: ['1500'], frequency: 'weekly', policyRef: '' }));
});

const { calculateTicSums } = await import('../src/lib/tic-cell-repair.mjs');
test('TIC calculations never add account principal to annual income', () => {
  const result = calculateTicSums({ asset_1_household_member_number: '1', asset_1_type: 'Savings', asset_1_cash_value: '5000', asset_1_annual_income: '25' });
  assert.equal(result.proposals.total_asset_cash_value, '5000.00');
  assert.equal(result.proposals.total_asset_annual_income, '25.00');
  assert.equal(result.proposals.household_annual_income, undefined);
});
test('an active incomplete income row blocks totals rather than assuming zero', () => {
  const result = calculateTicSums({ income_member_1_household_member_number: '1', income_member_1_wages_business: '42000' });
  assert.ok(result.blockers.length);
  assert.equal(result.proposals.total_income_e, undefined);
});
test('income reconciliation accepts explicit zero values and preserves inputs', () => {
  const input = Object.freeze({ income_member_1_household_member_number: '1', income_member_1_wages_business: '42000', income_member_1_social_security_pension: '0', income_member_1_public_assistance: '0', income_member_1_other_income: '100.25' });
  assert.equal(calculateTicSums(input).proposals.total_income_e, '42100.25');
  assert.equal(input.income_member_1_wages_business, '42000');
});
