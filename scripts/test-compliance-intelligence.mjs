import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregatePortfolioReadiness,
  buildFindings,
  calculateAuditReadiness,
  canSubmitCertification,
  compareCertificationVersions,
  createSubmissionRequest,
  detectDuplicate,
  normalizePmsRecord,
  summarizeAudit,
} from '../src/lib/compliance-intelligence.mjs';

test('duplicate detection uses SHA-256 and does not guess without a hash', () => {
  assert.deepEqual(detectDuplicate({ sha256: 'abc' }, [{ id: '1', sha256: 'abc' }]), { duplicate: true, reason: 'sha256_match', matchedId: '1' });
  assert.deepEqual(detectDuplicate({ sha256: null }, [{ id: '1', sha256: null }]), { duplicate: false, reason: 'missing_hash' });
});

test('historical comparison detects field changes', () => {
  assert.deepEqual(compareCertificationVersions({ income: 42000 }, { income: 57000 }), [{ field: 'income', before: 42000, after: 57000 }]);
});

test('findings engine detects required fields and historical income changes', () => {
  const findings = buildFindings({ extracted: { income: 57000 }, requiredFields: ['income', 'signature'], prior: { income: 42000 } });
  assert.equal(findings.some((f) => f.code === 'MISSING_SIGNATURE'), true);
  assert.equal(findings.some((f) => f.code === 'HISTORICAL_INCOME_CHANGE'), true);
});

test('audit readiness is bounded and penalizes severity', () => {
  assert.equal(calculateAuditReadiness({ critical: 0, major: 0, minor: 0, evidenceCoverage: 1 }), 100);
  assert.equal(calculateAuditReadiness({ critical: 1, major: 1, minor: 1, evidenceCoverage: 1 }), 40);
  assert.equal(calculateAuditReadiness({ critical: 0, major: 0, minor: 0, evidenceCoverage: 0.5 }), 50);
});

test('audit summary counts severities and returns readiness', () => {
  const result = summarizeAudit([{ severity: 'critical' }, { severity: 'major' }, { severity: 'minor' }]);
  assert.deepEqual({ critical: result.critical, major: result.major, minor: result.minor }, { critical: 1, major: 1, minor: 1 });
  assert.equal(result.readinessScore, 40);
});

test('authority submission is blocked until human approval exists', () => {
  assert.equal(canSubmitCertification({ status: 'draft', approvedBy: null, approvedAt: null }), false);
  assert.throws(() => createSubmissionRequest({ status: 'draft', authorityName: 'PHA', approvedBy: null, approvedAt: null }));
  assert.equal(canSubmitCertification({ status: 'approved', approvedBy: 'reviewer-1', approvedAt: '2026-08-09T00:00:00Z' }), true);
});

test('approved authority submission carries an audit-safe approval record', () => {
  const request = createSubmissionRequest({ status: 'approved', authorityName: 'Memphis Housing Authority', authorityType: 'housing_authority', approvedBy: 'reviewer-1', approvedAt: '2026-08-09T00:00:00Z', deliveryMethod: 'manual' });
  assert.equal(request.status, 'approved');
  assert.equal(request.approvedBy, 'reviewer-1');
});

test('portfolio readiness aggregates properties', () => {
  assert.deepEqual(aggregatePortfolioReadiness([{ readinessScore: 96 }, { readinessScore: 80 }, { readinessScore: 92 }]), { readinessScore: 89, propertyCount: 3, auditReadyCount: 2, atRiskCount: 1 });
});

test('PMS normalization rejects unsupported providers', () => {
  assert.equal(normalizePmsRecord('Yardi', { externalId: 123 }).externalId, '123');
  assert.throws(() => normalizePmsRecord('UnknownPMS', { externalId: 1 }));
});
