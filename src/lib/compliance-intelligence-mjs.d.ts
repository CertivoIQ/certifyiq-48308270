declare module '@/lib/compliance-intelligence.mjs' {
  export const FEATURE_NAMES: {
    certificationIntelligence: string;
    historyIntelligence: string;
    massReview: string;
    findingsEngine: string;
    auditSimulator: string;
    auditReadiness: string;
    portfolioCommandCenter: string;
    submissionCenter: string;
    approvalCenter: string;
    pmsHub: string;
    dataHub: string;
    correctiveAction: string;
    evidenceIntelligence: string;
  };

  export interface ComplianceFinding {
    severity?: string;
    title?: string;
  }

  export function calculateAuditReadiness(input?: {
    critical?: number;
    major?: number;
    minor?: number;
    evidenceCoverage?: number;
  }): number;

  export function summarizeAudit(
    findings?: readonly ComplianceFinding[],
    evidenceCoverage?: number,
  ): {
    critical: number;
    major: number;
    minor: number;
    readinessScore: number;
    findings: readonly ComplianceFinding[];
  };

  export function canSubmitCertification(input: {
    status?: string | null;
    approvedBy?: string | null;
    approvedAt?: string | null;
  }): boolean;

  export function createSubmissionRequest(input: {
    status?: string | null;
    authorityName?: string;
    authorityType?: string;
    deliveryMethod?: string;
    approvedBy?: string | null;
    approvedAt?: string | null;
  }): {
    authorityName?: string;
    authorityType: string;
    deliveryMethod: string;
    status: string;
  };

  export function aggregatePortfolioReadiness(
    properties?: readonly {
      name?: string;
      readinessScore?: number;
      critical?: number;
      findings?: number;
    }[],
  ): {
    readinessScore: number;
    propertyCount: number;
    auditReadyCount: number;
    atRiskCount: number;
  };

  export const PMS_PROVIDERS: readonly string[];
}
