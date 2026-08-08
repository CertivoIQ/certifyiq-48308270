import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { AgencyOverview } from "@/components/HfaRegulatoryConsole";
import { AgencyTeamPanel } from "@/components/hfa-agency-team";
import { listMyAgencies } from "@/lib/hfa-regulatory.functions";

function AgencyHome() {
  const list = useServerFn(listMyAgencies);
  const memberships = useQuery({ queryKey: ["hfa-my-agencies"], queryFn: () => list({}) });
  const adminAgencies = (memberships.data ?? []).filter((m) => m.role === "agency_admin");

  return (
    <AppShell title="Agency Regulatory Console" subtitle="Packages explicitly submitted to your agency">
      <div className="space-y-6">
        <AgencyOverview />
        {adminAgencies.map((m) => (
          <AgencyTeamPanel key={m.agency.id} agencyId={m.agency.id} />
        ))}
      </div>
    </AppShell>
  );
}

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
  component: AgencyHome,
});
