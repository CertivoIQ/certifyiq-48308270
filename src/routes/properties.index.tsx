import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PortfolioOnboardingPanel } from "@/components/portfolio-onboarding-panel";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/properties/")({
  head: () => ({
    meta: [
      { title: "Portfolio & Tenant Onboarding — CertivoIQ" },
      { name: "description", content: "Onboarding intake for client properties, units, and tenant profiles before operational dashboard use." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PropertiesPage,
});

function PropertiesPage() {
  return (
    <AppShell
      title="Portfolio & tenant onboarding"
      subtitle="Create properties, units, and tenant profiles as an account-setup task before operational dashboard use"
      actions={
        <Button size="sm" variant="outline" asChild>
          <Link to="/launchpad"><ArrowLeft className="size-4" /> Return to LaunchPad</Link>
        </Button>
      }
    >
      <PortfolioOnboardingPanel />
    </AppShell>
  );
}
