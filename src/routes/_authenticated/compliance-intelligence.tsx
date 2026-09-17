import { createFileRoute } from '@tanstack/react-router';
import { ComplianceIntelligenceSuite } from '@/components/compliance-intelligence-suite';
import { ComplianceTimeMachine } from '@/components/compliance-time-machine';
import { ComplianceImpactAnalysis } from '@/components/compliance-impact-analysis';
import { RegulatoryDiffEngine } from '@/components/regulatory-diff-engine';
import { PortfolioComplianceIntelligence } from '@/components/portfolio-compliance-intelligence';
import { ComplianceControlCenter } from '@/components/compliance-control-center';
import { EnterpriseCapabilityArchitecture } from '@/components/enterprise-capability-architecture';
import { ComplianceCorpusGovernance } from '@/components/compliance-corpus-governance';

export const Route = createFileRoute('/_authenticated/compliance-intelligence')({
  component: ComplianceIntelligenceWorkspace,
});

function ComplianceIntelligenceWorkspace() {
  return (
    <>
      <ComplianceControlCenter /><ComplianceIntelligenceSuite />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-6 pb-10 md:px-10">
        <section id="compliance-time-machine" className="scroll-mt-24"><ComplianceTimeMachine /></section>
        <section id="compliance-impact-analysis" className="scroll-mt-24"><ComplianceImpactAnalysis /></section>
        <section id="regulatory-diff-engine" className="scroll-mt-24"><RegulatoryDiffEngine /></section>
        <section id="portfolio-compliance-intelligence" className="scroll-mt-24"><PortfolioComplianceIntelligence /></section>
        <section id="enterprise-capability-architecture" className="scroll-mt-24"><EnterpriseCapabilityArchitecture /></section>
        <section id="compliance-corpus-governance" className="scroll-mt-24"><ComplianceCorpusGovernance /></section>
      </div>
    </>
  );
}
