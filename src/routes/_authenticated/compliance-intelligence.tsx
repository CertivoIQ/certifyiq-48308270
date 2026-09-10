import { createFileRoute } from '@tanstack/react-router';
import { ComplianceIntelligenceSuite } from '@/components/compliance-intelligence-suite';
import { ComplianceTimeMachine } from '@/components/compliance-time-machine';

export const Route = createFileRoute('/_authenticated/compliance-intelligence')({
  component: ComplianceIntelligenceWorkspace,
});

function ComplianceIntelligenceWorkspace() {
  return <><ComplianceIntelligenceSuite /><div className="mx-auto w-full max-w-7xl px-6 pb-10 md:px-10"><ComplianceTimeMachine /></div></>;
}
