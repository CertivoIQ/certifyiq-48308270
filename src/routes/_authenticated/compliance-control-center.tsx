import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { ComplianceTimeMachine } from "@/components/compliance-time-machine";

export const Route = createFileRoute("/_authenticated/compliance-control-center")({
  head: () => ({
    meta: [
      { title: "Compliance Control Center — CertivoIQ" },
      { name: "description", content: "Historical compliance posture and executive compliance intelligence grounded in CertivoIQ records." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ComplianceControlCenter,
});

function ComplianceControlCenter() {
  return (
    <AppShell
      title="Compliance Control Center"
      subtitle="Historical, regulatory, portfolio, and operational intelligence grounded in structured CertivoIQ data."
    >
      <div className="space-y-6">
        <ComplianceTimeMachine />
      </div>
    </AppShell>
  );
}
