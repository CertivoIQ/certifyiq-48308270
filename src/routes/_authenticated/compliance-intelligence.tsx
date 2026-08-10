import { createFileRoute } from '@tanstack/react-router';
import { ComplianceIntelligenceSuite } from '@/components/compliance-intelligence-suite';

export const Route = createFileRoute('/_authenticated/compliance-intelligence')({
  component: ComplianceIntelligenceSuite,
});
