export const FEATURE_NAMES = {
  certificationIntelligence: 'Certification Intelligence™',
  historyIntelligence: 'Certification History Intelligence™',
  massReview: 'Mass Certification Review™',
  findingsEngine: 'Compliance Findings Engine™',
  auditSimulator: 'Audit Simulator™',
  auditReadiness: 'Audit Readiness Score™',
  portfolioCommandCenter: 'Portfolio Compliance Command Center™',
  submissionCenter: 'Certification Submission Center™',
  approvalCenter: 'Compliance Approval Center™',
  pmsHub: 'PMS Integration Hub™',
  dataHub: 'Compliance Data Hub™',
  correctiveAction: 'Corrective Action Center™',
  evidenceIntelligence: 'Evidence Intelligence™',
};

export const SEVERITY_WEIGHT = Object.freeze({ critical: 40, major: 15, minor: 5 });

export function sha256Key(file) {
  if (!file || typeof file !== 'object') throw new TypeError('A file object is required');
  return file.sha256 || null;
}

export function detectDuplicate(current, historical) {
  const hash = sha256Key(current);
  if (!hash) return { duplicate: false, reason: 'missing_hash' };
  const match = historical.find((item) => item.sha256 === hash);
  return match
    ? { duplicate: true, reason: 'sha256_match', matchedId: match.id }
    : { duplicate: false };
}

export function compareCertificationVersions(previous = {}, current = {}) {
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changes = [];
  for (const key of keys) {
    const before = previous[key];
    const after = current[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ field: key, before: before ?? null, after: after ?? null });
    }
  }
  return changes;
}

export function buildFindings({ extracted = {}, requiredFields = [], prior = {} } = {}) {
  const findings = [];
  for (const field of requiredFields) {
    const value = extracted[field];
    if (value === undefined || value === null || value === '') {
      findings.push({ code: `MISSING_${String(field).toUpperCase()}`, severity: 'major', field, message: `${field} is missing` });
    }
  }
  for (const change of compareCertificationVersions(prior, extracted)) {
    if (change.field.toLowerCase().includes('income') && prior[change.field] != null) {
      findings.push({ code: 'HISTORICAL_INCOME_CHANGE', severity: 'major', field: change.field, message: 'Income changed from a prior certification; supporting evidence should be reviewed.' });
    }
  }
  return findings;
}

export function calculateAuditReadiness({ critical = 0, major = 0, minor = 0, evidenceCoverage = 1 } = {}) {
  const penalty = critical * SEVERITY_WEIGHT.critical + major * SEVERITY_WEIGHT.major + minor * SEVERITY_WEIGHT.minor;
  const evidencePenalty = Math.max(0, Math.min(1, evidenceCoverage));
  return Math.max(0, Math.min(100, Math.round((100 - penalty) * evidencePenalty)));
}

export function summarizeAudit(findings = [], evidenceCoverage = 1) {
  const counts = findings.reduce((acc, finding) => {
    const severity = finding.severity || 'minor';
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, { critical: 0, major: 0, minor: 0 });
  return {
    ...counts,
    readinessScore: calculateAuditReadiness({ ...counts, evidenceCoverage }),
    findings,
  };
}

export function canSubmitCertification({ status, approvedBy, approvedAt }) {
  return status === 'approved' && Boolean(approvedBy) && Boolean(approvedAt);
}

export function createSubmissionRequest(input) {
  if (!canSubmitCertification(input)) {
    throw new Error('Certification must receive human approval before submission.');
  }
  return {
    authorityName: input.authorityName,
    authorityType: input.authorityType || 'housing_authority',
    deliveryMethod: input.deliveryMethod || 'manual',
    status: 'approved',
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
  };
}

export function aggregatePortfolioReadiness(properties = []) {
  if (!properties.length) return { readinessScore: 0, propertyCount: 0, auditReadyCount: 0, atRiskCount: 0 };
  const total = properties.reduce((sum, p) => sum + Number(p.readinessScore || 0), 0);
  const auditReadyCount = properties.filter((p) => Number(p.readinessScore || 0) >= 90).length;
  return {
    readinessScore: Math.round(total / properties.length),
    propertyCount: properties.length,
    auditReadyCount,
    atRiskCount: properties.length - auditReadyCount,
  };
}

export const PMS_PROVIDERS = Object.freeze(['Yardi', 'RealPage', 'AppFolio', 'Entrata', 'MRI']);

export function normalizePmsRecord(provider, record) {
  if (!PMS_PROVIDERS.includes(provider)) throw new Error(`Unsupported PMS provider: ${provider}`);
  return {
    provider,
    externalId: String(record.externalId),
    propertyExternalId: record.propertyExternalId ? String(record.propertyExternalId) : null,
    householdExternalId: record.householdExternalId ? String(record.householdExternalId) : null,
    certificationExternalId: record.certificationExternalId ? String(record.certificationExternalId) : null,
    sourceUpdatedAt: record.sourceUpdatedAt || null,
  };
}
