import { createFileRoute } from '@tanstack/react-router';
import { ComplianceIntelligenceSuite } from '@/components/compliance-intelligence-suite';
import { ComplianceTimeMachine } from '@/components/compliance-time-machine';
import { ComplianceImpactAnalysis } from '@/components/compliance-impact-analysis';
import { RegulatoryDiffEngine } from '@/components/regulatory-diff-engine';
import { PortfolioComplianceIntelligence } from '@/components/portfolio-compliance-intelligence';
import { ComplianceControlCenter } from '@/components/compliance-control-center';

export const Route = createFileRoute('/_authenticated/compliance-intelligence')({
  component: ComplianceIntelligenceWorkspace,
});

function ComplianceIntelligenceWorkspace() {
  return <><ComplianceControlCenter /><ComplianceIntelligenceSuite /><div className="mx-auto w-full max-w-7xl px-6 pb-10 md:px-10"><ComplianceTimeMachine /><ComplianceImpactAnalysis /><RegulatoryDiffEngine /><PortfolioComplianceIntelligence /></div></>;
}
