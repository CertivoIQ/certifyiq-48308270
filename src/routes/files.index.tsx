import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { FreeReviewLeadGate } from "@/components/FreeReviewLeadGate";
import { CertificationReviewPanel } from "@/components/certification-review-panel";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FilesSearch = {
  item?: string | undefined;
  action?: "support" | "review" | undefined;
};

export const Route = createFileRoute("/files/")({
  validateSearch: (search: Record<string, unknown>): FilesSearch => ({
    item: typeof search['item'] === "string" && UUID_PATTERN.test(search['item']) ? search['item'] : undefined,
    action: search['action'] === "support" || search['action'] === "review" ? search['action'] : undefined,
  }),
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
  const { item, action } = Route.useSearch();

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
        <CertificationReviewPanel initialItemId={item} initialAction={action} />
      </FreeReviewLeadGate>
    </AppShell>
  );
}
