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

test('Compliance Intelligence smoke test', () => {
  assert.equal(detectDuplicate({ sha256: 'abc' }, [{ id: '1', sha256: 'abc' }]).duplicate, true);
  assert.equal(compareCertificationVersions({ income: 42000 }, { income: 57000 })[0].field, 'income');
  assert.equal(buildFindings({ extracted: { income: 57000 }, requiredFields: ['income', 'signature'], prior: { income: 42000 } }).length, 2);
});

test('Audit Simulator calculates deterministic readiness', () => {
  assert.equal(calculateAuditReadiness({ evidenceCoverage: 1 }), 100);
  const summary = summarizeAudit([{ severity: 'critical' }, { severity: 'major' }, { severity: 'minor' }]);
  assert.deepEqual({ critical: summary.critical, major: summary.major, minor: summary.minor }, { critical: 1, major: 1, minor: 1 });
  assert.equal(summary.readinessScore, 40);
});

test('Certification Submission Center requires human approval', () => {
  assert.equal(canSubmitCertification({ status: 'draft', approvedBy: null, approvedAt: null }), false);
  assert.equal(canSubmitCertification({ status: 'approved', approvedBy: 'reviewer-1', approvedAt: '2026-08-09T00:00:00Z' }), true);
  assert.throws(() => createSubmissionRequest({ status: 'draft', authorityName: 'PHA', approvedBy: null, approvedAt: null }));
});

test('Portfolio Command Center and PMS Hub normalize supported data', () => {
  assert.deepEqual(aggregatePortfolioReadiness([{ readinessScore: 96 }, { readinessScore: 80 }, { readinessScore: 92 }]), {
    readinessScore: 89,
    propertyCount: 3,
    auditReadyCount: 2,
    atRiskCount: 1,
  });
  assert.equal(normalizePmsRecord('Yardi', { externalId: 123 }).externalId, '123');
  assert.throws(() => normalizePmsRecord('UnknownPMS', { externalId: 1 }));
});
