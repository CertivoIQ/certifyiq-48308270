import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { FreeReviewLeadGate } from "@/components/FreeReviewLeadGate";
import { CertificationReviewPanel } from "@/components/certification-review-panel";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/files/")({
  head: () => ({
    meta: [
      { title: "Certification Review Queue — CertivoIQ" },
      { name: "description", content: "Client-selected certification review queue with deterministic findings and human approval." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FilesPage,
});

function FilesPage() {
  return (
    <AppShell
      title="Certification review queue"
      subtitle="Select imported tenants or certifications; multi-select reviews run in original upload order"
      actions={<Button size="sm" variant="outline" asChild><Link to="/properties"><Building2 className="size-4" /> Import properties & tenants</Link></Button>}
    >
      <FreeReviewLeadGate>
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-medium">Review only when you choose</p>
          <p className="mt-1 text-muted-foreground">Property, unit, tenant, and document intake does not automatically enter compliance review. Select the certifications you want reviewed below.</p>
        </div>
        <CertificationReviewPanel />
      </FreeReviewLeadGate>
    </AppShell>
  );
}
