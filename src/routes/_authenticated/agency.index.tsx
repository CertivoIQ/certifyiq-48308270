import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AgencyOverview } from "@/components/HfaRegulatoryConsole";

export const Route = createFileRoute("/_authenticated/agency/")({
  head: () => ({
    meta: [
      { title: "Agency Regulatory Console — CertivoIQ" },
      {
        name: "description",
        content:
          "Housing agency workspace for reviewing compliance packages explicitly submitted by owners.",
      },
      { property: "og:title", content: "Agency Regulatory Console — CertivoIQ" },
      { property: "og:description", content: "Review submitted affordable housing compliance packages." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => (
    <AppShell title="Agency Regulatory Console" subtitle="Packages explicitly submitted to your agency">
      <AgencyOverview />
    </AppShell>
  ),
});
