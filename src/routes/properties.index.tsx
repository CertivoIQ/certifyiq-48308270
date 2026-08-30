import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PortfolioIntakePanel } from "@/components/portfolio-intake-panel";
import { Button } from "@/components/ui/button";
import { FileSearch } from "lucide-react";

export const Route = createFileRoute("/properties/")({
  head: () => ({
    meta: [
      { title: "Properties, Units & Tenant Intake — CertivoIQ" },
      { name: "description", content: "Controlled mass intake for client properties, units, tenant profiles, and certification documents." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PropertiesPage,
});

function PropertiesPage() {
  return (
    <AppShell
      title="Properties, units & tenants"
      subtitle="Import portfolio records and documents without automatically starting compliance review"
      actions={<Button size="sm" asChild><Link to="/files"><FileSearch className="size-4" /> Choose certifications to review</Link></Button>}
    >
      <PortfolioIntakePanel />
    </AppShell>
  );
}
